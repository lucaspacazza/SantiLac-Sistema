<?php

$projectRoot = dirname(__DIR__, 2);
$controllers = [
    $projectRoot.'/backend/app/Http/Controllers/Api/AuthController.php',
    $projectRoot.'/pwa-producao/backend/app/Http/Controllers/Api/AuthController.php',
];

foreach ($controllers as $controller) {
    $source = file_get_contents($controller);

    assert($source !== false, "Could not read {$controller}");
    assert(str_contains($source, "'session_lifetime_seconds'"));
    assert(str_contains($source, "config('session.lifetime'"));
}

echo "auth session lifetime contract passed\n";
