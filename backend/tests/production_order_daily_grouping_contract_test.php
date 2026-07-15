<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);
$service = file_get_contents($root.'/backend/app/Services/Producao/OrdemProducaoService.php');
$model = file_get_contents($root.'/backend/app/Models/Producao/ProducaoFormulacaoQueijo.php');
$routes = file_get_contents($root.'/backend/routes/web.php');
$controller = file_get_contents($root.'/backend/app/Http/Controllers/Api/Producao/OrdemProducaoController.php');
$frontendApi = file_get_contents($root.'/frontend/src/modules/producao/api/producaoApi.ts');
$frontendModule = file_get_contents($root.'/frontend/src/modules/producao/ProducaoModule.tsx');
$frontendView = file_get_contents($root.'/frontend/src/modules/producao/views/OrdemProducao/VisualizacaoOrdemProducao.tsx');
$deployMigration = $root.'/backend/database/migrations/2026_07_15_000001_group_production_orders_by_day_and_cheese.php';

if (! is_file($deployMigration)) {
    throw new RuntimeException('Migração versionada do agrupamento diário ausente do deploy.');
}

$migrationSource = file_get_contents($deployMigration);

foreach (['ordem_producao_id', 'tipo_queijo'] as $column) {
    if (! str_contains((string) $migrationSource, $column)) {
        throw new RuntimeException("Migração não prepara a coluna {$column}.");
    }
}

if (! str_contains((string) $model, "'ordem_producao_id'")) {
    throw new RuntimeException('Formulação não guarda vínculo com a OP diária.');
}

foreach ([
    "whereDate('data_ordem', \$data)",
    "where('tipo_queijo', \$tipoQueijo)",
    'camposAutomaticos($formulacoes)',
    "'status' => \$this->isMussarela(\$tipoQueijo) ? 'aguardando_formato' : 'rascunho'",
    "'ordem_producao_id' => \$ordem->id",
] as $contract) {
    if (! str_contains((string) $service, $contract)) {
        throw new RuntimeException("Contrato de agrupamento diário ausente: {$contract}");
    }
}

if (! str_contains((string) $service, 'reconciliarOrdensDiarias')) {
    throw new RuntimeException('Não existe rotina para consolidar as OPs antigas.');
}

if (! str_contains((string) $service, 'backfillVinculosLegados')) {
    throw new RuntimeException('A reconciliação não prepara os vínculos das OPs antigas.');
}

foreach ([
    "Route::patch('/ordens-producao/{id}',",
    'function atualizar',
] as $contract) {
    if (! str_contains((string) $routes.$controller.$service, $contract)) {
        throw new RuntimeException("Contrato de edição da OP aberta ausente: {$contract}");
    }
}

foreach ([
    'atualizarOrdemProducao:',
    'finalizarOrdemProducao:',
    'async function finalizeOrdemProducao',
    'onFinalize={finalizeOrdemProducao}',
    'onFinalize: () => void',
    'Finalizar OP',
] as $contract) {
    if (! str_contains((string) $frontendApi.$frontendModule.$frontendView, $contract)) {
        throw new RuntimeException("Fluxo manual da OP diária ausente: {$contract}");
    }
}

echo "production daily order grouping contract: ok\n";
