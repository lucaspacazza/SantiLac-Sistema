<?php

namespace App\Services\Producao;

final class FormulacaoQueijoFinalizationGuard
{
    private const REQUIRED_INPUTS = [
        'fermento' => 'Fermento',
        'coalho' => 'Coalho',
        'cloreto' => 'Cloreto',
    ];

    private const FERMENT_TYPES = ['fermento', 'fermento_mvd', 'fermento_fast'];

    public static function missingRequiredInputs(array $inputs): array
    {
        $present = [];

        foreach ($inputs as $input) {
            $type = (string) ($input['tipo_insumo'] ?? '');
            $quantity = $input['quantidade'] ?? null;

            if (! is_numeric($quantity) || (float) $quantity <= 0) {
                continue;
            }

            if (in_array($type, self::FERMENT_TYPES, true)) {
                $present['fermento'] = true;
            }

            if ($type === 'coalho' || $type === 'cloreto') {
                $present[$type] = true;
            }
        }

        return array_values(array_filter(
            self::REQUIRED_INPUTS,
            fn (string $label, string $key): bool => ! isset($present[$key]),
            ARRAY_FILTER_USE_BOTH
        ));
    }
}
