<?php

namespace Tests\Unit\Dashboard;

use App\Services\Dashboard\Support\LeiteDiarioCalculator;
use App\Services\Dashboard\Support\ProducaoLotesCalculator;
use PHPUnit\Framework\TestCase;

class VisaoDonoCalculatorsTest extends TestCase
{
    public function test_leite_exposes_real_daily_series_and_comparable_previous_period(): void
    {
        $calculator = new LeiteDiarioCalculator;
        $rows = [
            (object) ['produtor_codigo' => 'P1', 'litros' => 1200, 'temperatura' => 4.0, 'datahora' => '2026-09-09 06:00:00', 'rota_uuid' => 'R1', 'rota_nome' => 'Rota Norte', 'usuario' => 'João'],
            (object) ['produtor_codigo' => 'P2', 'litros' => 800, 'temperatura' => 5.0, 'datahora' => '2026-09-09 06:30:00', 'rota_uuid' => 'R1', 'rota_nome' => 'Rota Norte', 'usuario' => 'João'],
            (object) ['produtor_codigo' => 'P1', 'litros' => 1500, 'temperatura' => 4.2, 'datahora' => '2026-08-10 06:00:00', 'rota_uuid' => 'R0', 'rota_nome' => 'Rota Norte', 'usuario' => 'João'],
        ];

        $data = $calculator->calculate($rows, '2026-09-09', 30);

        $today = collect($data['serie_diaria'])->firstWhere('data', '2026-09-09');
        $this->assertSame(2000.0, $today['litros']);
        $this->assertSame(1500.0, $today['litros_periodo_anterior']);
        $this->assertSame(2, $today['produtores']);
        $this->assertSame('Rota Norte', $data['rotas'][0]['nome']);
        $this->assertSame(2000.0, $data['rotas'][0]['litros']);
    }

    public function test_producao_keeps_partial_weight_out_of_final_yield_and_supports_legacy_link(): void
    {
        $calculator = new ProducaoLotesCalculator;
        $orders = [
            (object) ['id' => 1, 'codigo_ordem' => 'OP-1', 'formulacao_queijo_id' => null, 'tipo_queijo' => 'Muçarela F4', 'data_ordem' => '2026-09-08', 'status' => 'finalizada', 'status_embalagem' => 'concluida', 'peso_total_embalagem' => 200, 'embalagem_finalizada_at' => '2026-09-09 07:00:00'],
            (object) ['id' => 2, 'codigo_ordem' => 'OP-2', 'formulacao_queijo_id' => 2, 'tipo_queijo' => 'Prato', 'data_ordem' => '2026-09-08', 'status' => 'finalizada', 'status_embalagem' => 'concluida', 'peso_total_embalagem' => 100, 'embalagem_finalizada_at' => '2026-09-09 07:30:00'],
            (object) ['id' => 3, 'codigo_ordem' => 'OP-3', 'formulacao_queijo_id' => null, 'tipo_queijo' => 'Colonial', 'data_ordem' => '2026-09-09', 'status' => 'finalizada', 'status_embalagem' => 'em_andamento', 'peso_total_embalagem' => 80, 'embalagem_finalizada_at' => null],
        ];
        $formulations = [
            (object) ['id' => 1, 'ordem_producao_id' => 1, 'tipo_queijo' => 'Muçarela F4', 'data_formulacao' => '2026-09-08', 'quantidade_leite' => 2000, 'status' => 'finalizada'],
            (object) ['id' => 2, 'ordem_producao_id' => null, 'tipo_queijo' => 'Prato', 'data_formulacao' => '2026-09-08', 'quantidade_leite' => 1100, 'status' => 'finalizada'],
            (object) ['id' => 3, 'ordem_producao_id' => 3, 'tipo_queijo' => 'Colonial', 'data_formulacao' => '2026-09-09', 'quantidade_leite' => 900, 'status' => 'finalizada'],
        ];
        $packaging = [
            1 => (object) ['peso_total' => 200, 'caixas_total' => 10, 'status' => 'finalizado'],
            2 => (object) ['peso_total' => 100, 'caixas_total' => 5, 'status' => 'finalizado'],
            3 => (object) ['peso_total' => 80, 'caixas_total' => 4, 'status' => 'aberto'],
        ];

        $data = $calculator->calculate($orders, $formulations, $packaging);

        $this->assertCount(3, $data['lotes']);
        $this->assertSame('closed', $data['lotes'][0]['state']);
        $this->assertSame('Mussarela F4', $data['products'][0]['name']);
        $this->assertSame(200.0, $data['lotes'][0]['weight']);
        $this->assertSame(1100.0, $data['lotes'][1]['milk']);
        $this->assertSame('packing', $data['lotes'][2]['state']);
        $this->assertNull($data['lotes'][2]['weight']);
        $this->assertSame(80.0, $data['lotes'][2]['partialWeight']);
        $this->assertSame(10.333, $data['rendimento_ponderado']);
    }

}
