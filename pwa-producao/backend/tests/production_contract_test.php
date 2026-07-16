<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$routes = file_get_contents($root.'/routes/web.php');

$contracts = [
    'FormulacaoCremeController' => [
        $root.'/app/Http/Controllers/Api/Producao/FormulacaoCremeController.php',
        '/formulacoes-creme',
    ],
    'ProducaoCremeController' => [
        $root.'/app/Http/Controllers/Api/Producao/ProducaoCremeController.php',
        '/producoes-creme',
    ],
];

foreach ($contracts as $controller => [$file, $route]) {
    if (! is_file($file)) {
        throw new RuntimeException("Controller ausente: {$controller}");
    }

    if (! str_contains((string) $routes, $controller)) {
        throw new RuntimeException("Controller sem import ou rota: {$controller}");
    }

    if (! str_contains((string) $routes, $route)) {
        throw new RuntimeException("Rota ausente: {$route}");
    }
}

$ordemController = $root.'/app/Http/Controllers/Api/Producao/OrdemProducaoController.php';
$ordemService = $root.'/app/Services/Producao/OrdemProducaoService.php';
$ordemControllerSource = file_get_contents($ordemController);
$ordemServiceSource = file_get_contents($ordemService);

if (! str_contains((string) $routes, '/ordens-producao/{id}/finalizar')) {
    throw new RuntimeException('Rota de finalização da OP ausente.');
}

if (! str_contains((string) $ordemControllerSource, 'function finalizar')) {
    throw new RuntimeException('Controller não permite finalizar OP.');
}

if (! str_contains((string) $ordemServiceSource, 'function finalizar')) {
    throw new RuntimeException('Service não permite finalizar OP.');
}

if (! str_contains((string) $routes, '/ordens-producao/{id}/cancelar')) {
    throw new RuntimeException('Rota de cancelamento da OP ausente.');
}

if (! str_contains((string) $ordemControllerSource, 'function cancelar')) {
    throw new RuntimeException('Controller não permite cancelar OP.');
}

if (! str_contains((string) $ordemServiceSource, 'function cancelar')) {
    throw new RuntimeException('Service não permite cancelar OP.');
}

$cancelStart = strpos((string) $ordemServiceSource, 'function cancelar');
$cancelEnd = strpos((string) $ordemServiceSource, 'function gerarDaFormulacao', $cancelStart + 1);
$cancelSource = substr((string) $ordemServiceSource, $cancelStart, $cancelEnd - $cancelStart);
if (! str_contains($cancelSource, "'ordem_producao_id' => null") || ! str_contains($cancelSource, '->delete()')) {
    throw new RuntimeException('Cancelar OP no PWA ainda não exclui definitivamente a ordem.');
}

$baseFormSource = (string) file_get_contents($root.'/app/Services/Producao/BaseFormularioService.php');
$formCancelStart = strpos($baseFormSource, 'function cancelarFormulario');
$formCancelEnd = strpos($baseFormSource, 'function status', $formCancelStart + 1);
$formCancelSource = substr($baseFormSource, $formCancelStart, $formCancelEnd - $formCancelStart);
if (! str_contains($formCancelSource, '->delete()') || str_contains($formCancelSource, "status = 'cancelada'")) {
    throw new RuntimeException('Cancelar ficha no PWA ainda preserva status cancelado.');
}

if (! str_contains((string) $routes, "Route::patch('/ordens-producao/{id}',")) {
    throw new RuntimeException('Rota de edição da OP ausente.');
}

if (! str_contains((string) $ordemControllerSource, 'function atualizar')) {
    throw new RuntimeException('Controller não permite editar OP.');
}

if (! str_contains((string) $ordemServiceSource, 'function atualizar')) {
    throw new RuntimeException('Service não permite editar OP.');
}

if (! str_contains((string) $ordemServiceSource, "status ?? 'rascunho') !== 'rascunho'")) {
    throw new RuntimeException('Edição da OP não está bloqueada depois do rascunho.');
}

if (! str_contains((string) $ordemServiceSource, 'lockForUpdate()')) {
    throw new RuntimeException('Edição da OP não protege a transição concorrente de status.');
}

foreach ([
    "whereDate('data_ordem', \$data)",
    "where('tipo_queijo', \$tipoQueijo)",
    'camposAutomaticos($formulacoes)',
    "'status' => \$this->isMussarela(\$tipoQueijo) ? 'aguardando_formato' : 'rascunho'",
    "'ordem_producao_id' => \$ordem->id",
] as $contract) {
    if (! str_contains((string) $ordemServiceSource, $contract)) {
        throw new RuntimeException("Agrupamento diário da OP ausente: {$contract}");
    }
}

foreach (glob($root.'/app/Models/Producao/*.php') as $model) {
    if (! str_contains((string) file_get_contents($model), 'ExcludesCancelledRecords')) {
        throw new RuntimeException('Um modelo do PWA ainda pode expor canceladas antigas: '.basename($model));
    }
}

echo "production backend contract: ok\n";
