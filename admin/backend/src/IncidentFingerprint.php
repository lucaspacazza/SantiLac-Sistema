<?php

namespace SantiLac\Admin;

final class IncidentFingerprint
{
    public static function make(string $type, string $message, string $route, int $status): string
    {
        $normalize = static fn (string $value): string => strtolower(trim((string) preg_replace([
            '/\b\d+\b/', '/[a-f0-9]{8}-[a-f0-9-]{27,}/i', '/\s+/'
        ], ['#', '{uuid}', ' '], $value)));
        return hash('sha256', implode('|', [$normalize($type), $normalize($message), $normalize($route), $status]));
    }
}
