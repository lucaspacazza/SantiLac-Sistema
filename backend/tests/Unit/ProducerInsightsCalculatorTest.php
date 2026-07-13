<?php

namespace Tests\Unit;

use App\Services\Qualidade\ProducerInsightsCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ProducerInsightsCalculatorTest extends TestCase
{
    private ProducerInsightsCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new ProducerInsightsCalculator;
    }

    public function test_calculates_milk_growth_in_liters_and_percentage(): void
    {
        $comparison = $this->calculator->compareMilkVolume(12_000, 10_000);

        $this->assertSame(2_000.0, $comparison['variacao_litros']);
        $this->assertSame(20.0, $comparison['variacao_percentual']);
        $this->assertSame('aumentou', $comparison['tendencia']);
    }

    #[DataProvider('milkTrendProvider')]
    public function test_classifies_milk_trend(?float $current, ?float $previous, string $expected): void
    {
        $comparison = $this->calculator->compareMilkVolume($current, $previous);

        $this->assertSame($expected, $comparison['tendencia']);
    }

    public static function milkTrendProvider(): array
    {
        return [
            'small fluctuation is stable' => [10_050, 10_000, 'estavel'],
            'drop is reported' => [8_000, 10_000, 'diminuiu'],
            'missing baseline has no comparison' => [8_000, null, 'sem_comparacao'],
            'missing current volume is not presented as zero' => [null, null, 'sem_comparacao'],
            'production starting from zero grows without fake percentage' => [800, 0, 'aumentou'],
        ];
    }

    public function test_quality_improves_when_sanitary_counts_fall_and_composition_rises(): void
    {
        $comparison = $this->calculator->compareQuality(
            [
                'gordura' => 3.82,
                'proteina' => 3.36,
                'lactose' => 4.62,
                'solidos_totais' => 12.45,
                'ccs' => 32000,
                'ufc' => 1800,
            ],
            [
                'gordura' => 3.60,
                'proteina' => 3.20,
                'lactose' => 4.50,
                'solidos_totais' => 12.20,
                'ccs' => 45000,
                'ufc' => 2500,
            ],
        );

        $this->assertSame('melhorou', $comparison['situacao']);
        $this->assertSame(6, $comparison['melhoraram']);
        $this->assertSame(0, $comparison['pioraram']);
        $this->assertSame('melhorou', $comparison['indicadores']['ccs']['situacao']);
        $this->assertSame(-130.0, $comparison['indicadores']['ccs']['variacao']);
        $this->assertSame(320.0, $comparison['indicadores']['ccs']['atual']);
        $this->assertSame('mil/mL', $comparison['indicadores']['ccs']['unidade']);
    }

    public function test_quality_stays_stable_inside_noise_tolerance(): void
    {
        $comparison = $this->calculator->compareQuality(
            ['gordura' => 3.63, 'proteina' => 3.18, 'ccs' => 103_000, 'ufc' => 9_600],
            ['gordura' => 3.60, 'proteina' => 3.20, 'ccs' => 100_000, 'ufc' => 10_000],
        );

        $this->assertSame('estavel', $comparison['situacao']);
        $this->assertSame(4, $comparison['estaveis']);
    }

    public function test_quality_worsens_when_more_available_indicators_regress(): void
    {
        $comparison = $this->calculator->compareQuality(
            ['gordura' => 3.40, 'proteina' => 3.05, 'ccs' => 160_000, 'ufc' => 13_000],
            ['gordura' => 3.65, 'proteina' => 3.25, 'ccs' => 100_000, 'ufc' => 10_000],
        );

        $this->assertSame('piorou', $comparison['situacao']);
        $this->assertSame(4, $comparison['pioraram']);
    }

    public function test_quality_does_not_hide_simultaneous_ccs_and_ufc_regression(): void
    {
        $comparison = $this->calculator->compareQuality(
            [
                'gordura' => 3.90,
                'proteina' => 3.40,
                'lactose' => 4.70,
                'solidos_totais' => 12.60,
                'ccs' => 650,
                'ufc' => 450,
            ],
            [
                'gordura' => 3.60,
                'proteina' => 3.20,
                'lactose' => 4.50,
                'solidos_totais' => 12.20,
                'ccs' => 300,
                'ufc' => 100,
            ],
        );

        $this->assertSame('piorou', $comparison['situacao']);
        $this->assertSame(2, $comparison['pioraram']);
        $this->assertTrue($comparison['alerta_sanitario']);
    }

    public function test_quality_requires_a_previous_period(): void
    {
        $comparison = $this->calculator->compareQuality(
            ['gordura' => 3.70, 'ccs' => 90_000],
            [],
        );

        $this->assertSame('sem_comparacao', $comparison['situacao']);
        $this->assertSame(0, $comparison['comparados']);
    }
}
