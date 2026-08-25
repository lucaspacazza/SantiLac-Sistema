<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Embalagem\EmbalagemService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class EmbalagemDuplicateWeightTest extends TestCase
{
    #[DataProvider('weightCases')]
    public function test_detects_duplicate_weight_only_on_the_same_pallet(
        array $boxes,
        int $palletId,
        float $weight,
        bool $expected,
    ): void {
        $method = new ReflectionMethod(EmbalagemService::class, 'pesoJaRegistradoNoPalete');

        self::assertSame($expected, $method->invoke(new EmbalagemService, $boxes, $palletId, $weight));
    }

    public static function weightCases(): array
    {
        return [
            'same weight on same pallet' => [
                [['palete_id' => 10, 'peso' => 0.458]],
                10,
                0.458,
                true,
            ],
            'same scale weight with floating point residue' => [
                [['palete_id' => 10, 'peso' => 0.457999999]],
                10,
                0.458,
                true,
            ],
            'same weight on another pallet' => [
                [['palete_id' => 9, 'peso' => 0.458]],
                10,
                0.458,
                false,
            ],
            'different weight on same pallet' => [
                [['palete_id' => 10, 'peso' => 0.459]],
                10,
                0.458,
                false,
            ],
        ];
    }
}
