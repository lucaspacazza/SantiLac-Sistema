<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents(
    $root.'/app/Services/Pasteurizador/PasteurizadorService.php'
);
$servicesConfig = (string) file_get_contents($root.'/config/services.php');
$pwaServicesConfig = (string) file_get_contents(
    dirname($root).'/pwa-producao/backend/config/services.php'
);

if (! str_contains(
    $servicesConfig,
    "'timeout_seconds' => (int) env('PASTEURIZADOR_PROCESSOR_TIMEOUT_SECONDS', 10800)"
)) {
    throw new RuntimeException(
        'A configuracao ainda nao oferece uma janela de tres horas para a coleta.'
    );
}

if (! str_contains(
    $pwaServicesConfig,
    "'timeout_seconds' => (int) env('PASTEURIZADOR_PROCESSOR_TIMEOUT_SECONDS', 10800)"
)) {
    throw new RuntimeException(
        'O backend PWA ainda usa a janela curta do processador.'
    );
}

if (! str_contains(
    $service,
    "config('services.pasteurizador.timeout_seconds', 10800)"
)) {
    throw new RuntimeException(
        'O backend ainda usa o timeout curto fixo ao acionar o processador.'
    );
}

if (! str_contains(
    (string) file_get_contents(
        $root.'/app/Http/Controllers/Api/Pasteurizador/PasteurizadorController.php'
    ),
    "config('services.pasteurizador.timeout_seconds', 10800)"
)) {
    throw new RuntimeException(
        'O endpoint de ingestao ainda usa um limite curto fixo.'
    );
}

echo "pasteurizer processor timeout contract: ok\n";
