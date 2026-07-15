<?php

declare(strict_types=1);

require dirname(__DIR__).'/vendor/autoload.php';

use App\Models\Producao\ProducaoFormulacaoQueijo;
use App\Services\Producao\OrdemProducaoService;

$primeira = new ProducaoFormulacaoQueijo();
$primeira->setRawAttributes([
        'tipo_queijo' => 'Mussarela',
        'data_formulacao' => new DateTimeImmutable('2026-07-15'),
        'quantidade_leite' => 1000,
        'insumos_json' => json_encode([[
            'tipo_insumo' => 'coalho',
            'nome_insumo' => 'Coalho',
            'quantidade' => 2,
            'unidade' => 'ml',
        ]], JSON_THROW_ON_ERROR),
]);
$segunda = new ProducaoFormulacaoQueijo();
$segunda->setRawAttributes([
        'tipo_queijo' => 'Mussarela',
        'data_formulacao' => new DateTimeImmutable('2026-07-15'),
        'quantidade_leite' => 500,
        'insumos_json' => json_encode([[
            'tipo_insumo' => 'coalho',
            'nome_insumo' => 'Coalho',
            'quantidade' => 1.5,
            'unidade' => 'ml',
        ]], JSON_THROW_ON_ERROR),
]);

$formulacoes = collect([$primeira, $segunda]);

$method = new ReflectionMethod(OrdemProducaoService::class, 'camposAutomaticos');
$campos = $method->invoke(new OrdemProducaoService(), $formulacoes);
$porRotulo = collect($campos)->keyBy('rotulo');

if (($porRotulo->get('LTS PRODUZIDOS TOTAL')['valor'] ?? null) !== '1.500 L') {
    throw new RuntimeException('Litros das formulações não foram somados corretamente.');
}

if (($porRotulo->get('COALHO')['valor'] ?? null) !== '3,5 ml') {
    throw new RuntimeException('Insumos das formulações não foram somados corretamente.');
}

if (($porRotulo->get('PRODUÇÃO DIARIA / DATA')['valor'] ?? null) !== '15/07/2026') {
    throw new RuntimeException('Data da OP diária não foi preservada.');
}

echo "order aggregation: ok\n";
