<?php

namespace App\Services\Coletas\Mobile;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use RuntimeException;
use Throwable;

class MobileTime
{
    public static function toMysql(string $value): string
    {
        try {
            return (new DateTimeImmutable($value))
                ->setTimezone(new DateTimeZone('America/Sao_Paulo'))
                ->format('Y-m-d H:i:s');
        } catch (Throwable) {
            $trimmed = trim($value);
            if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $trimmed) === 1) {
                return $trimmed;
            }
            throw new RuntimeException('Timestamp inválido: ' . $value);
        }
    }

    public static function toAtom(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($value, new DateTimeZone('America/Sao_Paulo')))
                ->setTimezone(new DateTimeZone('America/Sao_Paulo'))
                ->format(DateTimeInterface::ATOM);
        } catch (Throwable) {
            return $value;
        }
    }
}
