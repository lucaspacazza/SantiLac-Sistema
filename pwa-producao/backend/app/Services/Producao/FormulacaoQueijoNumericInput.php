<?php

namespace App\Services\Producao;

final class FormulacaoQueijoNumericInput
{
    private const FIELDS = [
        'quantidade_leite' => 'Quantidade de leite',
        'temperatura_pasteurizacao' => 'Temperatura de pasteurização',
        'gordura_inicial' => 'Gordura inicial',
        'gordura_final' => 'Gordura final',
        'acidez' => 'Acidez',
        'temperatura_coagulacao' => 'Temperatura de coagulação',
        'temperatura_cozimento' => 'Temperatura de cozimento',
    ];

    public static function pointViolations(array $payload): array
    {
        $violations = [];

        foreach (self::FIELDS as $field => $label) {
            if (self::usesForbiddenFormat($payload[$field] ?? null)) {
                $violations[] = $label;
            }
        }

        $inputs = $payload['insumos'] ?? [];
        if (! is_array($inputs)) {
            return $violations;
        }

        foreach ($inputs as $input) {
            if (! is_array($input)) {
                continue;
            }

            if (self::usesForbiddenFormat($input['quantidade'] ?? null)) {
                $violations[] = 'Quantidade do insumo';
                break;
            }
        }

        return $violations;
    }

    public static function normalize(array $payload): array
    {
        $normalized = $payload;

        foreach (array_keys(self::FIELDS) as $field) {
            if (array_key_exists($field, $normalized)) {
                $normalized[$field] = self::normalizeValue($normalized[$field]);
            }
        }

        if (! array_key_exists('insumos', $normalized) || ! is_array($normalized['insumos'])) {
            return $normalized;
        }

        $normalized['insumos'] = array_map(function (mixed $input): mixed {
            if (! is_array($input)) {
                return $input;
            }

            if (! array_key_exists('quantidade', $input)) {
                return $input;
            }

            return [
                ...$input,
                'quantidade' => self::normalizeValue($input['quantidade']),
            ];
        }, $normalized['insumos']);

        return $normalized;
    }

    private static function usesForbiddenFormat(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        return ! is_string($value) || str_contains($value, '.');
    }

    private static function normalizeValue(mixed $value): mixed
    {
        return is_string($value) ? str_replace(',', '.', $value) : $value;
    }
}
