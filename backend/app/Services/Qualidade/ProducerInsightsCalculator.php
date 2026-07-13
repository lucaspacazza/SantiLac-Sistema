<?php

namespace App\Services\Qualidade;

class ProducerInsightsCalculator
{
    private const MILK_STABLE_PERCENTAGE = 1.0;

    private const QUALITY_METRICS = [
        'gordura' => [
            'label' => 'Gordura',
            'unidade' => '%',
            'melhor_quando' => 'maior',
            'tolerancia_absoluta' => 0.05,
        ],
        'proteina' => [
            'label' => 'Proteína',
            'unidade' => '%',
            'melhor_quando' => 'maior',
            'tolerancia_absoluta' => 0.05,
        ],
        'lactose' => [
            'label' => 'Lactose',
            'unidade' => '%',
            'melhor_quando' => 'maior',
            'tolerancia_absoluta' => 0.05,
        ],
        'solidos_totais' => [
            'label' => 'Sólidos totais',
            'unidade' => '%',
            'melhor_quando' => 'maior',
            'tolerancia_absoluta' => 0.10,
        ],
        'ccs' => [
            'label' => 'CCS',
            'unidade' => 'mil/mL',
            'escala' => 100,
            'melhor_quando' => 'menor',
            'tolerancia_percentual' => 5.0,
        ],
        'ufc' => [
            'label' => 'UFC',
            'unidade' => 'mil/mL',
            'escala' => 100,
            'melhor_quando' => 'menor',
            'tolerancia_percentual' => 5.0,
        ],
    ];

    public function compareMilkVolume(?float $current, ?float $previous): array
    {
        if ($current === null) {
            return [
                'atual_litros' => null,
                'anterior_litros' => $previous !== null ? round($previous, 3) : null,
                'variacao_litros' => null,
                'variacao_percentual' => null,
                'tendencia' => 'sem_comparacao',
            ];
        }

        if ($previous === null) {
            return [
                'atual_litros' => round($current, 3),
                'anterior_litros' => null,
                'variacao_litros' => null,
                'variacao_percentual' => null,
                'tendencia' => 'sem_comparacao',
            ];
        }

        $difference = $current - $previous;
        $percentage = $previous !== 0.0
            ? ($difference / abs($previous)) * 100
            : null;

        if ($previous === 0.0) {
            $trend = $current > 0 ? 'aumentou' : 'estavel';
        } elseif (abs((float) $percentage) < self::MILK_STABLE_PERCENTAGE) {
            $trend = 'estavel';
        } else {
            $trend = $difference > 0 ? 'aumentou' : 'diminuiu';
        }

        return [
            'atual_litros' => round($current, 3),
            'anterior_litros' => round($previous, 3),
            'variacao_litros' => round($difference, 3),
            'variacao_percentual' => $percentage !== null ? round($percentage, 1) : null,
            'tendencia' => $trend,
        ];
    }

    public function compareQuality(array $current, array $previous): array
    {
        $indicators = [];
        $counts = [
            'melhorou' => 0,
            'estavel' => 0,
            'piorou' => 0,
        ];

        foreach (self::QUALITY_METRICS as $field => $config) {
            $currentValue = $this->numericValue($current[$field] ?? null);
            $previousValue = $this->numericValue($previous[$field] ?? null);

            if ($currentValue === null || $previousValue === null) {
                continue;
            }

            $difference = $currentValue - $previousValue;
            $percentage = $previousValue !== 0.0
                ? ($difference / abs($previousValue)) * 100
                : null;
            $tolerance = isset($config['tolerancia_absoluta'])
                ? (float) $config['tolerancia_absoluta']
                : abs($previousValue) * ((float) $config['tolerancia_percentual'] / 100);

            if (abs($difference) <= $tolerance) {
                $status = 'estavel';
            } else {
                $increased = $difference > 0;
                $improved = $config['melhor_quando'] === 'maior' ? $increased : ! $increased;
                $status = $improved ? 'melhorou' : 'piorou';
            }

            $counts[$status]++;
            $scale = (float) ($config['escala'] ?? 1);
            $indicators[$field] = [
                'codigo' => $field,
                'label' => $config['label'],
                'unidade' => $config['unidade'],
                'atual' => round($currentValue / $scale, 2),
                'anterior' => round($previousValue / $scale, 2),
                'variacao' => round($difference / $scale, 2),
                'variacao_percentual' => $percentage !== null ? round($percentage, 1) : null,
                'situacao' => $status,
            ];
        }

        $compared = count($indicators);
        $sanitaryWorsened = count(array_filter(
            ['ccs', 'ufc'],
            fn (string $field): bool => ($indicators[$field]['situacao'] ?? null) === 'piorou',
        ));

        if ($compared === 0) {
            $status = 'sem_comparacao';
        } elseif ($sanitaryWorsened >= 2) {
            $status = 'piorou';
        } elseif ($counts['melhorou'] > $counts['piorou']) {
            $status = 'melhorou';
        } elseif ($counts['piorou'] > $counts['melhorou']) {
            $status = 'piorou';
        } else {
            $status = 'estavel';
        }

        if ($sanitaryWorsened === 1 && $status === 'melhorou') {
            $status = 'estavel';
        }

        return [
            'situacao' => $status,
            'alerta_sanitario' => $sanitaryWorsened > 0,
            'comparados' => $compared,
            'melhoraram' => $counts['melhorou'],
            'estaveis' => $counts['estavel'],
            'pioraram' => $counts['piorou'],
            'indicadores' => $indicators,
        ];
    }

    private function numericValue(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }
}
