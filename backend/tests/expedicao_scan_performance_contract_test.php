<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents($root.'/app/Services/Expedicao/ExpedicaoService.php');
$methodStart = strpos($service, 'public function escanearPalete');
$methodEnd = strpos($service, 'public function concluirCarregamento', $methodStart ?: 0);

if ($methodStart === false || $methodEnd === false) {
    throw new RuntimeException('Fluxo de leitura de palete não encontrado.');
}

$scanMethod = substr($service, $methodStart, $methodEnd - $methodStart);

if (str_contains($scanMethod, '$this->ordem(')) {
    throw new RuntimeException('A leitura ainda remonta a ordem inteira dentro da transação.');
}

foreach (["'palete_id'", "'status_carregamento'", "'caixas'"] as $contract) {
    if (! str_contains($scanMethod, $contract)) {
        throw new RuntimeException("Resposta incremental do palete sem {$contract}.");
    }
}

echo "expedicao scan performance contract: ok\n";
