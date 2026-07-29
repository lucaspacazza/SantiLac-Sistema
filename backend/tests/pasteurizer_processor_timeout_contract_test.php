<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents(
    $root.'/app/Services/Pasteurizador/PasteurizadorService.php'
);
$servicesConfig = (string) file_get_contents($root.'/config/services.php');

if (! str_contains(
    $servicesConfig,
    "'timeout_seconds' => (int) env('PASTEURIZADOR_PROCESSOR_TIMEOUT_SECONDS', 3600)"
)) {
    throw new RuntimeException(
        'A configuracao ainda nao oferece uma janela de uma hora para a coleta.'
    );
}

if (! str_contains(
    $service,
    "config('services.pasteurizador.timeout_seconds', 3600)"
)) {
    throw new RuntimeException(
        'O backend ainda usa o timeout curto fixo ao acionar o processador.'
    );
}

echo "pasteurizer processor timeout contract: ok\n";
