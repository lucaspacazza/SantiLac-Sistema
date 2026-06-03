<?php

namespace App\Services\Producao;

use App\Models\ProducaoFormulacaoQueijo;
use App\Models\ProducaoOrdemProducao;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class OrdemProducaoService
{
    private const CAMPO_EM_BRANCO = '__op_blank__';

    private const CAMPOS_OP = [
        ['chave' => 'producao_data', 'rotulo' => 'PRODUÇÃO DIARIA / DATA'],
        ['chave' => 'lts_produzidos_total', 'rotulo' => 'LTS PRODUZIDOS TOTAL'],
        ['chave' => 'pecas_f4', 'rotulo' => 'PEÇAS F4'],
        ['chave' => 'pecas_f1', 'rotulo' => 'PEÇAS F1'],
        ['chave' => 'pecas_f6', 'rotulo' => 'PEÇAS F6'],
        ['chave' => 'pecas_colonial', 'rotulo' => 'PEÇAS COLONIAL'],
        ['chave' => 'pecas_coalho', 'rotulo' => 'PEÇAS COALHO'],
        ['chave' => 'pecas_provolone', 'rotulo' => 'PEÇAS PROVOLONE'],
        ['chave' => 'pecas_gouda', 'rotulo' => 'PEÇAS GOUDA'],
        ['chave' => 'pecas_gruyere', 'rotulo' => 'PEÇAS GRUYERE'],
        ['chave' => 'pecas_prato', 'rotulo' => 'PEÇAS PRATO'],
        ['chave' => 'cloreto_calcio', 'rotulo' => 'CLORETO CÁLCIO'],
        ['chave' => 'coalho', 'rotulo' => 'COALHO'],
        ['chave' => 'fermento_mvd', 'rotulo' => 'FERMENTO (MVD)'],
        ['chave' => 'fermento_fast', 'rotulo' => 'FERMENTO (FAST)'],
        ['chave' => 'fermento_1', 'rotulo' => 'FERMENTO'],
        ['chave' => 'fermento_2', 'rotulo' => 'FERMENTO'],
        ['chave' => 'corante', 'rotulo' => 'CORANTE'],
    ];

    public function listar(Request $request): array
    {
        $data = trim((string) $request->query('data', ''));

        if ($data === '') {
            return [];
        }

        return ProducaoOrdemProducao::query()
            ->whereDate('data_ordem', $data)
            ->orderBy('codigo_ordem')
            ->orderBy('id')
            ->get()
            ->map(fn (ProducaoOrdemProducao $ordem): array => $this->resumoOrdem($ordem))
            ->values()
            ->all();
    }

    public function buscar(int $id): ?array
    {
        $ordem = ProducaoOrdemProducao::query()->where('id', $id)->first();

        return $ordem === null ? null : $this->formatarOrdem($ordem, $this->formulacoesDaOrdem($ordem));
    }

    public function catalogos(): array
    {
        return [
            'queijos' => $this->catalogoQueijos(),
            'insumos' => $this->catalogoInsumos(),
        ];
    }

    public function salvar(array $payload): array
    {
        $data = (string) $payload['data'];
        $codigo = $this->normalizarCodigo((string) ($payload['codigo_ordem'] ?? ''));
        $campos = collect($payload['campos'] ?? [])
            ->map(fn (array $campo): array => [
                'rotulo' => trim((string) ($campo['rotulo'] ?? '')),
                'valor' => trim((string) ($campo['valor'] ?? '')),
            ])
            ->filter(fn (array $campo): bool => $campo['rotulo'] !== '')
            ->values()
            ->all();

        $codigo = $codigo !== '' ? $codigo : $this->gerarCodigo($data);

        $ordem = ProducaoOrdemProducao::query()->updateOrCreate(
            ['codigo_ordem' => $codigo],
            [
                'formulacao_queijo_id' => null,
                'data_ordem' => $data,
                'campos_json' => $campos,
                'origem' => 'manual',
                'status' => 'rascunho',
                'observacoes' => $payload['observacoes'] ?? null,
            ],
        );

        return $this->formatarOrdem($ordem, collect());
    }

    public function gerarDaFormulacao(int $formulacaoId): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $formulacaoId)->first();

        if ($formulacao === null || $formulacao->status !== 'finalizada') {
            return null;
        }

        $data = optional($formulacao->data_formulacao)->toDateString();
        if ($data === null) {
            return null;
        }

        $ordem = ProducaoOrdemProducao::query()->updateOrCreate(
            ['formulacao_queijo_id' => $formulacao->id],
            [
                'codigo_ordem' => $this->gerarCodigoDaFormulacao($formulacao),
                'data_ordem' => $data,
                'campos_json' => $this->camposDaFormulacao($formulacao),
                'origem' => 'automatica',
                'status' => 'finalizada',
                'observacoes' => 'Gerada pela formulação ' . ($formulacao->codigo_formulacao ?? $formulacao->id),
            ],
        );

        return $this->formatarOrdem($ordem, collect([$formulacao]));
    }

    private function resumoOrdem(ProducaoOrdemProducao $ordem): array
    {
        $formulacao = $ordem->formulacao_queijo_id !== null
            ? ProducaoFormulacaoQueijo::query()->where('id', $ordem->formulacao_queijo_id)->first()
            : null;

        return [
            'id' => (int) $ordem->id,
            'codigo_ordem' => (string) $ordem->codigo_ordem,
            'data' => optional($ordem->data_ordem)->toDateString(),
            'tipo_queijo' => $formulacao?->tipo_queijo ?? $this->tipoQueijoDosCampos($ordem->campos_json),
            'lote_queijo' => $formulacao?->lote_queijo,
            'origem' => (string) $ordem->origem,
            'status' => $ordem->status ?? 'rascunho',
        ];
    }

    private function formulacoesDaOrdem(ProducaoOrdemProducao $ordem): Collection
    {
        if ($ordem->formulacao_queijo_id !== null) {
            return ProducaoFormulacaoQueijo::query()
                ->where('id', $ordem->formulacao_queijo_id)
                ->get();
        }

        return collect();
    }

    private function tipoQueijoDosCampos(array $campos): string
    {
        foreach ($campos as $campo) {
            $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));

            if (str_starts_with($rotulo, 'pecas ')) {
                return trim(str_replace('pecas ', '', $rotulo));
            }
        }

        return 'manual';
    }

    private function formatarOrdem(ProducaoOrdemProducao $ordem, Collection $formulacoes): array
    {
        return [
            'id' => $ordem->id,
            'codigo_ordem' => $ordem->codigo_ordem,
            'data' => optional($ordem->data_ordem)->toDateString(),
            'manual' => $ordem->origem === 'manual',
            'origem' => $ordem->origem,
            'status' => $ordem->status ?? 'rascunho',
            'total_formulacoes' => $formulacoes->count(),
            'campos' => array_values(is_array($ordem->campos_json) ? $ordem->campos_json : []),
            'formulacoes' => $this->formatarFormulacoes($formulacoes),
        ];
    }

    private function formatarFormulacoes(Collection $formulacoes): array
    {
        return $formulacoes->map(fn (ProducaoFormulacaoQueijo $item): array => [
            'id' => $item->id,
            'codigo_formulacao' => $item->codigo_formulacao,
            'tipo_queijo' => $item->tipo_queijo,
            'lote_queijo' => $item->lote_queijo,
            'quantidade_leite' => (float) ($item->quantidade_leite ?? 0),
            'status' => $item->status,
        ])->values()->all();
    }

    private function camposAutomaticos(Collection $formulacoes): array
    {
        $valores = $this->modeloVazio();

        foreach ($formulacoes as $formulacao) {
            $valores = $this->somarValoresOp($valores, $this->valoresDaFormulacao($formulacao));
        }

        return $this->camposDoModelo($valores);
    }

    private function camposDaFormulacao(ProducaoFormulacaoQueijo $formulacao): array
    {
        return $this->camposDoModelo($this->valoresDaFormulacao($formulacao));
    }

    private function valoresDaFormulacao(ProducaoFormulacaoQueijo $formulacao): array
    {
        $valores = $this->modeloVazio();
        $valores['producao_data'] = optional($formulacao->data_formulacao)->format('d/m/Y') ?? '';
        $valores['lts_produzidos_total'] = $this->valor((float) ($formulacao->quantidade_leite ?? 0), ' L');

        $campoQueijo = $this->campoQueijo((string) $formulacao->tipo_queijo);
        if ($campoQueijo !== null) {
            $valores[$campoQueijo] = self::CAMPO_EM_BRANCO;
        }

        foreach (($formulacao->insumos_json ?? []) as $insumo) {
            $quantidade = (float) ($insumo['quantidade'] ?? 0);
            if ($quantidade <= 0) {
                continue;
            }

            $campo = $this->campoInsumo((string) ($insumo['tipo_insumo'] ?? ''), (string) ($insumo['nome_insumo'] ?? ''));
            if ($campo === null) {
                continue;
            }

            $unidade = $this->unidadePadrao($campo, (string) ($insumo['unidade'] ?? ''));
            $quantidadeBase = $this->converterQuantidade($quantidade, (string) ($insumo['unidade'] ?? ''), $unidade);
            $valorAtual = $this->numeroDeCampo((string) $valores[$campo]);
            $valores[$campo] = $this->valor($valorAtual + $quantidadeBase, ' ' . $unidade);
        }

        return $valores;
    }

    private function modeloVazio(): array
    {
        $valores = [];

        foreach (self::CAMPOS_OP as $campo) {
            $valores[$campo['chave']] = '';
        }

        return $valores;
    }

    private function camposDoModelo(array $valores): array
    {
        return collect(self::CAMPOS_OP)
            ->filter(fn (array $campo): bool => (string) ($valores[$campo['chave']] ?? '') !== '')
            ->map(fn (array $campo): array => [
                'rotulo' => $campo['rotulo'],
                'valor' => $valores[$campo['chave']] === self::CAMPO_EM_BRANCO ? '' : (string) ($valores[$campo['chave']] ?? ''),
            ])
            ->values()
            ->all();
    }

    private function somarValoresOp(array $base, array $adicao): array
    {
        foreach ($adicao as $campo => $valor) {
            if ($valor === '') {
                continue;
            }

            if ($campo === 'producao_data') {
                $base[$campo] = $base[$campo] !== '' ? $base[$campo] : $valor;
                continue;
            }

            if ($valor === self::CAMPO_EM_BRANCO) {
                $base[$campo] = self::CAMPO_EM_BRANCO;
                continue;
            }

            if ($base[$campo] === '' || $base[$campo] === self::CAMPO_EM_BRANCO) {
                $base[$campo] = $valor;
                continue;
            }

            $baseNumero = $this->numeroDeCampo((string) $base[$campo]);
            $adicaoNumero = $this->numeroDeCampo((string) $valor);

            if ($baseNumero > 0 || $adicaoNumero > 0) {
                $sufixo = preg_replace('/^[0-9.,]+\\s*/', '', (string) $valor);
                $base[$campo] = $this->valor($baseNumero + $adicaoNumero, $sufixo !== '' ? ' ' . trim($sufixo) : '');
            }
        }

        return $base;
    }

    private function campoQueijo(string $tipoQueijo): ?string
    {
        $tipo = $this->normalizar($tipoQueijo);

        return match (true) {
            str_contains($tipo, 'f4') => 'pecas_f4',
            str_contains($tipo, 'f1') => 'pecas_f1',
            str_contains($tipo, 'f6') => 'pecas_f6',
            str_contains($tipo, 'mussarela') => 'pecas_f4',
            str_contains($tipo, 'colonial') => 'pecas_colonial',
            str_contains($tipo, 'coalho') => 'pecas_coalho',
            str_contains($tipo, 'provolone') => 'pecas_provolone',
            str_contains($tipo, 'gouda') => 'pecas_gouda',
            str_contains($tipo, 'gruyere') => 'pecas_gruyere',
            str_contains($tipo, 'prato') => 'pecas_prato',
            default => null,
        };
    }

    private function campoInsumo(string $tipo, string $nome): ?string
    {
        $base = $this->normalizar($nome !== '' ? $nome : $tipo);

        return match (true) {
            str_contains($base, 'cloreto') => 'cloreto_calcio',
            str_contains($base, 'coalho') => 'coalho',
            str_contains($base, 'mvd') => 'fermento_mvd',
            str_contains($base, 'fast') => 'fermento_fast',
            str_contains($base, 'fermento') => 'fermento_1',
            str_contains($base, 'corante') => 'corante',
            default => null,
        };
    }

    private function unidadePadrao(string $campo, string $unidade): string
    {
        return match ($campo) {
            'fermento_mvd', 'fermento_fast', 'fermento_1', 'fermento_2' => 'g',
            'coalho', 'cloreto_calcio', 'corante' => 'ml',
            default => $unidade !== '' ? strtolower($unidade) : 'un',
        };
    }

    private function catalogoQueijos(): array
    {
        if (! $this->tabelaExiste('producao_queijos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('producao_queijos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(function (object $queijo): array {
                $nome = (string) ($queijo->nome ?? '');
                $slug = (string) ($queijo->slug ?? $nome);

                return [
                    'id' => (int) ($queijo->id ?? 0),
                    'nome' => $nome,
                    'slug' => $slug,
                    'codigo_balanca' => (string) ($queijo->codigo_balanca ?? ''),
                    'op_rotulo' => $this->rotuloCampo($this->campoQueijo($slug !== '' ? $slug : $nome)),
                ];
            })
            ->filter(fn (array $queijo): bool => $queijo['nome'] !== '' && $queijo['op_rotulo'] !== null)
            ->values()
            ->all();
    }

    private function catalogoInsumos(): array
    {
        if (! $this->tabelaExiste('insumos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('insumos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(function (object $insumo): array {
                $nome = (string) ($insumo->nome ?? '');
                $campo = $this->campoInsumo('', $nome);

                return [
                    'id' => (int) ($insumo->id ?? 0),
                    'nome' => $nome,
                    'unidade' => (string) ($insumo->un_base ?? ''),
                    'op_rotulo' => $this->rotuloCampo($campo),
                ];
            })
            ->filter(fn (array $insumo): bool => $insumo['nome'] !== '' && $insumo['op_rotulo'] !== null)
            ->values()
            ->all();
    }

    private function rotuloCampo(?string $chave): ?string
    {
        if ($chave === null) {
            return null;
        }

        foreach (self::CAMPOS_OP as $campo) {
            if ($campo['chave'] === $chave) {
                return $campo['rotulo'];
            }
        }

        return null;
    }

    private function buscarQueijo(ProducaoFormulacaoQueijo $formulacao): ?array
    {
        $tipo = $this->normalizar((string) $formulacao->tipo_queijo);

        if (! $this->tabelaExiste('producao_queijos')) {
            return null;
        }

        $queijos = DB::connection('raw')
            ->table('producao_queijos')
            ->where('ativo', 1)
            ->get();

        foreach ($queijos as $queijo) {
            if ($this->normalizar((string) $queijo->slug) === $tipo || $this->normalizar((string) $queijo->nome) === $tipo) {
                return ['codigo_balanca' => (string) $queijo->codigo_balanca];
            }
        }

        return null;
    }

    private function tabelaExiste(string $tabela): bool
    {
        return DB::connection('raw')
            ->table('information_schema.TABLES')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $tabela)
            ->exists();
    }

    private function converterQuantidade(float $quantidade, string $origem, string $destino): float
    {
        $origem = strtolower($origem);
        $destino = strtolower($destino);

        if ($origem === $destino || $origem === '') {
            return $quantidade;
        }
        if ($origem === 'l' && $destino === 'ml') {
            return $quantidade * 1000;
        }
        if ($origem === 'ml' && $destino === 'l') {
            return $quantidade / 1000;
        }
        if ($origem === 'kg' && $destino === 'g') {
            return $quantidade * 1000;
        }
        if ($origem === 'g' && $destino === 'kg') {
            return $quantidade / 1000;
        }

        return $quantidade;
    }

    private function valor(float $valor, string $sufixo = ''): string
    {
        if ($valor <= 0) {
            return '';
        }

        $formatado = rtrim(rtrim(number_format($valor, 2, ',', '.'), '0'), ',');

        return $formatado . $sufixo;
    }

    private function numeroDeCampo(string $valor): float
    {
        $numero = preg_replace('/[^0-9,.-]/', '', $valor);
        $numero = str_replace('.', '', (string) $numero);
        $numero = str_replace(',', '.', $numero);

        return (float) $numero;
    }

    private function gerarCodigo(string $data, ?Collection $formulacoes = null): string
    {
        $formulacoes ??= ProducaoFormulacaoQueijo::query()
            ->whereDate('data_formulacao', $data)
            ->where('status', '!=', 'cancelada')
            ->orderBy('numero_queijomatic')
            ->orderBy('id')
            ->get();

        $base = $formulacoes->first();

        return $base instanceof ProducaoFormulacaoQueijo
            ? $this->gerarCodigoDaFormulacao($base)
            : 'op' . preg_replace('/[^0-9]/', '', $data);
    }

    private function gerarCodigoDaFormulacao(ProducaoFormulacaoQueijo $formulacao): string
    {
        $queijo = $this->buscarQueijo($formulacao);
        $produto = preg_replace('/[^a-z0-9]/', '', strtolower((string) ($queijo['codigo_balanca'] ?? '0')));
        $lote = preg_replace('/[^a-z0-9]/', '', strtolower((string) $formulacao->lote_queijo));

        return 'op' . $produto . ($lote !== '' ? $lote : (string) $formulacao->id);
    }

    private function normalizarCodigo(string $codigo): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower(trim($codigo))) ?? '';
    }

    private function normalizar(string $valor): string
    {
        $normalizado = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($valor));

        return strtolower($normalizado !== false ? $normalizado : trim($valor));
    }
}
