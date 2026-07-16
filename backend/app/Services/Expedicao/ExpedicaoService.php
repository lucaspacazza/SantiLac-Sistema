<?php

namespace App\Services\Expedicao;

use App\Models\Expedicao\ExpedicaoOrdem;
use App\Models\Expedicao\ExpedicaoOrdemPalete;
use DomainException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ExpedicaoService
{
    private const STATUS_ATIVOS = ['rascunho', 'lancada', 'carregando'];

    public function resumo(): array
    {
        $estoque = $this->consultaEstoque()
            ->whereIn('p.expedicao_status', ['estoque', 'reservado'])
            ->whereNotExists(function (Builder $query): void {
                $query->selectRaw('1')
                    ->from('expedicao_ordem_paletes as eop')
                    ->join('expedicao_ordens as eo', 'eo.id', '=', 'eop.ordem_id')
                    ->whereColumn('eop.palete_id', 'p.id')
                    ->where('eo.status', 'concluida');
            })
            ->get();

        $reservados = ExpedicaoOrdemPalete::query()
            ->join('expedicao_ordens as eo', 'eo.id', '=', 'expedicao_ordem_paletes.ordem_id')
            ->whereIn('eo.status', self::STATUS_ATIVOS)
            ->count();

        $produtos = $estoque
            ->groupBy('produto')
            ->map(fn (Collection $itens, string $produto): array => [
                'produto' => $produto,
                'paletes' => $itens->count(),
                'caixas' => (int) $itens->sum('caixas'),
                'peso_total' => round((float) $itens->sum('peso_total'), 3),
            ])
            ->sortByDesc('peso_total')
            ->values()
            ->all();

        return [
            'totais' => [
                'paletes' => $estoque->count(),
                'caixas' => (int) $estoque->sum('caixas'),
                'peso_total' => round((float) $estoque->sum('peso_total'), 3),
                'reservados' => $reservados,
                'ordens_abertas' => ExpedicaoOrdem::query()->whereIn('status', ['lancada', 'carregando'])->count(),
            ],
            'produtos' => $produtos,
            'ordens_recentes' => $this->ordens(['limite' => 6])['itens'],
        ];
    }

    public function estoque(array $filtros = []): array
    {
        $query = $this->consultaEstoque()
            ->leftJoin('expedicao_ordem_paletes as eop', 'eop.palete_id', '=', 'p.id')
            ->leftJoin('expedicao_ordens as eo', function ($join): void {
                $join->on('eo.id', '=', 'eop.ordem_id')->where('eo.status', '<>', 'cancelada');
            })
            ->addSelect([
                'eo.codigo as ordem_expedicao',
                'eo.status as ordem_status',
            ]);

        $busca = trim((string) ($filtros['busca'] ?? ''));
        if ($busca !== '') {
            $query->where(function (Builder $sub) use ($busca): void {
                $sub->where('l.tipo_queijo', 'like', "%{$busca}%")
                    ->orWhere('l.lote', 'like', "%{$busca}%")
                    ->orWhere('l.codigo_ordem', 'like', "%{$busca}%")
                    ->orWhere('p.etiqueta_token', 'like', "%{$busca}%");
            });
        }

        $produto = trim((string) ($filtros['produto'] ?? ''));
        if ($produto !== '') {
            $query->where('l.tipo_queijo', $produto);
        }

        if (($filtros['disponivel'] ?? false) === true) {
            $query->where('p.expedicao_status', 'estoque')->whereNull('eo.id');
        } else {
            $query->whereIn('p.expedicao_status', ['estoque', 'reservado'])
                ->where(function (Builder $sub): void {
                $sub->whereNull('eo.id')->orWhere('eo.status', '<>', 'concluida');
            });
        }

        $itens = $query->orderBy('l.tipo_queijo')->orderBy('p.id')->get()
            ->map(fn (object $item): array => $this->formatarPalete($item))
            ->values()
            ->all();

        return [
            'itens' => $itens,
            'produtos' => collect($itens)->pluck('produto')->unique()->sort()->values()->all(),
        ];
    }

    public function palete(int $id): array
    {
        $palete = $this->consultaEstoque()->where('p.id', $id)->first();
        if ($palete === null) {
            throw new DomainException('Palete não encontrado.');
        }

        $dados = $this->formatarPalete($palete);
        $dados['lotes'] = $this->lotesDoPalete($id);
        $dados['caixas'] = DB::connection('raw')->table('embalagem_caixas as c')
            ->join('embalagem_lotes as l', 'l.id', '=', 'c.lote_id')
            ->where('c.palete_id', $id)
            ->orderBy('c.id')
            ->get([
                'c.id',
                'c.sequencia',
                'c.codigo_barra',
                'c.peso',
                'l.lote',
                'l.codigo_ordem',
                'c.created_at',
            ])
            ->map(fn (object $caixa): array => [
                'id' => (int) $caixa->id,
                'sequencia' => (int) $caixa->sequencia,
                'codigo_barra' => (string) $caixa->codigo_barra,
                'peso' => (float) $caixa->peso,
                'lote' => (string) $caixa->lote,
                'codigo_ordem' => (string) $caixa->codigo_ordem,
                'registrada_em' => (string) $caixa->created_at,
            ])
            ->all();

        return $dados;
    }

    public function ordens(array $filtros = []): array
    {
        $query = ExpedicaoOrdem::query()->orderByDesc('id');
        $status = trim((string) ($filtros['status'] ?? ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        $busca = trim((string) ($filtros['busca'] ?? ''));
        if ($busca !== '') {
            $query->where(function ($sub) use ($busca): void {
                $sub->where('codigo', 'like', "%{$busca}%")
                    ->orWhere('cliente', 'like', "%{$busca}%")
                    ->orWhere('destino', 'like', "%{$busca}%");
            });
        }

        $limite = min(100, max(1, (int) ($filtros['limite'] ?? 50)));

        return [
            'itens' => $query->limit($limite)->get()->map(fn (ExpedicaoOrdem $ordem): array => $this->formatarOrdem($ordem))->all(),
        ];
    }

    public function ordem(int $id, bool $tablet = false): array
    {
        $ordem = ExpedicaoOrdem::query()->find($id);
        if ($ordem === null) {
            throw new DomainException('Ordem de expedição não encontrada.');
        }

        $dados = $this->formatarOrdem($ordem);
        $usuarios = DB::connection('raw')->table('usuarios')
            ->whereIn('id', array_filter([
                $ordem->criado_por,
                $ordem->lancado_por,
                $ordem->iniciado_por,
                $ordem->concluido_por,
            ]))
            ->pluck('nome', 'id');
        $dados['operadores'] = [
            'criado_por' => $usuarios[$ordem->criado_por] ?? null,
            'lancado_por' => $usuarios[$ordem->lancado_por] ?? null,
            'iniciado_por' => $usuarios[$ordem->iniciado_por] ?? null,
            'concluido_por' => $usuarios[$ordem->concluido_por] ?? null,
        ];
        if ($tablet) {
            unset($dados['cliente'], $dados['destino'], $dados['data_prevista'], $dados['placa'], $dados['motorista'], $dados['observacoes'], $dados['operadores']['criado_por'], $dados['operadores']['lancado_por']);
        }

        $dados['paletes'] = $this->itensOrdem($id);
        $dados['produtos'] = collect($dados['paletes'])
            ->groupBy('produto')
            ->map(fn (Collection $itens, string $produto): array => [
                'produto' => $produto,
                'paletes' => $itens->count(),
                'carregados' => $itens->where('status_carregamento', 'carregado')->count(),
                'peso_total' => round((float) $itens->sum('peso_total'), 3),
            ])
            ->values()
            ->all();

        return $dados;
    }

    public function salvar(array $dados, int $usuarioId, ?int $id = null): array
    {
        return DB::connection('raw')->transaction(function () use ($dados, $usuarioId, $id): array {
            $ordem = $id !== null
                ? ExpedicaoOrdem::query()->where('id', $id)->lockForUpdate()->first()
                : null;

            if ($id !== null && $ordem === null) {
                throw new DomainException('Ordem de expedição não encontrada.');
            }
            if ($ordem !== null && $ordem->status !== 'rascunho') {
                throw new DomainException('Somente ordens em rascunho podem ser editadas.');
            }

            $cliente = trim((string) ($dados['cliente'] ?? ''));
            $destino = trim((string) ($dados['destino'] ?? ''));
            $paletes = array_values(array_unique(array_map('intval', (array) ($dados['paletes'] ?? []))));
            if ($cliente === '' || $destino === '') {
                throw new DomainException('Informe o cliente e o destino.');
            }
            if ($paletes === []) {
                throw new DomainException('Selecione ao menos um palete.');
            }

            $this->validarPaletesSelecionados($paletes, $ordem?->id);

            if ($ordem === null) {
                $ordem = ExpedicaoOrdem::query()->create([
                    'codigo' => $this->proximoCodigo(),
                    'cliente' => $cliente,
                    'destino' => $destino,
                    'criado_por' => $usuarioId,
                    'status' => 'rascunho',
                ]);
            }

            $ordem->forceFill([
                'cliente' => $cliente,
                'destino' => $destino,
                'data_prevista' => $this->valorOuNull($dados['data_prevista'] ?? null),
                'placa' => mb_strtoupper((string) $this->valorOuNull($dados['placa'] ?? null)),
                'motorista' => $this->valorOuNull($dados['motorista'] ?? null),
                'observacoes' => $this->valorOuNull($dados['observacoes'] ?? null),
            ])->save();

            $paletesAnteriores = ExpedicaoOrdemPalete::query()
                ->where('ordem_id', $ordem->id)
                ->pluck('palete_id')
                ->map(fn ($value): int => (int) $value)
                ->all();
            $paletesRemovidos = array_values(array_diff($paletesAnteriores, $paletes));
            if ($paletesRemovidos !== []) {
                DB::connection('raw')->table('embalagem_paletes')
                    ->whereIn('id', $paletesRemovidos)
                    ->where('expedicao_status', 'reservado')
                    ->update(['expedicao_status' => 'estoque']);
            }

            ExpedicaoOrdemPalete::query()->where('ordem_id', $ordem->id)->delete();
            foreach ($paletes as $paleteId) {
                ExpedicaoOrdemPalete::query()->create([
                    'ordem_id' => $ordem->id,
                    'palete_id' => $paleteId,
                    'status' => 'reservado',
                ]);
            }
            DB::connection('raw')->table('embalagem_paletes')
                ->whereIn('id', $paletes)
                ->update(['expedicao_status' => 'reservado']);

            $this->atualizarTotais($ordem);

            return $this->ordem((int) $ordem->id);
        });
    }

    public function lancar(int $id, int $usuarioId): array
    {
        return DB::connection('raw')->transaction(function () use ($id, $usuarioId): array {
            $ordem = ExpedicaoOrdem::query()->where('id', $id)->lockForUpdate()->first();
            if ($ordem === null || $ordem->status !== 'rascunho') {
                throw new DomainException('A ordem precisa estar em rascunho para ser lançada.');
            }

            $paletes = ExpedicaoOrdemPalete::query()->where('ordem_id', $id)->pluck('palete_id')->map(fn ($value): int => (int) $value)->all();
            if ($paletes === []) {
                throw new DomainException('A ordem não possui paletes.');
            }
            $this->validarPaletesFisicos($paletes);
            $reservados = DB::connection('raw')->table('embalagem_paletes')
                ->whereIn('id', $paletes)
                ->where('expedicao_status', 'reservado')
                ->count();
            if ($reservados !== count($paletes)) {
                throw new DomainException('Há paletes que não estão reservados para esta ordem.');
            }

            $ordem->forceFill([
                'status' => 'lancada',
                'lancado_por' => $usuarioId,
                'lancada_at' => now('America/Sao_Paulo'),
            ])->save();

            return $this->ordem($id);
        });
    }

    public function cancelar(int $id): array
    {
        return DB::connection('raw')->transaction(function () use ($id): array {
            $ordem = ExpedicaoOrdem::query()->where('id', $id)->lockForUpdate()->first();
            if ($ordem === null || ! in_array($ordem->status, ['rascunho', 'lancada'], true)) {
                throw new DomainException('Esta ordem não pode mais ser cancelada.');
            }

            $paletes = ExpedicaoOrdemPalete::query()
                ->where('ordem_id', $id)
                ->pluck('palete_id')
                ->map(fn ($value): int => (int) $value)
                ->all();
            ExpedicaoOrdemPalete::query()->where('ordem_id', $id)->delete();
            DB::connection('raw')->table('embalagem_paletes')
                ->whereIn('id', $paletes)
                ->where('expedicao_status', 'reservado')
                ->update(['expedicao_status' => 'estoque']);
            $ordem->forceFill([
                'status' => 'cancelada',
                'cancelada_at' => now('America/Sao_Paulo'),
                'paletes_total' => 0,
                'caixas_total' => 0,
                'peso_total' => 0,
            ])->save();

            return $this->formatarOrdem($ordem);
        });
    }

    public function ordensParaCarregamento(): array
    {
        return [
            'itens' => ExpedicaoOrdem::query()
                ->whereIn('status', ['lancada', 'carregando'])
                ->orderByRaw("FIELD(status, 'carregando', 'lancada')")
                ->orderBy('data_prevista')
                ->orderBy('id')
                ->get()
                ->map(fn (ExpedicaoOrdem $ordem): array => [
                    'id' => (int) $ordem->id,
                    'codigo' => (string) $ordem->codigo,
                    'status' => (string) $ordem->status,
                    'paletes_total' => (int) $ordem->paletes_total,
                    'carregados' => ExpedicaoOrdemPalete::query()->where('ordem_id', $ordem->id)->where('status', 'carregado')->count(),
                    'peso_total' => (float) $ordem->peso_total,
                ])
                ->all(),
        ];
    }

    public function iniciarCarregamento(int $id, int $usuarioId): array
    {
        $ordem = ExpedicaoOrdem::query()->find($id);
        if ($ordem === null || ! in_array($ordem->status, ['lancada', 'carregando'], true)) {
            throw new DomainException('Ordem indisponível para carregamento.');
        }

        if ($ordem->status === 'lancada') {
            $ordem->forceFill([
                'status' => 'carregando',
                'iniciado_por' => $usuarioId,
                'iniciada_at' => now('America/Sao_Paulo'),
            ])->save();
        }

        return $this->ordem($id, true);
    }

    public function escanearPalete(int $id, string $codigo, int $usuarioId): array
    {
        return DB::connection('raw')->transaction(function () use ($id, $codigo, $usuarioId): array {
            $ordem = ExpedicaoOrdem::query()->where('id', $id)->lockForUpdate()->first();
            if ($ordem === null || $ordem->status !== 'carregando') {
                throw new DomainException('Inicie o carregamento antes de escanear.');
            }

            $identificador = $this->extrairToken($codigo);
            $paleteIdCodigoBarras = $this->extrairPaleteIdCodigoBarras($identificador);
            $paleteQuery = DB::connection('raw')->table('embalagem_paletes');

            if ($paleteIdCodigoBarras !== null) {
                $paleteQuery->where('id', $paleteIdCodigoBarras);
            } else {
                $paleteQuery->where('etiqueta_token', $identificador);
            }

            $palete = $paleteQuery->first(['id', 'expedicao_status']);
            if ($palete === null) {
                throw new DomainException('Código de palete inválido.');
            }
            $paleteId = (int) $palete->id;

            $item = ExpedicaoOrdemPalete::query()
                ->where('ordem_id', $id)
                ->where('palete_id', $paleteId)
                ->lockForUpdate()
                ->first();
            if ($item === null) {
                throw new DomainException('Este palete não pertence à ordem selecionada.');
            }
            if ($item->status === 'carregado') {
                throw new DomainException('Este palete já foi conferido.');
            }
            if ((string) $palete->expedicao_status === 'expedido') {
                throw new DomainException('Este palete já foi expedido.');
            }
            if ((string) $palete->expedicao_status === 'estoque') {
                DB::connection('raw')->table('embalagem_paletes')
                    ->where('id', $paleteId)
                    ->update(['expedicao_status' => 'reservado']);
            }

            $item->forceFill([
                'status' => 'carregado',
                'escaneado_por' => $usuarioId,
                'escaneado_at' => now('America/Sao_Paulo'),
            ])->save();

            return $this->ordem($id, true);
        });
    }

    public function concluirCarregamento(int $id, int $usuarioId): array
    {
        return DB::connection('raw')->transaction(function () use ($id, $usuarioId): array {
            $ordem = ExpedicaoOrdem::query()->where('id', $id)->lockForUpdate()->first();
            if ($ordem === null || $ordem->status !== 'carregando') {
                throw new DomainException('Não há carregamento em andamento para concluir.');
            }

            $pendentes = ExpedicaoOrdemPalete::query()->where('ordem_id', $id)->where('status', 'reservado')->count();
            if ($pendentes > 0) {
                throw new DomainException("Ainda há {$pendentes} palete(s) pendente(s).");
            }

            $ordem->forceFill([
                'status' => 'concluida',
                'concluido_por' => $usuarioId,
                'concluida_at' => now('America/Sao_Paulo'),
            ])->save();

            $paletes = ExpedicaoOrdemPalete::query()
                ->where('ordem_id', $id)
                ->pluck('palete_id')
                ->map(fn ($value): int => (int) $value)
                ->all();
            DB::connection('raw')->table('embalagem_paletes')
                ->whereIn('id', $paletes)
                ->update(['expedicao_status' => 'expedido']);

            return $this->ordem($id, true);
        });
    }

    public function relatorio(array $filtros = []): array
    {
        $query = DB::connection('raw')->table('expedicao_ordens as eo')
            ->leftJoin('expedicao_ordem_paletes as eop', 'eop.ordem_id', '=', 'eo.id')
            ->leftJoin('embalagem_paletes as p', 'p.id', '=', 'eop.palete_id')
            ->leftJoin('embalagem_lotes as l', 'l.id', '=', 'p.lote_id')
            ->leftJoin('usuarios as operador_inicio', 'operador_inicio.id', '=', 'eo.iniciado_por')
            ->leftJoin('usuarios as operador_fim', 'operador_fim.id', '=', 'eo.concluido_por')
            ->leftJoin('usuarios as operador_scan', 'operador_scan.id', '=', 'eop.escaneado_por')
            ->where('eo.status', '<>', 'cancelada');

        if (! empty($filtros['inicio'])) {
            $query->whereDate('eo.created_at', '>=', $filtros['inicio']);
        }
        if (! empty($filtros['fim'])) {
            $query->whereDate('eo.created_at', '<=', $filtros['fim']);
        }
        if (! empty($filtros['status'])) {
            $query->where('eo.status', $filtros['status']);
        }

        $linhas = $query->orderByDesc('eo.id')->orderBy('p.id')->get([
            'eo.codigo',
            'eo.cliente',
            'eo.destino',
            'eo.data_prevista',
            'eo.placa',
            'eo.motorista',
            'eo.status',
            'eo.created_at',
            'eo.concluida_at',
            'p.id as palete_id',
            'p.etiqueta_token',
            'p.caixas',
            'p.peso_total',
            'l.tipo_queijo as produto',
            'eop.status as status_carregamento',
            'operador_inicio.nome as operador_inicio',
            'operador_fim.nome as operador_fim',
            'operador_scan.nome as operador_conferencia',
        ])->map(fn (object $item): array => [
            'ordem' => (string) $item->codigo,
            'cliente' => (string) $item->cliente,
            'destino' => (string) $item->destino,
            'data_prevista' => (string) ($item->data_prevista ?? ''),
            'placa' => (string) ($item->placa ?? ''),
            'motorista' => (string) ($item->motorista ?? ''),
            'status' => (string) $item->status,
            'criada_em' => (string) $item->created_at,
            'concluida_em' => (string) ($item->concluida_at ?? ''),
            'palete' => $item->palete_id !== null ? (int) $item->palete_id : null,
            'qr_code' => (string) ($item->etiqueta_token ?? ''),
            'produto' => (string) ($item->produto ?? ''),
            'caixas' => (int) ($item->caixas ?? 0),
            'peso_total' => (float) ($item->peso_total ?? 0),
            'conferencia' => (string) ($item->status_carregamento ?? ''),
            'operador_inicio' => (string) ($item->operador_inicio ?? ''),
            'operador_fim' => (string) ($item->operador_fim ?? ''),
            'operador_conferencia' => (string) ($item->operador_conferencia ?? ''),
        ])->all();

        return ['itens' => $linhas];
    }

    private function consultaEstoque(): Builder
    {
        return DB::connection('raw')->table('embalagem_paletes as p')
            ->join('embalagem_lotes as l', 'l.id', '=', 'p.lote_id')
            ->whereIn('p.status', ['cheio', 'finalizado'])
            ->where('p.caixas', '>', 0)
            ->select([
                'p.id',
                'p.numero',
                'p.caixas',
                'p.peso_total',
                'p.status',
                'p.expedicao_status',
                'p.etiqueta_token',
                'p.etiqueta_status',
                'p.created_at',
                'l.tipo_queijo as produto',
                'l.lote',
                'l.codigo_ordem',
                'l.data_fabricacao',
                'l.data_validade',
            ]);
    }

    private function formatarPalete(object $item): array
    {
        return [
            'id' => (int) $item->id,
            'numero' => (int) $item->numero,
            'produto' => (string) $item->produto,
            'lote' => (string) $item->lote,
            'codigo_ordem' => (string) $item->codigo_ordem,
            'data_fabricacao' => (string) ($item->data_fabricacao ?? ''),
            'data_validade' => (string) ($item->data_validade ?? ''),
            'caixas' => (int) $item->caixas,
            'peso_total' => (float) $item->peso_total,
            'status' => (string) $item->status,
            'expedicao_status' => (string) $item->expedicao_status,
            'etiqueta_token' => (string) ($item->etiqueta_token ?? ''),
            'etiqueta_status' => (string) ($item->etiqueta_status ?? ''),
            'ordem_expedicao' => isset($item->ordem_expedicao) ? (string) $item->ordem_expedicao : null,
            'ordem_status' => isset($item->ordem_status) ? (string) $item->ordem_status : null,
        ];
    }

    private function formatarOrdem(ExpedicaoOrdem $ordem): array
    {
        return [
            'id' => (int) $ordem->id,
            'codigo' => (string) $ordem->codigo,
            'cliente' => (string) $ordem->cliente,
            'destino' => (string) $ordem->destino,
            'data_prevista' => optional($ordem->data_prevista)->toDateString(),
            'placa' => $ordem->placa,
            'motorista' => $ordem->motorista,
            'observacoes' => $ordem->observacoes,
            'status' => (string) $ordem->status,
            'paletes_total' => (int) $ordem->paletes_total,
            'caixas_total' => (int) $ordem->caixas_total,
            'peso_total' => (float) $ordem->peso_total,
            'criada_em' => optional($ordem->created_at)->format('Y-m-d H:i:s'),
            'lancada_em' => optional($ordem->lancada_at)->format('Y-m-d H:i:s'),
            'iniciada_em' => optional($ordem->iniciada_at)->format('Y-m-d H:i:s'),
            'concluida_em' => optional($ordem->concluida_at)->format('Y-m-d H:i:s'),
        ];
    }

    private function itensOrdem(int $ordemId): array
    {
        return DB::connection('raw')->table('expedicao_ordem_paletes as eop')
            ->join('embalagem_paletes as p', 'p.id', '=', 'eop.palete_id')
            ->join('embalagem_lotes as l', 'l.id', '=', 'p.lote_id')
            ->leftJoin('usuarios as operador_scan', 'operador_scan.id', '=', 'eop.escaneado_por')
            ->where('eop.ordem_id', $ordemId)
            ->orderBy('l.tipo_queijo')
            ->orderBy('p.id')
            ->get([
                'p.id',
                'p.numero',
                'p.caixas',
                'p.peso_total',
                'p.etiqueta_token',
                'l.tipo_queijo as produto',
                'l.lote',
                'eop.status as status_carregamento',
                'eop.escaneado_at',
                'operador_scan.nome as operador_conferencia',
            ])
            ->map(fn (object $item): array => [
                'id' => (int) $item->id,
                'numero' => (int) $item->numero,
                'produto' => (string) $item->produto,
                'lote' => (string) $item->lote,
                'caixas' => (int) $item->caixas,
                'peso_total' => (float) $item->peso_total,
                'etiqueta_token' => (string) ($item->etiqueta_token ?? ''),
                'status_carregamento' => (string) $item->status_carregamento,
                'escaneado_em' => (string) ($item->escaneado_at ?? ''),
                'operador_conferencia' => (string) ($item->operador_conferencia ?? ''),
            ])
            ->all();
    }

    private function lotesDoPalete(int $paleteId): array
    {
        return DB::connection('raw')->table('embalagem_caixas as c')
            ->join('embalagem_lotes as l', 'l.id', '=', 'c.lote_id')
            ->where('c.palete_id', $paleteId)
            ->groupBy('l.id', 'l.lote', 'l.codigo_ordem', 'l.data_fabricacao', 'l.data_validade')
            ->orderBy('l.data_fabricacao')
            ->get([
                'l.lote',
                'l.codigo_ordem',
                'l.data_fabricacao',
                'l.data_validade',
                DB::raw('COUNT(c.id) as caixas'),
                DB::raw('SUM(c.peso) as peso_total'),
            ])
            ->map(fn (object $item): array => [
                'lote' => (string) $item->lote,
                'codigo_ordem' => (string) $item->codigo_ordem,
                'data_fabricacao' => (string) ($item->data_fabricacao ?? ''),
                'data_validade' => (string) ($item->data_validade ?? ''),
                'caixas' => (int) $item->caixas,
                'peso_total' => (float) $item->peso_total,
            ])
            ->all();
    }

    private function validarPaletesSelecionados(array $paletes, ?int $ordemId): void
    {
        $this->validarPaletesFisicos($paletes);

        $ocupados = ExpedicaoOrdemPalete::query()
            ->whereIn('palete_id', $paletes)
            ->when($ordemId !== null, fn ($query) => $query->where('ordem_id', '<>', $ordemId))
            ->count();
        if ($ocupados > 0) {
            throw new DomainException('Um ou mais paletes já pertencem a outra ordem.');
        }
    }

    private function validarPaletesFisicos(array $paletes): void
    {
        $validos = DB::connection('raw')->table('embalagem_paletes')
            ->whereIn('id', $paletes)
            ->whereIn('status', ['cheio', 'finalizado'])
            ->where('caixas', '>', 0)
            ->whereIn('expedicao_status', ['estoque', 'reservado'])
            ->whereNotNull('etiqueta_token')
            ->lockForUpdate()
            ->count();
        if ($validos !== count($paletes)) {
            throw new DomainException('Há paletes indisponíveis ou sem etiqueta na seleção.');
        }
    }

    private function atualizarTotais(ExpedicaoOrdem $ordem): void
    {
        $totais = DB::connection('raw')->table('expedicao_ordem_paletes as eop')
            ->join('embalagem_paletes as p', 'p.id', '=', 'eop.palete_id')
            ->where('eop.ordem_id', $ordem->id)
            ->selectRaw('COUNT(*) as paletes, COALESCE(SUM(p.caixas), 0) as caixas, COALESCE(SUM(p.peso_total), 0) as peso')
            ->first();

        $ordem->forceFill([
            'paletes_total' => (int) ($totais->paletes ?? 0),
            'caixas_total' => (int) ($totais->caixas ?? 0),
            'peso_total' => (float) ($totais->peso ?? 0),
        ])->save();
    }

    private function proximoCodigo(): string
    {
        $prefixo = 'EXP-'.now('America/Sao_Paulo')->format('Ymd').'-';
        $ultimo = (string) ExpedicaoOrdem::query()->where('codigo', 'like', $prefixo.'%')->max('codigo');
        $sequencia = $ultimo !== '' ? ((int) substr($ultimo, -4)) + 1 : 1;

        return $prefixo.str_pad((string) $sequencia, 4, '0', STR_PAD_LEFT);
    }

    private function extrairToken(string $codigo): string
    {
        $valor = preg_replace('/[\x00-\x1F\x7F]/', '', trim($codigo)) ?? '';
        if ($valor === '') {
            throw new DomainException('Escaneie o código do palete.');
        }

        $path = parse_url($valor, PHP_URL_PATH);
        if (is_string($path) && str_contains($path, '/')) {
            $partes = array_values(array_filter(explode('/', trim($path, '/'))));
            $ultimo = (string) end($partes);
            if (in_array($ultimo, ['visualizar', 'resumo'], true) && count($partes) > 1) {
                $valor = (string) $partes[count($partes) - 2];
            } else {
                $valor = $ultimo;
            }
        }

        return $valor;
    }

    private function extrairPaleteIdCodigoBarras(string $identificador): ?int
    {
        $valor = preg_replace('/[\x00-\x1F\x7F]/', '', trim($identificador)) ?? '';
        $valor = preg_replace('/^\]C[0-2]/i', '', $valor) ?? $valor;

        if (preg_match('/^(?:PAL-)?([0-9]+)$/i', $valor, $partes) !== 1) {
            return null;
        }

        $id = filter_var($partes[1], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return is_int($id) ? $id : null;
    }

    private function valorOuNull(mixed $valor): ?string
    {
        $texto = trim((string) $valor);

        return $texto !== '' ? $texto : null;
    }
}
