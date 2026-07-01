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

echo "production backend contract: ok\n";
