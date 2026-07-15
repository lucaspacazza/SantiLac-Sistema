<?php

namespace App\Services;

use RuntimeException;

final class AppVersionRegistry
{
    public function get(string $app): array
    {
        $path = public_path('downloads/versions.json');
        $contents = is_file($path) ? file_get_contents($path) : false;
        $registry = is_string($contents) ? json_decode($contents, true) : null;
        $version = is_array($registry) ? ($registry['apps'][$app] ?? null) : null;

        if (! is_array($version)) {
            throw new RuntimeException("Versão do aplicativo não configurada: {$app}");
        }

        return [
            'version_code' => (int) ($version['version_code'] ?? 0),
            'version_name' => (string) ($version['version_name'] ?? ''),
            'apk_url' => (string) ($version['apk_url'] ?? ''),
            'required' => (bool) ($version['required'] ?? false),
            'message' => (string) ($version['message'] ?? 'Nova versão disponível.'),
        ];
    }
}
