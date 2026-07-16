<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Expedicao\ExpedicaoService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ExpedicaoCancellationTest extends TestCase
{
    #[DataProvider('statusProvider')]
    public function test_only_open_orders_can_be_cancelled(string $status, bool $expected): void
    {
        $method = new ReflectionMethod(ExpedicaoService::class, 'ordemPodeSerCancelada');

        self::assertSame($expected, $method->invoke(new ExpedicaoService, $status));
    }

    public static function statusProvider(): array
    {
        return [
            'draft' => ['rascunho', true],
            'issued' => ['lancada', true],
            'loading' => ['carregando', true],
            'completed' => ['concluida', false],
            'cancelled' => ['cancelada', false],
        ];
    }
}
