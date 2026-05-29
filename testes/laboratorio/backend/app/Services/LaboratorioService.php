<?php

namespace App\Services;

use App\Models\LaboratorioCronograma;
use App\Models\LaboratorioAguaFilagem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LaboratorioService
{
    public function overview(): array
    {
        return [
            'totais' => [
                'cronogramas' => LaboratorioCronograma::query()->count(),
                'agua_filagem' => LaboratorioAguaFilagem::query()->count(),
                'itens_previstos' => $this->contarItensPorStatus('prevista'),
                'itens_atrasados' => $this->contarItensAtrasados(),
            ],
            'submodulos' => [
                [
                    'codigo' => 'cronograma-analises',
                    'nome' => 'Cronograma de Análises',
                    'documento' => 'PLAN_6.1',
                    'descricao' => 'Planejamento anual por produto, mês, tipo de análise e status da coleta.',
                    'rota_preenchimento' => 'preenchimento-cronograma-analises',
                    'rota_listagem' => 'listagem-cronogramas-analises',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'agua-filagem',
                    'nome' => 'Água de Filagem',
                    'documento' => 'PLAN_6.4',
                    'descricao' => 'Monitoramento de acidez, gordura e pH da água de filagem.',
                    'rota_preenchimento' => 'preenchimento-agua-filagem',
                    'rota_listagem' => 'listagem-agua-filagem',
                    'status' => 'ativo',
                ],
            ],
        ];
    }

    public function cronogramas(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = LaboratorioCronograma::query()->orderByDesc('ano')->orderByDesc('id');

        if ($request->filled('ano')) {
            $query->where('ano', (int) $request->query('ano'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (LaboratorioCronograma $cronograma): array => $this->formatarCronograma($cronograma))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function criarCronograma(array $payload, ?int $usuarioId = null): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload, $usuarioId): int {
            $cronograma = LaboratorioCronograma::query()->create([
                'documento_codigo' => 'PLAN_6.1',
                'documento_nome' => 'Cronograma de análises de produtos mensais',
                'documento_revisao' => $payload['documento_revisao'] ?? null,
                'ano' => $payload['ano'],
                'titulo' => $payload['titulo'] ?? 'Cronograma de análises de produtos mensais',
                'responsavel_tecnico_id' => $usuarioId,
                'status' => $payload['status'] ?? 'rascunho',
                'observacoes' => $payload['observacoes'] ?? null,
                'itens_json' => array_values($payload['itens'] ?? []),
            ]);

            return (int) $cronograma->id;
        });

        return $this->cronograma($id);
    }

    public function cronograma(int $id): ?array
    {
        $cronograma = LaboratorioCronograma::query()->where('id', $id)->first();

        if ($cronograma === null) {
            return null;
        }

        return $this->formatarCronograma($cronograma);
    }

    public function aguaFilagem(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = LaboratorioAguaFilagem::query()->orderByDesc('data_monitoramento')->orderByDesc('id');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('responsavel', 'like', "%{$search}%")
                    ->orWhere('observacoes', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (LaboratorioAguaFilagem $item): array => $this->formatarAguaFilagem($item))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function criarAguaFilagem(array $payload, ?int $usuarioId = null): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload, $usuarioId): int {
            $item = LaboratorioAguaFilagem::query()->create([
                ...$payload,
                'documento_codigo' => 'PLAN_6.4',
                'documento_nome' => 'Monitoramento água de filagem',
                'responsavel_id' => $usuarioId,
                'status' => 'rascunho',
            ]);

            return (int) $item->id;
        });

        return $this->aguaFilagemItem($id);
    }

    public function atualizarAguaFilagem(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        $item = LaboratorioAguaFilagem::query()->where('id', $id)->first();

        if ($item === null) {
            return null;
        }

        if ($item->status === 'finalizada') {
            return false;
        }

        DB::connection('raw')->transaction(function () use ($item, $payload, $usuarioId): void {
            $item->fill([
                ...$payload,
                'responsavel_id' => $usuarioId,
                'status' => 'rascunho',
            ]);
            $item->save();
        });

        return $this->aguaFilagemItem($id);
    }

    public function finalizarAguaFilagem(int $id): ?array
    {
        $item = LaboratorioAguaFilagem::query()->where('id', $id)->first();

        if ($item === null) {
            return null;
        }

        if ($item->status !== 'finalizada') {
            $item->status = 'finalizada';
            $item->save();
        }

        return $this->aguaFilagemItem($id);
    }

    public function aguaFilagemItem(int $id): ?array
    {
        $item = LaboratorioAguaFilagem::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatarAguaFilagem($item);
    }

    private function contarItensPorStatus(string $status): int
    {
        return LaboratorioCronograma::query()
            ->get()
            ->sum(fn (LaboratorioCronograma $cronograma): int => collect($cronograma->itens_json ?? [])
                ->where('status', $status)
                ->count());
    }

    private function contarItensAtrasados(): int
    {
        $today = now('America/Sao_Paulo');

        return LaboratorioCronograma::query()
            ->where('ano', '<=', (int) $today->year)
            ->get()
            ->sum(fn (LaboratorioCronograma $cronograma): int => collect($cronograma->itens_json ?? [])
                ->filter(fn (array $item): bool => (int) ($item['mes'] ?? 0) <= (int) $today->month
                    && (int) ($item['ate_dia'] ?? 15) < (int) $today->day
                    && ($item['status'] ?? 'prevista') === 'prevista')
                ->count());
    }

    private function formatarCronograma(LaboratorioCronograma $cronograma): array
    {
        return [
            'id' => (int) $cronograma->id,
            'documento_codigo' => (string) $cronograma->documento_codigo,
            'documento_revisao' => $cronograma->documento_revisao,
            'ano' => (int) $cronograma->ano,
            'titulo' => (string) $cronograma->titulo,
            'responsavel_tecnico_id' => $cronograma->responsavel_tecnico_id !== null ? (int) $cronograma->responsavel_tecnico_id : null,
            'status' => (string) $cronograma->status,
            'observacoes' => $cronograma->observacoes,
            'itens' => collect($cronograma->itens_json ?? [])
                ->sortBy([['mes', 'asc'], ['produto', 'asc']])
                ->map(fn (array $item, int $index): array => [
                    'id' => $index + 1,
                    'produto' => (string) ($item['produto'] ?? ''),
                    'matriz' => (string) ($item['matriz'] ?? 'outro'),
                    'mes' => (int) ($item['mes'] ?? 1),
                    'tipo_analise' => (string) ($item['tipo_analise'] ?? 'fisico_quimica'),
                    'ate_dia' => (int) ($item['ate_dia'] ?? 15),
                    'laboratorio_destino' => $item['laboratorio_destino'] ?? null,
                    'status' => (string) ($item['status'] ?? 'prevista'),
                    'observacoes' => $item['observacoes'] ?? null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function formatarAguaFilagem(LaboratorioAguaFilagem $item): array
    {
        return [
            'id' => (int) $item->id,
            'documento_codigo' => (string) $item->documento_codigo,
            'data_monitoramento' => optional($item->data_monitoramento)->toDateString(),
            'sequencia' => $item->sequencia !== null ? (int) $item->sequencia : null,
            'hora' => $item->hora,
            'acidez' => $item->acidez !== null ? (float) $item->acidez : null,
            'gordura' => $item->gordura !== null ? (float) $item->gordura : null,
            'ph' => $item->ph !== null ? (float) $item->ph : null,
            'responsavel' => $item->responsavel,
            'status' => (string) $item->status,
            'observacoes' => $item->observacoes,
        ];
    }

}
