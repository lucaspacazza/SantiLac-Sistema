<?php

namespace App\Services\Dashboard\Support;

use Illuminate\Support\Str;

class ProducaoLotesCalculator
{
    private const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#a78bfa', '#ec4899', '#06b6d4'];

    public function calculate(iterable $orders, iterable $formulations, iterable $packaging): array
    {
        $formulations = collect($formulations);
        $byOrder = $formulations->filter(fn (object $item): bool => $item->ordem_producao_id !== null)
            ->groupBy(fn (object $item): int => (int) $item->ordem_producao_id);
        $byId = $formulations->keyBy(fn (object $item): int => (int) $item->id);
        $packaging = collect($packaging);
        $products = [];
        $lots = [];

        foreach ($orders as $order) {
            if ((string) ($order->status ?? '') === 'cancelada') {
                continue;
            }

            $orderFormulations = $byOrder->get((int) $order->id, collect());
            if ($orderFormulations->isEmpty() && $order->formulacao_queijo_id !== null) {
                $legacy = $byId->get((int) $order->formulacao_queijo_id);
                $orderFormulations = $legacy === null ? collect() : collect([$legacy]);
            }

            $milk = round((float) $orderFormulations
                ->reject(fn (object $item): bool => (string) ($item->status ?? '') === 'cancelada')
                ->sum(fn (object $item): float => (float) ($item->quantidade_leite ?? 0)), 3);
            $firstFormulation = $orderFormulations->first();
            $name = $this->displayName((string) ($order->tipo_queijo ?? $firstFormulation?->tipo_queijo ?? 'Produto sem nome'));
            $productId = Str::slug($name) ?: 'produto-'.(int) $order->id;
            $products[$productId] ??= [
                'id' => $productId,
                'name' => $name,
                'short' => $name,
                'color' => self::COLORS[count($products) % count(self::COLORS)],
            ];
            $package = $packaging->get((int) $order->id);
            $isClosed = (string) ($order->status_embalagem ?? '') === 'concluida'
                && is_numeric($order->peso_total_embalagem ?? null)
                && (float) $order->peso_total_embalagem > 0;
            $partialWeight = $package !== null ? round((float) ($package->peso_total ?? 0), 3) : 0.0;
            $state = $isClosed
                ? 'closed'
                : ((string) ($order->status ?? '') === 'aguardando_formato'
                    ? 'format'
                    : ($partialWeight > 0 ? 'packing' : 'waiting'));

            $lots[] = [
                'id' => (string) ($order->codigo_ordem ?? 'OP-'.(int) $order->id),
                'productId' => $productId,
                'date' => substr((string) ($order->data_ordem ?? $firstFormulation?->data_formulacao ?? ''), 0, 10),
                'milk' => $milk,
                'weight' => $isClosed ? round((float) $order->peso_total_embalagem, 3) : null,
                'partialWeight' => $isClosed ? round((float) $order->peso_total_embalagem, 3) : $partialWeight,
                'state' => $state,
                'closedAt' => $isClosed && $order->embalagem_finalizada_at !== null ? (string) $order->embalagem_finalizada_at : null,
                'boxes' => (int) ($package->caixas_total ?? 0),
            ];
        }

        $closed = collect($lots)->where('state', 'closed');
        $weight = (float) $closed->sum('weight');
        $milk = (float) $closed->sum('milk');

        return [
            'products' => array_values($products),
            'lotes' => $lots,
            'rendimento_ponderado' => $weight > 0 ? round($milk / $weight, 3) : null,
        ];
    }

    private function displayName(string $name): string
    {
        $name = preg_replace('/mu[cç]arela/iu', 'Mussarela', trim($name)) ?? trim($name);
        return $name !== '' ? $name : 'Produto sem nome';
    }
}
