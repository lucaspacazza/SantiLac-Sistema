<?php

declare(strict_types=1);

$root = dirname(__DIR__);

function methodSource(string $source, string $method, ?string $nextMethod = null): string
{
    $start = strpos($source, "function {$method}");
    if ($start === false) {
        throw new RuntimeException("Método {$method} não encontrado.");
    }

    $end = $nextMethod === null ? strlen($source) : strpos($source, "function {$nextMethod}", $start + 1);

    return substr($source, $start, $end === false ? null : $end - $start);
}

$baseForms = (string) file_get_contents($root.'/app/Services/Producao/BaseFormularioService.php');
$orders = (string) file_get_contents($root.'/app/Services/Producao/OrdemProducaoService.php');
$shipping = (string) file_get_contents($root.'/app/Services/Expedicao/ExpedicaoService.php');
$collections = (string) file_get_contents($root.'/app/Services/Coletas/ColetasGestaoService.php');
$productionSummary = (string) file_get_contents($root.'/app/Services/Dashboard/ProducaoResumoService.php');
$shippingUi = (string) file_get_contents(dirname($root).'/frontend/src/modules/expedicao/ExpedicaoModule.tsx');
$deployMigration = $root.'/database/migrations/2026_07_16_000002_delete_cancelled_business_records.php';
$publishScript = dirname($root).'/deploy/scripts/publish-backend.sh';

$formCancellation = methodSource($baseForms, 'cancelarFormulario', 'status');
if (! str_contains($formCancellation, '->delete()') || str_contains($formCancellation, "status = 'cancelada'")) {
    throw new RuntimeException('Cancelar uma ficha ainda não a exclui definitivamente.');
}

$orderCancellation = methodSource($orders, 'cancelar', 'gerarDaFormulacao');
if (! str_contains($orderCancellation, "'ordem_producao_id' => null") || ! str_contains($orderCancellation, '->delete()')) {
    throw new RuntimeException('Cancelar uma OP ainda não desvincula as formulações e exclui a ordem.');
}

$shippingCancellation = methodSource($shipping, 'cancelar', 'ordensParaCarregamento');
if (! str_contains($shippingCancellation, '$ordem->delete()') || str_contains($shippingCancellation, "'status' => 'cancelada'")) {
    throw new RuntimeException('Cancelar uma expedição ainda preserva uma ordem cancelada.');
}

$models = [
    'Models/Producao/ProducaoFormulacaoQueijo.php',
    'Models/Producao/ProducaoFormulacaoCreme.php',
    'Models/Producao/ProducaoSoroRefrigerado.php',
    'Models/Producao/ProducaoCreme.php',
    'Models/Producao/ProducaoOrdemProducao.php',
    'Models/Expedicao/ExpedicaoOrdem.php',
];
foreach ($models as $model) {
    if (! str_contains((string) file_get_contents($root.'/app/'.$model), 'ExcludesCancelledRecords')) {
        throw new RuntimeException("O modelo {$model} ainda pode expor registros cancelados antigos.");
    }
}

if (str_contains($shippingUi, 'canceladas preservadas') || str_contains($shippingUi, "cancelada: 'Cancelada'")) {
    throw new RuntimeException('A expedição ainda apresenta registros cancelados ao usuário.');
}

if (str_contains($collections, "'cancelada' => 'HAVING status_codigo = 2'")) {
    throw new RuntimeException('A gestão de coletas ainda permite consultar rotas canceladas.');
}

$collectionDetail = methodSource($collections, 'buscarRotaResumo', 'rotasResumoSql');
if (! str_contains($collectionDetail, 'HAVING status_codigo <> 2')) {
    throw new RuntimeException('Uma rota cancelada ainda pode ser aberta diretamente pelo endereço.');
}

if (! str_contains($productionSummary, "->where('status', '<>', 'cancelada')")) {
    throw new RuntimeException('O resumo da produção ainda pode contabilizar formulações canceladas antigas.');
}

if (! is_file($deployMigration)) {
    throw new RuntimeException('A limpeza automática no deploy não foi criada.');
}

$cleanupMigration = (string) file_get_contents($deployMigration);
foreach (['ordens_producao', 'producao_formulacoes_queijo', 'producao_soro_refrigerado', 'producao_formulacoes_creme', 'producao_creme', 'expedicao_ordens'] as $table) {
    if (! str_contains($cleanupMigration, "'{$table}'")) {
        throw new RuntimeException("A limpeza automática não contempla canceladas de {$table}.");
    }
}

if (! str_contains((string) file_get_contents($publishScript), 'php artisan migrate --force')) {
    throw new RuntimeException('O deploy ainda não executa a limpeza automática do banco.');
}

echo "cancellation deletion contract: ok\n";
