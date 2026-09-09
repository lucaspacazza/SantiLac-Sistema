<?php

namespace App\Services\Dashboard;

use App\Models\Expedicao\ExpedicaoOrdem;
use App\Models\Expedicao\ExpedicaoOrdemPalete;
use App\Services\Dashboard\Support\DashboardDateRange;
use App\Services\Expedicao\ExpedicaoService;
use Carbon\CarbonImmutable;

class ExpedicaoIndicadorService
{
    public function __construct(
        private readonly ExpedicaoService $expedicao,
    ) {}

    public function resumo(?DashboardDateRange $range = null): array
    {
        $range ??= DashboardDateRange::from();
        $resumo = $this->expedicao->resumo();
        $totais = $resumo['totais'] ?? [];

        return [
            'totais' => [
                'paletes' => (int) ($totais['paletes'] ?? 0),
                'caixas' => (int) ($totais['caixas'] ?? 0),
                'peso_total' => (float) ($totais['peso_total'] ?? 0),
                'reservados' => (int) ($totais['reservados'] ?? 0),
                'ordens_abertas' => (int) ($totais['ordens_abertas'] ?? 0),
            ],
            'produtos' => collect($resumo['produtos'] ?? [])->map(fn (array $produto): array => [
                'produto' => (string) ($produto['produto'] ?? ''),
                'paletes' => (int) ($produto['paletes'] ?? 0),
                'caixas' => (int) ($produto['caixas'] ?? 0),
                'peso_total' => (float) ($produto['peso_total'] ?? 0),
            ])->values()->all(),
            ...$this->detail($range),
        ];
    }

    private function detail(DashboardDateRange $range): array
    {
        $now = CarbonImmutable::now(config('app.timezone'));
        $stock = collect($this->expedicao->estoque()['itens'] ?? []);
        $productStock = $stock->groupBy('produto')->map(function ($items, string $product) use ($now): array {
            $expirationLimit = $now->addDays(7)->toDateString();
            $physicalWeight = (float) $items->sum('peso_total');
            $weightedAge = (float) $items->sum(function (array $item) use ($now): float {
                $date = trim((string) ($item['data_fabricacao'] ?? ''));
                $age = $date === '' ? 0 : max(0, (int) CarbonImmutable::parse($date)->diffInDays($now));

                return $age * (float) ($item['peso_total'] ?? 0);
            });

            return [
                'product' => $this->displayName($product),
                // O reservado continua fisicamente no estoque; "available" é o saldo físico total.
                'available' => round($physicalWeight, 3),
                'reserved' => round((float) $items->where('expedicao_status', 'reservado')->sum('peso_total'), 3),
                'agingDays' => $physicalWeight > 0 ? round($weightedAge / $physicalWeight, 1) : 0.0,
                'expiringKg' => round((float) $items->filter(function (array $item) use ($expirationLimit): bool {
                    $date = trim((string) ($item['data_validade'] ?? ''));
                    return $date !== '' && $date <= $expirationLimit;
                })->sum('peso_total'), 3),
            ];
        })->values()->all();

        $orders = ExpedicaoOrdem::query()->where('status', '<>', 'cancelada')
            ->where(function ($query) use ($range): void {
                $query->whereBetween('data_prevista', [$range->startDate(), $range->endDate()])
                    ->orWhereBetween('concluida_at', [$range->start->startOfDay(), $range->end->endOfDay()]);
            })->orderByDesc('data_prevista')->orderByDesc('id')->limit(100)->get();
        $loaded = ExpedicaoOrdemPalete::query()->whereIn('ordem_id', $orders->pluck('id'))
            ->where('status', 'carregado')->selectRaw('ordem_id, COUNT(*) AS total')
            ->groupBy('ordem_id')->pluck('total', 'ordem_id');
        $shipments = $orders->map(function (ExpedicaoOrdem $order) use ($loaded): array {
            $total = max((int) $order->paletes_total, 0);
            $done = (int) ($loaded[(int) $order->id] ?? 0);
            return [
                'id' => (string) $order->codigo,
                'client' => (string) $order->cliente,
                'destination' => (string) $order->destino,
                'date' => optional($order->data_prevista)->toDateString() ?? substr((string) $order->created_at, 0, 10),
                'kg' => round((float) $order->peso_total, 3),
                'status' => match ((string) $order->status) {
                    'concluida' => 'Concluída',
                    'carregando' => 'Carregando',
                    default => 'Programada',
                },
                'progress' => (string) $order->status === 'concluida' ? 100 : ($total > 0 ? round(($done / $total) * 100, 1) : 0),
            ];
        })->values()->all();
        $dispatched = $orders->where('status', 'concluida')->groupBy(
            fn (ExpedicaoOrdem $order): string => optional($order->concluida_at)->toDateString() ?? optional($order->data_prevista)->toDateString() ?? ''
        )->map(fn ($items, string $date): array => ['date' => $date, 'kg' => round((float) $items->sum('peso_total'), 3)])
            ->filter(fn (array $item): bool => $item['date'] !== '')
            ->sortBy('date')
            ->values()
            ->all();

        return ['productStock' => $productStock, 'shipments' => $shipments, 'dispatchedDays' => $dispatched];
    }

    private function displayName(string $name): string
    {
        return preg_replace('/mu[cç]arela/iu', 'Mussarela', $name) ?? $name;
    }
}
