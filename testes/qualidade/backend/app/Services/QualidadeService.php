<?php

namespace App\Services;

use App\Models\ProdutorQualidade;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QualidadeService
{
    private const ANALISES_TABLE = 'resultadosanalises';

    public function overview(): array
    {
        $produtoresAtivos = ProdutorQualidade::query()
            ->where('ativo', 1)
            ->count();

        if (! $this->analisesDisponiveis()) {
            return [
                'produtores_ativos' => $produtoresAtivos,
                'analises_validadas' => 0,
                'ultima_analise' => null,
                'periodo_atual' => now()->format('m/Y'),
                'produtores_com_analise' => 0,
                'produtores_sem_analise' => $produtoresAtivos,
            ];
        }

        $analises = $this->analisesBase();
        $produtoresComAnalise = (clone $analises)->distinct('ra.produtor_codigo')->count('ra.produtor_codigo');

        return [
            'produtores_ativos' => $produtoresAtivos,
            'analises_validadas' => (clone $analises)->count(),
            'ultima_analise' => (clone $analises)->max('ra.data'),
            'periodo_atual' => now()->format('m/Y'),
            'produtores_com_analise' => $produtoresComAnalise,
            'produtores_sem_analise' => max($produtoresAtivos - $produtoresComAnalise, 0),
        ];
    }

    public function produtores(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $query = ProdutorQualidade::query()
            ->select([
                'codigo',
                'nome',
                'cidade',
                'rota',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
            ])
            ->orderBy('nome');

        $this->aplicarFiltrosProdutor($query, $request);

        $page = $query->paginate($perPage);
        $produtores = collect($page->items());
        $ultimasAnalises = $this->ultimasAnalisesPorProdutor(
            $produtores->pluck('codigo')->map(fn ($codigo): string => (string) $codigo)->all()
        );

        return [
            'items' => $produtores
                ->map(fn (ProdutorQualidade $produtor): array => [
                    ...$this->formatarProdutor($produtor),
                    'ultima_analise' => $ultimasAnalises[(string) $produtor->codigo] ?? null,
                ])
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function analises(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 100);

        if (! $this->analisesDisponiveis()) {
            return $this->paginaVazia($perPage);
        }

        $query = $this->analisesBase()
            ->orderByDesc('ra.data')
            ->orderBy('p.nome')
            ->orderByDesc('ra.id');

        $this->aplicarFiltrosAnalise($query, $request);

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($analise): array => $this->formatarAnalise($analise))
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

        $analisesRecentes = $this->analisesRecentesDoProdutor($codigo, 5);

        return [
            'produtor' => $this->formatarProdutor($produtor),
            'resumo' => $this->resumoAnalisesDoProdutor($codigo),
            'ultima_analise' => $analisesRecentes[0] ?? null,
            'analises_recentes' => $analisesRecentes,
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

        if (! $this->analisesDisponiveis()) {
            return $this->paginaVazia($perPage);
        }

        $page = $this->analisesBase()
            ->where('ra.produtor_codigo', $codigo)
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($analise): array => $this->formatarAnalise($analise))
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
                'analises' => $this->analisesDisponiveis() ? $this->analisesBase()->count() : 0,
            ],
            'rotas' => ProdutorQualidade::query()
                ->whereNotNull('rota')
                ->where('rota', '<>', '')
                ->distinct()
                ->orderBy('rota')
                ->pluck('rota')
                ->values()
                ->all(),
            'ultima_analise' => $this->analisesDisponiveis() ? $this->analisesBase()->max('ra.data') : null,
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
                $query->where('codigo', 'like', "%{$search}%")
                    ->orWhere('nome', 'like', "%{$search}%")
                    ->orWhere('cidade', 'like', "%{$search}%")
                    ->orWhere('rota', 'like', "%{$search}%");
            });
        }

        if ($request->has('ativo')) {
            $query->where('ativo', $request->boolean('ativo') ? 1 : 0);
        }

        if ($request->filled('rota')) {
            $query->where('rota', (string) $request->query('rota'));
        }
    }

    private function aplicarFiltrosAnalise($query, Request $request): void
    {
        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query->where('ra.produtor_codigo', 'like', "%{$search}%")
                    ->orWhere('p.nome', 'like', "%{$search}%")
                    ->orWhere('p.cidade', 'like', "%{$search}%");
            });
        }

        if ($request->filled('produtor_codigo')) {
            $query->where('ra.produtor_codigo', (string) $request->query('produtor_codigo'));
        }

        if ($request->filled('data_inicio')) {
            $query->whereDate('ra.data', '>=', (string) $request->query('data_inicio'));
        }

        if ($request->filled('data_fim')) {
            $query->whereDate('ra.data', '<=', (string) $request->query('data_fim'));
        }
    }

    private function analisesBase()
    {
        return DB::connection('raw')
            ->table(self::ANALISES_TABLE . ' as ra')
            ->leftJoin('produtores as p', 'p.codigo', '=', 'ra.produtor_codigo')
            ->select([
                'ra.id',
                'ra.produtor_codigo',
                'p.nome as produtor_nome',
                'p.cidade as produtor_cidade',
                'ra.data',
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
                'ra.created_at',
                'ra.updated_at',
            ]);
    }

    private function analisesDisponiveis(): bool
    {
        return Schema::connection('raw')->hasTable(self::ANALISES_TABLE);
    }

    private function analisesRecentesDoProdutor(string $codigo, int $limit): array
    {
        if (! $this->analisesDisponiveis()) {
            return [];
        }

        return $this->analisesBase()
            ->where('ra.produtor_codigo', $codigo)
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->limit($limit)
            ->get()
            ->map(fn ($analise): array => $this->formatarAnalise($analise))
            ->values()
            ->all();
    }

    private function resumoAnalisesDoProdutor(string $codigo): array
    {
        if (! $this->analisesDisponiveis()) {
            return [
                'total_analises' => 0,
                'ultima_analise' => null,
                'media_gordura' => null,
                'media_proteina' => null,
                'media_ccs' => null,
                'media_ufc' => null,
            ];
        }

        $resumo = DB::connection('raw')
            ->table(self::ANALISES_TABLE)
            ->where('produtor_codigo', $codigo)
            ->selectRaw('COUNT(*) as total_analises')
            ->selectRaw('MAX(data) as ultima_analise')
            ->selectRaw('AVG(gordura) as media_gordura')
            ->selectRaw('AVG(proteina) as media_proteina')
            ->selectRaw('AVG(ccs) as media_ccs')
            ->selectRaw('AVG(ufc) as media_ufc')
            ->first();

        return [
            'total_analises' => (int) ($resumo->total_analises ?? 0),
            'ultima_analise' => $resumo->ultima_analise ?? null,
            'media_gordura' => $resumo->media_gordura !== null ? round((float) $resumo->media_gordura, 2) : null,
            'media_proteina' => $resumo->media_proteina !== null ? round((float) $resumo->media_proteina, 2) : null,
            'media_ccs' => $resumo->media_ccs !== null ? round((float) $resumo->media_ccs) : null,
            'media_ufc' => $resumo->media_ufc !== null ? round((float) $resumo->media_ufc) : null,
        ];
    }

    private function ultimasAnalisesPorProdutor(array $codigos): array
    {
        if ($codigos === [] || ! $this->analisesDisponiveis()) {
            return [];
        }

        return $this->analisesBase()
            ->whereIn('ra.produtor_codigo', $codigos)
            ->orderBy('ra.produtor_codigo')
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->get()
            ->unique(fn ($analise): string => (string) $analise->produtor_codigo)
            ->mapWithKeys(fn ($analise): array => [
                (string) $analise->produtor_codigo => $this->formatarAnalise($analise),
            ])
            ->all();
    }

    private function paginaVazia(int $perPage): array
    {
        return [
            'items' => [],
            'pagination' => [
                'current_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
            ],
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

    private function formatarAnalise($analise): array
    {
        return [
            'id' => (int) $analise->id,
            'produtor_codigo' => (string) $analise->produtor_codigo,
            'produtor_nome' => $analise->produtor_nome,
            'produtor_cidade' => $analise->produtor_cidade,
            'data' => (string) $analise->data,
            'gordura' => $analise->gordura !== null ? (float) $analise->gordura : null,
            'proteina' => $analise->proteina !== null ? (float) $analise->proteina : null,
            'lactose' => $analise->lactose !== null ? (float) $analise->lactose : null,
            'solidos_totais' => $analise->solidos_totais !== null ? (float) $analise->solidos_totais : null,
            'ccs' => $analise->ccs !== null ? (int) $analise->ccs : null,
            'ufc' => $analise->ufc !== null ? (int) $analise->ufc : null,
            'caseina' => $analise->caseina !== null ? (float) $analise->caseina : null,
            'sng' => $analise->sng !== null ? (float) $analise->sng : null,
            'ureia' => $analise->ureia !== null ? (float) $analise->ureia : null,
            'antibiotico' => $analise->antibiotico !== null ? (float) $analise->antibiotico : null,
            'bacteria' => $analise->bacteria !== null ? (float) $analise->bacteria : null,
            'temperatura' => $analise->temperatura !== null ? (float) $analise->temperatura : null,
        ];
    }
}
