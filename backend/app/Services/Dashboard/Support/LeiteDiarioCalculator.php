<?php

namespace App\Services\Dashboard\Support;

use Carbon\CarbonImmutable;

class LeiteDiarioCalculator
{
    public function calculate(iterable $rows, string $startDate, string $endDate): array
    {
        $start = CarbonImmutable::parse($startDate)->startOfDay();
        $reference = CarbonImmutable::parse($endDate)->startOfDay();
        $days = $start->diffInDays($reference) + 1;
        $daily = [];
        $routes = [];
        $rows = collect($rows);
        $routeDate = $rows
            ->map(fn (object $row): string => substr((string) $row->datahora, 0, 10))
            ->filter(fn (string $date): bool => $date >= $start->toDateString() && $date <= $reference->toDateString())
            ->max();

        foreach ($rows as $row) {
            $dateTime = CarbonImmutable::parse((string) $row->datahora);
            $date = $dateTime->toDateString();
            $liters = round((float) ($row->litros ?? 0), 3);
            $producer = trim((string) ($row->produtor_codigo ?? ''));

            $daily[$date] ??= ['litros' => 0.0, 'produtores' => []];
            $daily[$date]['litros'] += $liters;
            if ($producer !== '') {
                $daily[$date]['produtores'][$producer] = true;
            }

            if ($date !== $routeDate) {
                continue;
            }

            $routeId = trim((string) ($row->rota_uuid ?? '')) ?: 'sem-rota';
            $routes[$routeId] ??= [
                'id' => $routeId,
                'nome' => trim((string) ($row->rota_nome ?? '')) ?: 'Sem rota identificada',
                'motorista' => trim((string) ($row->motorista_nome ?? $row->usuario ?? '')),
                'litros' => 0.0,
                'produtores' => [],
                'temperaturas' => [],
            ];
            $routes[$routeId]['litros'] += $liters;
            if ($producer !== '') {
                $routes[$routeId]['produtores'][$producer] = true;
            }
            if (isset($row->temperatura) && is_numeric($row->temperatura)) {
                $routes[$routeId]['temperaturas'][] = (float) $row->temperatura;
            }
        }

        $series = [];
        for ($offset = 0; $offset < $days; $offset++) {
            $date = $start->addDays($offset);
            $dateKey = $date->toDateString();
            $previousKey = $date->subDays($days)->toDateString();
            $series[] = [
                'data' => $dateKey,
                'litros' => round((float) ($daily[$dateKey]['litros'] ?? 0), 3),
                'litros_periodo_anterior' => round((float) ($daily[$previousKey]['litros'] ?? 0), 3),
                'produtores' => count($daily[$dateKey]['produtores'] ?? []),
            ];
        }

        return [
            'serie_diaria' => $series,
            'rotas' => collect($routes)->map(function (array $route): array {
                $temperatures = $route['temperaturas'];
                return [
                    'id' => $route['id'],
                    'nome' => $route['nome'],
                    'motorista' => $route['motorista'],
                    'litros' => round($route['litros'], 3),
                    'produtores' => count($route['produtores']),
                    'temperatura_media' => $temperatures === [] ? null : round(array_sum($temperatures) / count($temperatures), 2),
                ];
            })->sortByDesc('litros')->values()->all(),
        ];
    }
}
