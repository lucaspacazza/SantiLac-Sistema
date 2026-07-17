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

$coalho = new ProducaoFormulacaoQueijo();
$coalho->setRawAttributes([
    'tipo_queijo' => 'Coalho',
    'data_formulacao' => new DateTimeImmutable('2026-07-14'),
    'quantidade_leite' => 1950,
    'insumos_json' => json_encode([[
        'tipo_insumo' => 'fermento',
        'nome_insumo' => 'BVADD',
        'quantidade' => 25,
        'unidade' => 'g',
    ]], JSON_THROW_ON_ERROR),
]);

$camposCoalho = $method->invoke(new OrdemProducaoService(), collect([$coalho]));
$coalhoPorRotulo = collect($camposCoalho)->keyBy('rotulo');

if (($coalhoPorRotulo->get('BVADD')['valor'] ?? null) !== '25 g') {
    throw new RuntimeException('Fermento BVADD do Coalho não foi levado para a OP.');
}

if ($coalhoPorRotulo->has('FERMENTO (MVD)') || $coalhoPorRotulo->has('FERMENTO (FAST)')) {
    throw new RuntimeException('OP de Coalho não pode receber fermentos MVD ou FAST sem uso na formulação.');
}

echo "order aggregation: ok\n";
