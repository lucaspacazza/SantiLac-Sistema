<?php

namespace Tests\Feature\Qualidade;

use App\Services\Qualidade\RelatoriosV2Service;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RelatoriosV2Test extends TestCase
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
            $table->boolean('ativo')->default(true);
            $table->boolean('novo')->default(false);
            $table->dateTime('data_cadastro')->nullable();
            $table->dateTime('data_inativacao')->nullable();
        });

        Schema::connection('raw')->create('resultadosanalises', function (Blueprint $table): void {
            $table->id();
            $table->string('produtor_codigo');
            $table->date('data');
            foreach (['gordura', 'proteina', 'lactose', 'solidos_totais', 'caseina', 'sng', 'ureia', 'antibiotico', 'bacteria', 'temperatura'] as $campo) {
                $table->decimal($campo, 12, 2)->nullable();
            }
            $table->integer('ccs')->nullable();
            $table->integer('ufc')->nullable();
        });

        DB::connection('raw')->table('produtores')->insert([
            ['codigo' => 'P1', 'nome' => 'Conforme', 'cidade' => 'Chapeco', 'rota' => 'R1', 'ativo' => true],
            ['codigo' => 'P2', 'nome' => 'Critico', 'cidade' => 'Chapeco', 'rota' => 'R1', 'ativo' => true],
            ['codigo' => 'P3', 'nome' => 'Sem analise', 'cidade' => 'Xanxere', 'rota' => 'R2', 'ativo' => true],
            ['codigo' => 'P4', 'nome' => 'Outra cidade', 'cidade' => 'Xanxere', 'rota' => 'R2', 'ativo' => true],
        ]);

        DB::connection('raw')->table('resultadosanalises')->insert([
            $this->analise(1, 'P1', '2026-06-05', ['gordura' => 2.0]),
            $this->analise(2, 'P1', '2026-06-20'),
            $this->analise(3, 'P2', '2026-06-18', ['antibiotico' => 1]),
            $this->analise(4, 'P4', '2026-06-15', ['ccs' => 60_000]),
        ]);
    }

    public function test_returns_the_operational_report_using_the_latest_analysis_per_producer(): void
    {
        $response = $this->withoutMiddleware()->getJson(
            '/api/qualidade/relatorios/v2/resumo?data_inicio=2026-06-01&data_fim=2026-06-30'
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.executivo.total_produtores', 4)
            ->assertJsonPath('data.executivo.produtores_analisados', 3)
            ->assertJsonPath('data.executivo.cobertura_percentual', 75)
            ->assertJsonPath('data.executivo.conformes', 1)
            ->assertJsonPath('data.executivo.conformidade_percentual', 33.3)
            ->assertJsonPath('data.executivo.total_analises', 4)
            ->assertJsonPath('data.executivo.criticos', 1)
            ->assertJsonCount(10, 'data.indicadores')
            ->assertJsonCount(1, 'data.prioridades.criticos')
            ->assertJsonCount(1, 'data.prioridades.sem_analise')
            ->assertJsonCount(2, 'data.rotas')
            ->assertJsonCount(1, 'data.tendencia');

        $this->assertArrayNotHasKey('importacoes', $response->json('data'));
        $this->assertSame('P2', $response->json('data.prioridades.criticos.0.codigo'));
    }

    public function test_service_exposes_the_v2_summary_contract(): void
    {
        $data = app(RelatoriosV2Service::class)->resumo([
            'data_inicio' => '2026-06-01',
            'data_fim' => '2026-06-30',
            'rota' => null,
            'cidade' => null,
        ]);

        $this->assertSame(4, $data['executivo']['total_produtores']);
    }

    public function test_applies_route_and_city_filters_to_every_section(): void
    {
        $response = $this->withoutMiddleware()->getJson(
            '/api/qualidade/relatorios/v2/resumo?data_inicio=2026-06-01&data_fim=2026-06-30&rota=R1&cidade=Chapeco'
        );

        $response->assertOk()
            ->assertJsonPath('data.filtros.rota', 'R1')
            ->assertJsonPath('data.filtros.cidade', 'Chapeco')
            ->assertJsonPath('data.executivo.total_produtores', 2)
            ->assertJsonPath('data.executivo.produtores_analisados', 2)
            ->assertJsonPath('data.executivo.criticos', 1)
            ->assertJsonCount(1, 'data.rotas')
            ->assertJsonPath('data.rotas.0.rota', 'R1')
            ->assertJsonCount(1, 'data.opcoes.cidades')
            ->assertJsonPath('data.opcoes.cidades.0', 'Chapeco');
    }

    public function test_rejects_unknown_routes_and_cities_outside_the_selected_route(): void
    {
        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=2026-06-01&data_fim=2026-06-30&rota=Inexistente')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rota']);

        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=2026-06-01&data_fim=2026-06-30&rota=R1&cidade=Xanxere')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cidade']);
    }

    public function test_rejects_invalid_or_reversed_dates(): void
    {
        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=invalida&data_fim=2026-06-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['data_inicio']);

        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=2026-07-01&data_fim=2026-06-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['data_fim']);
    }

    public function test_rejects_future_dates_and_periods_longer_than_one_year(): void
    {
        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=2025-01-01&data_fim=2026-06-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['data_fim']);

        $this->withoutMiddleware()
            ->getJson('/api/qualidade/relatorios/v2/resumo?data_inicio=2999-01-01&data_fim=2999-01-31')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['data_fim']);
    }

    private function analise(int $id, string $codigo, string $data, array $override = []): array
    {
        return array_merge([
            'id' => $id,
            'produtor_codigo' => $codigo,
            'data' => $data,
            'gordura' => 3.6,
            'proteina' => 3.3,
            'lactose' => 4.6,
            'solidos_totais' => 12.3,
            'ccs' => 40_000,
            'ufc' => 20_000,
            'ureia' => 13,
            'temperatura' => 5,
            'antibiotico' => 0,
            'bacteria' => 0,
        ], $override);
    }
}
