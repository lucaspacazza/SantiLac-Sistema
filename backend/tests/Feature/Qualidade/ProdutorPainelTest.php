<?php

namespace Tests\Feature\Qualidade;

use App\Services\QualidadeService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProdutorPainelTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.connections.raw', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('raw');

        Schema::connection('raw')->create('produtores', function (Blueprint $table): void {
            $table->id();
            $table->string('codigo')->unique();
            $table->string('nome');
            $table->string('cidade')->nullable();
            $table->string('rota')->nullable();
            $table->string('cpf_cnpj')->nullable();
            $table->string('celular')->nullable();
            $table->boolean('ativo')->default(true);
            $table->boolean('novo')->default(false);
            $table->dateTime('data_cadastro')->nullable();
            $table->dateTime('data_inativacao')->nullable();
        });

        Schema::connection('raw')->create('resultadosanalises', function (Blueprint $table): void {
            $table->id();
            $table->string('produtor_codigo');
            $table->date('data');
            $table->decimal('gordura', 8, 2)->nullable();
            $table->decimal('proteina', 8, 2)->nullable();
            $table->decimal('lactose', 8, 2)->nullable();
            $table->decimal('solidos_totais', 8, 2)->nullable();
            $table->integer('ccs')->nullable();
            $table->integer('ufc')->nullable();
            $table->decimal('caseina', 8, 2)->nullable();
            $table->decimal('sng', 8, 2)->nullable();
            $table->decimal('ureia', 8, 2)->nullable();
            $table->decimal('antibiotico', 8, 2)->nullable();
            $table->decimal('bacteria', 8, 2)->nullable();
            $table->decimal('temperatura', 8, 2)->nullable();
            $table->timestamps();
        });

        Schema::connection('raw')->create('coletas', function (Blueprint $table): void {
            $table->id();
            $table->string('produtor_codigo');
            $table->decimal('litros', 12, 3);
            $table->string('rota_uuid')->nullable();
            $table->dateTime('datahora')->nullable();
        });
    }

    public function test_returns_monthly_milk_growth_and_explainable_quality_trend(): void
    {
        DB::connection('raw')->table('produtores')->insert([
            'codigo' => '01318',
            'nome' => 'Produtora Exemplo',
            'cidade' => 'Formosa do Sul',
            'rota' => 'Rota 03',
            'ativo' => true,
            'novo' => false,
        ]);

        DB::connection('raw')->table('resultadosanalises')->insert([
            [
                'id' => 1,
                'produtor_codigo' => '01318',
                'data' => '2026-05-18',
                'gordura' => 2.50,
                'proteina' => 2.50,
                'lactose' => 3.50,
                'solidos_totais' => 10.00,
                'ccs' => 90_000,
                'ufc' => 9_000,
            ],
            [
                'id' => 2,
                'produtor_codigo' => '01318',
                'data' => '2026-05-18',
                'gordura' => 3.50,
                'proteina' => 3.20,
                'lactose' => 4.50,
                'solidos_totais' => 12.20,
                'ccs' => 45_000,
                'ufc' => 2_500,
            ],
            [
                'id' => 3,
                'produtor_codigo' => '01318',
                'data' => '2026-06-18',
                'gordura' => 3.80,
                'proteina' => 3.40,
                'lactose' => 4.60,
                'solidos_totais' => 12.50,
                'ccs' => 32_000,
                'ufc' => 1_800,
            ],
        ]);

        DB::connection('raw')->table('coletas')->insert([
            [
                'id' => 1,
                'produtor_codigo' => '01318',
                'litros' => 900,
                'rota_uuid' => 'rota-maio',
                'datahora' => '2026-07-10 06:00:00',
            ],
            [
                'id' => 2,
                'produtor_codigo' => '01318',
                'litros' => 1_000,
                'rota_uuid' => 'rota-maio',
                'datahora' => '2026-05-10 06:05:00',
            ],
            [
                'id' => 3,
                'produtor_codigo' => '01318',
                'litros' => 1_200,
                'rota_uuid' => 'rota-junho',
                'datahora' => '2026-06-10 06:00:00',
            ],
        ]);

        $detail = app(QualidadeService::class)->produtor('01318');

        $this->assertNotNull($detail);
        $this->assertSame(2, $detail['resumo']['total_analises']);
        $this->assertSame('2026-06', $detail['dashboard']['leite']['periodo_atual']);
        $this->assertSame(1_200.0, $detail['dashboard']['leite']['atual_litros']);
        $this->assertSame(1_000.0, $detail['dashboard']['leite']['anterior_litros']);
        $this->assertSame(20.0, $detail['dashboard']['leite']['variacao_percentual']);
        $this->assertSame('aumentou', $detail['dashboard']['leite']['tendencia']);
        $this->assertSame('melhorou', $detail['dashboard']['qualidade']['situacao']);
        $this->assertSame('melhorou', $detail['dashboard']['qualidade']['indicadores']['ccs']['situacao']);
        $this->assertCount(2, $detail['analises_recentes']);
    }

    public function test_compares_an_open_month_with_the_same_days_of_the_previous_month(): void
    {
        CarbonImmutable::setTestNow('2026-06-15 12:00:00');

        try {
            DB::connection('raw')->table('produtores')->insert([
                'codigo' => '02000',
                'nome' => 'Produtor Mês Parcial',
                'cidade' => 'Chapecó',
                'rota' => 'Rota 01',
                'ativo' => true,
                'novo' => false,
            ]);
            DB::connection('raw')->table('coletas')->insert([
                ['produtor_codigo' => '02000', 'litros' => 1_000, 'rota_uuid' => 'maio-10', 'datahora' => '2026-05-10 06:00:00'],
                ['produtor_codigo' => '02000', 'litros' => 1_000, 'rota_uuid' => 'maio-20', 'datahora' => '2026-05-20 06:00:00'],
                ['produtor_codigo' => '02000', 'litros' => 1_200, 'rota_uuid' => 'junho-10', 'datahora' => '2026-06-10 06:00:00'],
            ]);

            $detail = app(QualidadeService::class)->produtor('02000');
            $milk = $detail['dashboard']['leite'];
            $may = collect($milk['serie_mensal'])->firstWhere('periodo', '2026-05');

            $this->assertTrue($milk['periodo_parcial']);
            $this->assertSame(10, $milk['dia_comparacao']);
            $this->assertSame(1_200.0, $milk['atual_litros']);
            $this->assertSame(1_000.0, $milk['anterior_litros']);
            $this->assertSame(20.0, $milk['variacao_percentual']);
            $this->assertSame(2_000.0, $may['litros']);
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    public function test_existing_producer_without_measurements_returns_empty_dashboard(): void
    {
        DB::connection('raw')->table('produtores')->insert([
            'codigo' => '03000',
            'nome' => 'Produtor Sem Histórico',
            'cidade' => 'Chapecó',
            'rota' => 'Rota 02',
            'ativo' => true,
            'novo' => true,
        ]);

        $detail = app(QualidadeService::class)->produtor('03000');

        $this->assertNotNull($detail);
        $this->assertNull($detail['ultima_analise']);
        $this->assertSame([], $detail['analises_recentes']);
        $this->assertNull($detail['dashboard']['leite']['atual_litros']);
        $this->assertSame('sem_comparacao', $detail['dashboard']['leite']['tendencia']);
        $this->assertSame([], $detail['dashboard']['leite']['serie_mensal']);
        $this->assertSame('sem_comparacao', $detail['dashboard']['qualidade']['situacao']);
        $this->assertSame([], $detail['dashboard']['qualidade']['serie_mensal']);
    }

    public function test_reimport_completes_the_canonical_analysis_when_legacy_duplicates_exist(): void
    {
        DB::connection('raw')->table('resultadosanalises')->insert([
            ['id' => 20, 'produtor_codigo' => '04000', 'data' => '2026-06-18', 'proteina' => null],
            ['id' => 21, 'produtor_codigo' => '04000', 'data' => '2026-06-18', 'proteina' => null],
        ]);

        $method = new \ReflectionMethod(QualidadeService::class, 'gravarAnalisesValidas');
        $summary = $method->invoke(app(QualidadeService::class), [[
            'data' => [
                'produtor_codigo' => '04000',
                'data' => '2026-06-18',
                'proteina' => 3.42,
            ],
        ]]);

        $this->assertSame(1, $summary['completed']);
        $this->assertNull(DB::connection('raw')->table('resultadosanalises')->where('id', 20)->value('proteina'));
        $this->assertSame(3.42, (float) DB::connection('raw')->table('resultadosanalises')->where('id', 21)->value('proteina'));
    }

    public function test_milk_history_preserves_legacy_blank_routes_and_ignores_undated_replacements(): void
    {
        CarbonImmutable::setTestNow('2026-06-15 12:00:00');

        try {
            DB::connection('raw')->table('produtores')->insert([
                'codigo' => '05000',
                'nome' => 'Produtor Coletas Legadas',
                'cidade' => 'Chapecó',
                'rota' => 'Rota 05',
                'ativo' => true,
                'novo' => false,
            ]);
            DB::connection('raw')->table('coletas')->insert([
                ['id' => 1, 'produtor_codigo' => '05000', 'litros' => 100, 'rota_uuid' => 'rota-a', 'datahora' => '2026-06-08 06:00:00'],
                ['id' => 2, 'produtor_codigo' => '05000', 'litros' => 999, 'rota_uuid' => 'rota-a', 'datahora' => null],
                ['id' => 3, 'produtor_codigo' => '05000', 'litros' => 200, 'rota_uuid' => '', 'datahora' => '2026-06-09 06:00:00'],
                ['id' => 4, 'produtor_codigo' => '05000', 'litros' => 250, 'rota_uuid' => '', 'datahora' => '2026-06-10 06:00:00'],
                ['id' => 5, 'produtor_codigo' => '05000', 'litros' => 300, 'rota_uuid' => '   ', 'datahora' => '2026-06-11 06:00:00'],
                ['id' => 6, 'produtor_codigo' => '05000', 'litros' => 350, 'rota_uuid' => '   ', 'datahora' => '2026-06-12 06:00:00'],
                ['id' => 7, 'produtor_codigo' => '05000', 'litros' => 400, 'rota_uuid' => null, 'datahora' => '2026-06-13 06:00:00'],
            ]);

            $milk = app(QualidadeService::class)->produtor('05000')['dashboard']['leite'];

            $this->assertSame(1_600.0, $milk['atual_litros']);
            $this->assertSame(6, $milk['coletas_atual']);
            $this->assertSame('2026-06-13 06:00:00', $milk['ultima_coleta']);
        } finally {
            CarbonImmutable::setTestNow();
        }
    }
}
