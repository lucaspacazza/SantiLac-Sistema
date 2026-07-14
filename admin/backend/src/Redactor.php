<?php

namespace SantiLac\Admin;

final class Redactor
{
    public static function text(string $value): string
    {
        return (string)preg_replace([
            '/\b(password|senha|token|secret|api[_-]?key)\b\s*[=:]\s*[^\s,;&}]+/i',
            '/\bAuthorization\s*:\s*Bearer\s+[^\s,;&}]+/i',
        ], ['$1=[REDACTED]','Authorization: Bearer [REDACTED]'],$value);
    }
}
