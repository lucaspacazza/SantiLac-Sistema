<?php

declare(strict_types=1);

require dirname(__DIR__).'/src/autoload.php';

use SantiLac\Admin\IncidentFingerprint;
use SantiLac\Admin\ProxmoxClient;
use SantiLac\Admin\Redactor;

$failures = [];

function check(bool $condition, string $message): void
{
    global $failures;
    if (! $condition) {
        $failures[] = $message;
    }
}

$first = IncidentFingerprint::make('RuntimeException', 'Falha para pedido 123', '/api/pedidos/123', 500);
$second = IncidentFingerprint::make('RuntimeException', 'Falha para pedido 987', '/api/pedidos/987', 500);
check($first === $second, 'Erros equivalentes devem gerar a mesma assinatura.');

$different = IncidentFingerprint::make('DomainException', 'Falha para pedido 987', '/api/pedidos/987', 500);
check($first !== $different, 'Tipos diferentes não podem ser agrupados.');

check(ProxmoxClient::allowedContainerIds() === [100, 101, 102, 103], 'Somente CTs 100 a 103 podem ser consultados.');
check(! ProxmoxClient::isAllowedContainer(99), 'CT 99 deve ser bloqueado.');
check(ProxmoxClient::isAllowedContainer(103), 'CT 103 deve ser permitido.');

$redacted=Redactor::text('password=segredo123 token: abcdef Authorization: Bearer muito-secreto');
check(!str_contains($redacted,'segredo123')&&!str_contains($redacted,'abcdef')&&!str_contains($redacted,'muito-secreto'),'Segredos devem ser removidos dos incidentes.');

if ($failures !== []) {
    fwrite(STDERR, implode(PHP_EOL, $failures).PHP_EOL);
    exit(1);
}

fwrite(STDOUT, "admin backend tests: ok\n");
