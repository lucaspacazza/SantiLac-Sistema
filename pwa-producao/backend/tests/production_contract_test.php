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

echo "production backend contract: ok\n";
