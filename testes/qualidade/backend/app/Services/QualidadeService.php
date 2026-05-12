<?php

namespace App\Services;

use App\Models\ProdutorQualidade;
use App\Models\ResultadoAnalise;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QualidadeService
{
    public function overview(): array
    {
        $produtoresAtivos = ProdutorQualidade::query()
            ->where('ativo', 1)
            ->count();

        $analisesValidadas = ResultadoAnalise::query()->count();
        $ultimaAnalise = ResultadoAnalise::query()->max('data');
        $produtoresComAnalise = ResultadoAnalise::query()
            ->distinct('produtor_codigo')
            ->count('produtor_codigo');

        return [
            'produtores_ativos' => $produtoresAtivos,
            'analises_validadas' => $analisesValidadas,
            'ultima_analise' => $ultimaAnalise,
            'periodo_atual' => now()->format('m/Y'),
            'produtores_com_analise' => $produtoresComAnalise,
            'produtores_sem_analise' => max($produtoresAtivos - $produtoresComAnalise, 0),
        ];
    }

    public function produtores(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $cleanDatabase = $this->cleanDatabase();

        $query = DB::connection('raw')
            ->table('produtores as p')
            ->leftJoin(DB::raw("{$cleanDatabase}.resultadosanalises as ra"), function ($join) use ($cleanDatabase): void {
                $join->on('ra.produtor_codigo', '=', 'p.codigo')
                    ->whereRaw("ra.data = (
                        SELECT MAX(ra2.data)
                        FROM {$cleanDatabase}.resultadosanalises ra2
                        WHERE ra2.produtor_codigo = p.codigo
                    )");
            })
            ->select([
                'p.codigo',
                'p.nome',
                'p.cidade',
                'p.rota',
                'p.ativo',
                'p.novo',
                'p.data_cadastro',
                'p.data_inativacao',
                'ra.data as analise_data',
                'ra.gordura',
                'ra.proteina',
                'ra.lactose',
                'ra.solidos_totais',
                'ra.ccs',
                'ra.ufc',
                'ra.caseina',
                'ra.sng',
                'ra.ureia',
                'ra.antibiotico',
                'ra.bacteria',
                'ra.temperatura',
            ])
            ->orderBy('p.nome');

        $this->aplicarFiltrosProdutor($query, $request);

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (object $row): array => $this->formatarProdutorComAnalise($row))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function produtor(string $codigo): ?array
    {
        $produtor = ProdutorQualidade::query()
            ->where('codigo', $codigo)
            ->first();

        if ($produtor === null) {
            return null;
        }

        $analises = ResultadoAnalise::query()
            ->where('produtor_codigo', $codigo)
            ->orderByDesc('data')
            ->limit(12)
            ->get();

        $ultimaAnalise = $analises->first();

        return [
            'produtor' => $this->formatarProdutor($produtor),
            'resumo' => [
                'total_analises' => $analises->count(),
                'ultima_analise' => $ultimaAnalise?->data?->format('Y-m-d'),
                'media_gordura' => $analises->avg('gordura'),
                'media_proteina' => $analises->avg('proteina'),
                'media_ccs' => $analises->avg('ccs'),
                'media_ufc' => $analises->avg('ufc'),
            ],
            'ultima_analise' => $ultimaAnalise ? $this->formatarAnalise($ultimaAnalise) : null,
            'analises_recentes' => $analises
                ->map(fn (ResultadoAnalise $analise): array => $this->formatarAnalise($analise))
                ->values()
                ->all(),
        ];
    }

    public function analisesDoProdutor(Request $request, string $codigo): ?array
    {
        $exists = ProdutorQualidade::query()
            ->where('codigo', $codigo)
            ->exists();

        if (! $exists) {
            return null;
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $page = ResultadoAnalise::query()
            ->where('produtor_codigo', $codigo)
            ->orderByDesc('data')
            ->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (ResultadoAnalise $analise): array => $this->formatarAnalise($analise))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function relatoriosResumo(): array
    {
        return [
            'totais' => [
                'ativos' => ProdutorQualidade::query()->where('ativo', 1)->count(),
                'inativos' => ProdutorQualidade::query()->where('ativo', 0)->count(),
                'novos' => ProdutorQualidade::query()->where('novo', 1)->count(),
                'analises' => ResultadoAnalise::query()->count(),
            ],
            'rotas' => ProdutorQualidade::query()
                ->whereNotNull('rota')
                ->where('rota', '<>', '')
                ->distinct()
                ->orderBy('rota')
                ->pluck('rota')
                ->values()
                ->all(),
            'ultima_analise' => ResultadoAnalise::query()->max('data'),
        ];
    }

    public function relatoriosProdutores(Request $request): array
    {
        $tipo = (string) $request->query('tipo', 'ativos');
        if (! in_array($tipo, ['ativos', 'novos', 'inativos'], true)) {
            $tipo = 'ativos';
        }

        $query = ProdutorQualidade::query()
            ->select([
                'codigo',
                'nome',
                'cidade',
                'rota',
                'cpf_cnpj',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
            ]);

        if ($tipo === 'ativos') {
            $query->where('ativo', 1);
        }

        if ($tipo === 'novos') {
            $query->where('novo', 1);
        }

        if ($tipo === 'inativos') {
            $query->where('ativo', 0);
        }

        if ($request->filled('rota')) {
            $query->where('rota', (string) $request->query('rota'));
        }

        return [
            'tipo' => $tipo,
            'totais' => [
                'ativos' => ProdutorQualidade::query()->where('ativo', 1)->count(),
                'inativos' => ProdutorQualidade::query()->where('ativo', 0)->count(),
                'novos' => ProdutorQualidade::query()->where('novo', 1)->count(),
            ],
            'opcoes' => [
                'rotas' => ProdutorQualidade::query()
                    ->whereNotNull('rota')
                    ->where('rota', '<>', '')
                    ->distinct()
                    ->orderBy('rota')
                    ->pluck('rota')
                    ->values()
                    ->all(),
            ],
            'items' => $query->orderBy('nome')->get()
                ->map(fn (ProdutorQualidade $produtor): array => $this->formatarProdutor($produtor))
                ->values()
                ->all(),
        ];
    }

    private function aplicarFiltrosProdutor($query, Request $request): void
    {
        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query->where('p.codigo', 'like', "%{$search}%")
                    ->orWhere('p.nome', 'like', "%{$search}%")
                    ->orWhere('p.cidade', 'like', "%{$search}%")
                    ->orWhere('p.rota', 'like', "%{$search}%");
            });
        }

        if ($request->has('ativo')) {
            $query->where('p.ativo', $request->boolean('ativo') ? 1 : 0);
        }

        if ($request->filled('rota')) {
            $query->where('p.rota', (string) $request->query('rota'));
        }
    }

    private function formatarProdutorComAnalise(object $row): array
    {
        return [
            'codigo' => (string) $row->codigo,
            'nome' => (string) $row->nome,
            'cidade' => (string) $row->cidade,
            'rota' => (string) $row->rota,
            'ativo' => (bool) $row->ativo,
            'novo' => (bool) $row->novo,
            'ultima_analise' => $row->analise_data ? [
                'data' => (string) $row->analise_data,
                'gordura' => $row->gordura !== null ? (float) $row->gordura : null,
                'proteina' => $row->proteina !== null ? (float) $row->proteina : null,
                'lactose' => $row->lactose !== null ? (float) $row->lactose : null,
                'solidos_totais' => $row->solidos_totais !== null ? (float) $row->solidos_totais : null,
                'ccs' => $row->ccs !== null ? (int) $row->ccs : null,
                'ufc' => $row->ufc !== null ? (int) $row->ufc : null,
                'caseina' => $row->caseina !== null ? (float) $row->caseina : null,
                'sng' => $row->sng !== null ? (float) $row->sng : null,
                'ureia' => $row->ureia !== null ? (float) $row->ureia : null,
                'antibiotico' => $this->formatarFlag($row->antibiotico),
                'bacteria' => $this->formatarFlag($row->bacteria),
                'temperatura' => $row->temperatura !== null ? (float) $row->temperatura : null,
            ] : null,
        ];
    }

    private function formatarProdutor(ProdutorQualidade $produtor): array
    {
        return [
            'codigo' => (string) $produtor->codigo,
            'nome' => (string) $produtor->nome,
            'cidade' => (string) $produtor->cidade,
            'rota' => (string) $produtor->rota,
            'cpf_cnpj' => $produtor->cpf_cnpj,
            'celular' => $produtor->celular,
            'ativo' => (bool) $produtor->ativo,
            'novo' => (bool) $produtor->novo,
            'data_cadastro' => $produtor->data_cadastro?->format('Y-m-d H:i:s'),
            'data_inativacao' => $produtor->data_inativacao?->format('Y-m-d H:i:s'),
        ];
    }

    private function formatarAnalise(ResultadoAnalise $analise): array
    {
        return [
            'id' => $analise->id,
            'produtor_codigo' => (string) $analise->produtor_codigo,
            'data' => $analise->data?->format('Y-m-d'),
            'gordura' => $analise->gordura,
            'proteina' => $analise->proteina,
            'lactose' => $analise->lactose,
            'solidos_totais' => $analise->solidos_totais,
            'ccs' => $analise->ccs,
            'ufc' => $analise->ufc,
            'caseina' => $analise->caseina,
            'sng' => $analise->sng,
            'ureia' => $analise->ureia,
            'antibiotico' => $this->formatarFlag($analise->antibiotico),
            'bacteria' => $this->formatarFlag($analise->bacteria),
            'temperatura' => $analise->temperatura,
        ];
    }

    private function formatarFlag(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value > 0 ? 'POS' : 'NEG';
        }

        $text = strtoupper(trim((string) $value));

        return match ($text) {
            'POSITIVO', 'POS', '+' => 'POS',
            'NEGATIVO', 'NEG', '-' => 'NEG',
            default => $text !== '' ? $text : null,
        };
    }

    private function cleanDatabase(): string
    {
        return config('database.connections.clean.database', 'santilac_clean');
    }
}
