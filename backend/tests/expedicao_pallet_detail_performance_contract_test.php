<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents($root.'/app/Services/Expedicao/ExpedicaoService.php');
$routes = (string) file_get_contents($root.'/routes/web.php');
$controller = (string) file_get_contents($root.'/app/Http/Controllers/Api/Expedicao/ExpedicaoController.php');

if (! str_contains($routes, '/paletes/{id}/conteudo')) {
    throw new RuntimeException('Endpoint leve de conteúdo do palete ausente.');
}

if (! str_contains($controller, 'conteudoPalete')) {
    throw new RuntimeException('Controller não expõe o conteúdo leve do palete.');
}

$methodStart = strpos($service, 'public function conteudoPalete');
$methodEnd = strpos($service, 'public function ', ($methodStart ?: 0) + 20);
if ($methodStart === false || $methodEnd === false) {
    throw new RuntimeException('Serviço de conteúdo do palete ausente.');
}

$method = substr($service, $methodStart, $methodEnd - $methodStart);
if (substr_count($method, '->get(') !== 1) {
    throw new RuntimeException('Conteúdo do palete deve usar uma única consulta de caixas.');
}

foreach (["'lotes'", "'caixas'", "groupBy('lote_id')"] as $contract) {
    if (! str_contains($method, $contract)) {
        throw new RuntimeException("Contrato de conteúdo do palete sem {$contract}.");
    }
}

echo "expedicao pallet detail performance contract: ok\n";
