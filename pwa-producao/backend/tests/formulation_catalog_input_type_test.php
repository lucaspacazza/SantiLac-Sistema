<?php

declare(strict_types=1);

require dirname(__DIR__).'/vendor/autoload.php';

use App\Services\Producao\FormulacaoQueijoService;

$method = new ReflectionMethod(FormulacaoQueijoService::class, 'tipoInsumoPorNome');
$service = new FormulacaoQueijoService();

foreach (['BVADD', 'Fermento BVADD', 'QDT', 'Fermento QDT'] as $name) {
    if ($method->invoke($service, $name) !== 'fermento') {
        throw new RuntimeException("{$name} precisa ser classificado como fermento no catálogo da formulação.");
    }
}

echo "formulation catalog input type: ok\n";
