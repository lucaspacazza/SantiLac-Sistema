<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Embalagem\EmbalagemService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class EmbalagemBarcodeTest extends TestCase
{
    public function test_parses_current_scale_barcode_layout(): void
    {
        $method = new ReflectionMethod(EmbalagemService::class, 'parseBarcode');

        self::assertSame([
            'digits' => '2000100004586',
            'codigo_queijo' => '1',
            'peso' => 0.458,
        ], $method->invoke(new EmbalagemService, '2000100004586'));
    }
}
