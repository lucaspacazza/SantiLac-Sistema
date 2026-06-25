<?php

namespace App\Services\Producao;

use RuntimeException;

class ExportacaoTempDirectory
{
    public static function resolve(): string
    {
        $candidates = [
            storage_path('app/producao-exportacoes'),
            storage_path('framework/cache/producao-exportacoes'),
            rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'santilac-producao-exportacoes',
        ];

        foreach ($candidates as $candidate) {
            if (self::ensureWritableDirectory($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Nenhum diretorio temporario gravavel disponivel para exportacao.');
    }

    private static function ensureWritableDirectory(string $directory): bool
    {
        if ($directory === '') {
            return false;
        }

        if (is_dir($directory)) {
            return is_writable($directory);
        }

        $parent = dirname($directory);
        if (! is_dir($parent) || ! is_writable($parent)) {
            return false;
        }

        @mkdir($directory, 0775, true);
        clearstatcache(true, $directory);

        return is_dir($directory) && is_writable($directory);
    }
}
