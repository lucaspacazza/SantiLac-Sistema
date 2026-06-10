<?php

namespace App\Services\Coletas\Mobile;

class MobileResponse
{
    public static function ok(array $meta = [], array $mapeamentos = []): array
    {
        return [
            'sucesso' => true,
            'erros' => [],
            'mapeamentos' => $mapeamentos,
            'meta' => $meta,
        ];
    }

    public static function fail(array|string $errors): array
    {
        return [
            'sucesso' => false,
            'erros' => is_array($errors) ? $errors : [$errors],
            'mapeamentos' => [],
            'meta' => [],
        ];
    }
}
