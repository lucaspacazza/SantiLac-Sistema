<?php

namespace App\Services\Qualidade;

use App\Models\Qualidade\ProdutorQualidade;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RelatoriosV2Service
{
    private const INDICADORES = [
        'gordura' => ['label' => 'Gordura', 'unidade' => '%', 'tipo' => 'min', 'min' => 3.5],
        'proteina' => ['label' => 'Proteína', 'unidade' => '%', 'tipo' => 'min', 'min' => 3.2],
        'lactose' => ['label' => 'Lactose', 'unidade' => '%', 'tipo' => 'min', 'min' => 4.5],
        'solidos_totais' => ['label' => 'Sólidos totais', 'unidade' => '%', 'tipo' => 'min', 'min' => 12.2],
        'ccs' => ['label' => 'CCS', 'unidade' => 'mil/mL', 'tipo' => 'max', 'max' => 50000],
        'ufc' => ['label' => 'UFC', 'unidade' => 'mil/mL', 'tipo' => 'max', 'max' => 30000],
        'ureia' => ['label' => 'Ureia', 'unidade' => 'mg/dL', 'tipo' => 'faixa', 'min' => 11, 'max' => 15],
        'temperatura' => ['label' => 'Temperatura', 'unidade' => '°C', 'tipo' => 'faixa', 'min' => 2, 'max' => 8],
        'antibiotico' => ['label' => 'Antibiótico', 'unidade' => 'resultado', 'tipo' => 'negativo'],
        'bacteria' => ['label' => 'Bactéria', 'unidade' => 'resultado', 'tipo' => 'negativo'],
    ];

    public function resumo(array $filtros): array
    {
        $inicio = (string) $filtros['data_inicio'];
        $fim = (string) $filtros['data_fim'];
        $rota = $this->filtro($filtros['rota'] ?? null);
        $cidade = $this->filtro($filtros['cidade'] ?? null);

        $base = ProdutorQualidade::query()->where('ativo', 1);
        $cidades = clone $base;
        if ($rota !== null) {
            $cidades->where('rota', $rota);
        }
        $opcoes = [
            'rotas' => (clone $base)->whereNotNull('rota')->distinct()->orderBy('rota')->pluck('rota')->values()->all(),
            'cidades' => $cidades->whereNotNull('cidade')->distinct()->orderBy('cidade')->pluck('cidade')->values()->all(),
        ];
        if ($rota !== null) {
            $base->where('rota', $rota);
        }
        if ($cidade !== null) {
            $base->where('cidade', $cidade);
        }

        $produtores = $base->orderBy('nome')->get(['codigo', 'nome', 'cidade', 'rota']);
        $codigos = $produtores->pluck('codigo')->map(fn ($codigo): string => (string) $codigo)->all();
        $resumoAnalises = $this->resumirAnalises($codigos, $inicio, $fim);
        $ultimas = $resumoAnalises['ultimas'];
        $avaliados = $this->avaliarProdutores($produtores, $ultimas);

        return [
            'contexto' => [
                'periodo' => [
                    'inicio' => $inicio,
                    'fim' => $fim,
                    'label' => Carbon::parse($inicio)->format('d/m/Y') . ' a ' . Carbon::parse($fim)->format('d/m/Y'),
                ],
                'gerado_em' => now('America/Sao_Paulo')->toIso8601String(),
            ],
            'filtros' => ['rota' => $rota, 'cidade' => $cidade],
            'executivo' => $this->executivo($avaliados, $resumoAnalises['total']),
            'tendencia' => $this->tendencia($produtores, $resumoAnalises['mensais'], $resumoAnalises['totais_mensais']),
            'indicadores' => $this->indicadores($ultimas),
            'prioridades' => $this->prioridades($avaliados),
            'rotas' => $this->rotas($avaliados),
            'opcoes' => $opcoes,
        ];
    }

    private function resumirAnalises(array $codigos, string $inicio, string $fim): array
    {
        if ($codigos === []) {
            return [
                'total' => 0,
                'ultimas' => collect(),
                'mensais' => collect(),
                'totais_mensais' => collect(),
            ];
        }

        $ultimas = [];
        $mensais = [];
        $totaisMensais = [];
        $total = 0;
        $cursor = DB::connection('raw')->table('resultadosanalises')
            ->select([
                'id', 'produtor_codigo', 'data', 'gordura', 'proteina', 'lactose',
                'solidos_totais', 'ccs', 'ufc', 'ureia', 'temperatura', 'antibiotico', 'bacteria',
            ])
            ->whereIn('produtor_codigo', $codigos)
            ->where('data', '>=', $inicio)
            ->where('data', '<=', $fim)
            ->orderBy('data')->orderBy('id')->cursor();

        foreach ($cursor as $analise) {
            $codigo = (string) $analise->produtor_codigo;
            $periodo = substr((string) $analise->data, 0, 7);
            $total++;
            $totaisMensais[$periodo] = ($totaisMensais[$periodo] ?? 0) + 1;
            $ultimas[$codigo] = $analise;
            $mensais[$periodo][$codigo] = $analise;
        }

        return [
            'total' => $total,
            'ultimas' => collect($ultimas),
            'mensais' => collect($mensais)->map(fn (array $items): Collection => collect($items)),
            'totais_mensais' => collect($totaisMensais),
        ];
    }

    private function avaliarProdutores(Collection $produtores, Collection $ultimas): Collection
    {
        return $produtores->map(function ($produtor) use ($ultimas): array {
            $analise = $ultimas->get((string) $produtor->codigo);
            $desvios = $analise === null ? [] : $this->desvios($analise);
            $critico = $analise !== null && ($this->positivo($analise->antibiotico) || $this->positivo($analise->bacteria));

            return [
                'codigo' => (string) $produtor->codigo,
                'nome' => (string) $produtor->nome,
                'cidade' => (string) ($produtor->cidade ?? ''),
                'rota' => (string) ($produtor->rota ?? ''),
                'data_analise' => $analise?->data,
                'status' => $analise === null ? 'sem_analise' : ($critico ? 'critico' : ($desvios === [] ? 'conforme' : 'fora_padrao')),
                'total_desvios' => count($desvios),
                'indicadores_fora_padrao' => $desvios,
            ];
        })->values();
    }

    private function executivo(Collection $produtores, int $totalAnalises): array
    {
        $total = $produtores->count();
        $analisados = $produtores->whereNotNull('data_analise')->count();
        $conformes = $produtores->where('status', 'conforme')->count();

        return [
            'total_produtores' => $total,
            'produtores_analisados' => $analisados,
            'cobertura_percentual' => $this->percentual($analisados, $total),
            'conformes' => $conformes,
            'conformidade_percentual' => $this->percentual($conformes, $analisados),
            'total_analises' => $totalAnalises,
            'media_analises_por_produtor' => $analisados > 0 ? round($totalAnalises / $analisados, 1) : 0.0,
            'criticos' => $produtores->where('status', 'critico')->count(),
        ];
    }

    private function tendencia(Collection $produtores, Collection $mensais, Collection $totaisMensais): array
    {
        return $mensais
            ->map(function (Collection $ultimasDoMes, string $periodo) use ($produtores, $totaisMensais): array {
                $avaliados = $this->avaliarProdutores($produtores, $ultimasDoMes);
                $analisados = $avaliados->whereNotNull('data_analise')->count();
                $conformes = $avaliados->where('status', 'conforme')->count();
                return [
                    'periodo' => $periodo,
                    'total_analises' => (int) $totaisMensais->get($periodo, 0),
                    'produtores_analisados' => $analisados,
                    'conformes' => $conformes,
                    'conformidade_percentual' => $this->percentual($conformes, $analisados),
                ];
            })->sortKeys()->values()->all();
    }

    private function indicadores(Collection $ultimas): array
    {
        return collect(self::INDICADORES)->map(function (array $regra, string $codigo) use ($ultimas): array {
            $avaliados = $ultimas->filter(fn ($analise): bool => $analise->{$codigo} !== null);
            $fora = $avaliados->filter(fn ($analise): bool => $this->foraPadrao($analise->{$codigo}, $regra))->count();
            return [
                'codigo' => $codigo,
                'label' => $regra['label'],
                'unidade' => $regra['unidade'],
                'total_avaliados' => $avaliados->count(),
                'fora_padrao' => $fora,
                'prevalencia_percentual' => $this->percentual($fora, $avaliados->count()),
            ];
        })->values()->all();
    }

    private function prioridades(Collection $produtores): array
    {
        $ordenar = fn (Collection $items): array => $items->sortBy([
            ['total_desvios', 'desc'],
            ['nome', 'asc'],
        ])->values()->take(20)->all();

        return [
            'criticos' => $ordenar($produtores->where('status', 'critico')),
            'fora_padrao' => $ordenar($produtores->where('status', 'fora_padrao')),
            'sem_analise' => $ordenar($produtores->where('status', 'sem_analise')),
        ];
    }

    private function rotas(Collection $produtores): array
    {
        return $produtores->groupBy(fn (array $item): string => $item['rota'] !== '' ? $item['rota'] : 'Sem rota')
            ->map(function (Collection $items, string $rota): array {
                $total = $items->count();
                $analisados = $items->whereNotNull('data_analise')->count();
                $conformes = $items->where('status', 'conforme')->count();
                return [
                    'rota' => $rota,
                    'total_produtores' => $total,
                    'produtores_analisados' => $analisados,
                    'cobertura_percentual' => $this->percentual($analisados, $total),
                    'conformes' => $conformes,
                    'conformidade_percentual' => $this->percentual($conformes, $analisados),
                    'criticos' => $items->where('status', 'critico')->count(),
                ];
            })->sortKeys()->values()->all();
    }

    private function desvios(object $analise): array
    {
        return collect(self::INDICADORES)
            ->filter(fn (array $regra, string $codigo): bool => $analise->{$codigo} !== null && $this->foraPadrao($analise->{$codigo}, $regra))
            ->keys()->all();
    }

    private function foraPadrao(mixed $valor, array $regra): bool
    {
        return match ($regra['tipo']) {
            'min' => (float) $valor < $regra['min'],
            'max' => (float) $valor > $regra['max'],
            'faixa' => (float) $valor < $regra['min'] || (float) $valor > $regra['max'],
            'negativo' => $this->positivo($valor),
        };
    }

    private function positivo(mixed $valor): bool
    {
        if ($valor === null) {
            return false;
        }
        if (is_numeric($valor)) {
            return (float) $valor > 0;
        }
        return in_array(strtoupper(trim((string) $valor)), ['1', 'SIM', 'S', 'POS', 'POSITIVO', 'POSITIVE'], true);
    }

    private function percentual(int $parte, int $total): float
    {
        return $total > 0 ? round(($parte / $total) * 100, 1) : 0.0;
    }

    private function filtro(mixed $valor): ?string
    {
        $valor = trim((string) $valor);
        return $valor === '' ? null : $valor;
    }
}
