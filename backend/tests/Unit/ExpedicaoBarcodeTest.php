<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Expedicao\ExpedicaoService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ExpedicaoBarcodeTest extends TestCase
{
    #[DataProvider('validBarcodeProvider')]
    public function test_extracts_pallet_id_from_code128_value(string $barcode, int $expectedId): void
    {
        $method = new ReflectionMethod(ExpedicaoService::class, 'extrairPaleteIdCodigoBarras');

        self::assertSame($expectedId, $method->invoke(new ExpedicaoService, $barcode));
    }

    public function test_does_not_treat_qr_token_as_pallet_id(): void
    {
        $method = new ReflectionMethod(ExpedicaoService::class, 'extrairPaleteIdCodigoBarras');

        self::assertNull($method->invoke(new ExpedicaoService, 'jgrahgeqbkklrehes4cefqhmppc6kn7r'));
        self::assertNull($method->invoke(new ExpedicaoService, 'PAL-0'));
        self::assertNull($method->invoke(new ExpedicaoService, 'PAL-42 OR 1=1'));
    }

    public function test_removes_scanner_control_characters_before_parsing_urls(): void
    {
        $method = new ReflectionMethod(ExpedicaoService::class, 'extrairToken');

        self::assertSame('PAL-42', $method->invoke(new ExpedicaoService, "\x02PAL-42\x03"));
    }

    public static function validBarcodeProvider(): array
    {
        return [
            'standard' => ['PAL-42', 42],
            'case insensitive' => ['pal-987', 987],
            'scanner AIM Code 128 prefix' => [']C0PAL-42', 42],
            'scanner AIM GS1-128 prefix' => [']C1PAL-42', 42],
            'scanner control characters' => ["\x02PAL-42\x03", 42],
            'legacy numeric pallet id' => ['42', 42],
        ];
    }
}
