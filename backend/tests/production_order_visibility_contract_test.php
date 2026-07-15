<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$service = (string) file_get_contents($root.'/app/Services/Producao/OrdemProducaoService.php');
$exportacao = (string) file_get_contents($root.'/app/Services/Producao/OrdemProducaoExportacaoService.php');
$overview = (string) file_get_contents($root.'/app/Services/Producao/ProducaoOverviewService.php');

if (! str_contains(
    $service,
    "return ProducaoOrdemProducao::query()\n            ->where('status', '!=', 'cancelada')"
)) {
    throw new RuntimeException('A listagem do sistema ainda pode exibir OP cancelada.');
}

if (! str_contains(
    $service,
    "ProducaoOrdemProducao::query()\n            ->where('id', \$id)\n            ->where('status', '!=', 'cancelada')"
)) {
    throw new RuntimeException('O detalhe do sistema ainda permite abrir OP cancelada.');
}

if (! str_contains(
    $exportacao,
    "ProducaoOrdemProducao::query()\n            ->where('status', '!=', 'cancelada')\n            ->whereDate('data_ordem', \$data)"
)) {
    throw new RuntimeException('A exportacao diaria ainda pode incluir OP cancelada.');
}

if (! str_contains(
    $overview,
    "ProducaoOrdemProducao::query()->where('status', '!=', 'cancelada')->count()"
)) {
    throw new RuntimeException('O total do sistema ainda contabiliza OP cancelada.');
}

echo "production order visibility contract: ok\n";
