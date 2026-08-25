<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Producao\ProducaoOrdemProducao;
use App\Services\Embalagem\EmbalagemService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class EmbalagemOrdensDisponiveisTest extends TestCase
{
    #[DataProvider('availabilityCases')]
    public function test_only_non_cancelled_orders_not_completed_in_packaging_are_available(
        string $status,
        ?string $packagingStatus,
        bool $expected,
    ): void {
        $order = new ProducaoOrdemProducao;
        $order->forceFill([
            'status' => $status,
            'status_embalagem' => $packagingStatus,
        ]);
        $method = new ReflectionMethod(EmbalagemService::class, 'ordemDisponivelParaEmbalagem');

        self::assertSame($expected, $method->invoke(new EmbalagemService, $order));
    }

    public function test_formats_available_order_with_name_lot_and_cheese_type(): void
    {
        $order = new ProducaoOrdemProducao;
        $order->forceFill([
            'id' => 17,
            'codigo_ordem' => 'OP-0017',
        ]);
        $method = new ReflectionMethod(EmbalagemService::class, 'formatarOrdemDisponivel');

        self::assertSame([
            'id' => 17,
            'codigo_ordem' => 'OP-0017',
            'nome' => 'OP-0017',
            'lote' => 'L-2408',
            'tipo_queijo' => 'Mussarela F4',
        ], $method->invoke(
            new EmbalagemService,
            $order,
            ['lote' => 'L-2408', 'tipo_queijo' => 'mussarela-f4'],
            ['nome' => 'Mussarela F4', 'slug' => 'mussarela-f4'],
        ));
    }

    public static function availabilityCases(): array
    {
        return [
            'new order' => ['finalizada', null, true],
            'order already being packed' => ['finalizada', 'embalando', true],
            'draft accepted by current validation flow' => ['rascunho', 'pendente', true],
            'cancelled order' => ['cancelada', 'pendente', false],
            'packaging already completed' => ['finalizada', 'concluida', false],
        ];
    }
}
