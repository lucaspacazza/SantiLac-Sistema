<?php

declare(strict_types=1);

require dirname(__DIR__).'/vendor/autoload.php';

use App\Services\Producao\FormulacaoQueijoFinalizationGuard;
use App\Services\Producao\FormulacaoQueijoNumericInput;

$numericPayload = [
    'quantidade_leite' => '10000',
    'temperatura_coagulacao' => '36,5',
    'insumos' => [
        ['tipo_insumo' => 'fermento', 'quantidade' => '0,1'],
        ['tipo_insumo' => 'coalho', 'quantidade' => '1.5'],
    ],
];

if (FormulacaoQueijoNumericInput::pointViolations($numericPayload) !== ['Quantidade do insumo']) {
    throw new RuntimeException('A API não identificou ponto em um campo numérico de insumo.');
}

$numericPayload['insumos'][1]['quantidade'] = 1.5;
if (FormulacaoQueijoNumericInput::pointViolations($numericPayload) !== ['Quantidade do insumo']) {
    throw new RuntimeException('A API antiga ainda consegue enviar decimal com ponto como número JSON.');
}

$numericPayload['insumos'][1]['quantidade'] = '1,5';
$numericPayload['quantidade_leite'] = 10000;
if (FormulacaoQueijoNumericInput::pointViolations($numericPayload) !== ['Quantidade de leite']) {
    throw new RuntimeException('Um cliente antigo ainda consegue ignorar o formato localizado da API.');
}

$numericPayload['quantidade_leite'] = '10000';
$normalizedPayload = FormulacaoQueijoNumericInput::normalize($numericPayload);
if ($normalizedPayload['temperatura_coagulacao'] !== '36.5' || $normalizedPayload['insumos'][0]['quantidade'] !== '0.1') {
    throw new RuntimeException('A API não normalizou a vírgula antes da validação numérica.');
}

$malformedPayload = FormulacaoQueijoNumericInput::normalize(['insumos' => ['inválido']]);
if ($malformedPayload['insumos'] !== ['inválido']) {
    throw new RuntimeException('A normalização alterou um payload malformado antes do validator retornar 422.');
}

$scalarInputs = FormulacaoQueijoNumericInput::normalize(['insumos' => 'inválido']);
if ($scalarInputs['insumos'] !== 'inválido') {
    throw new RuntimeException('A normalização alterou insumos escalares antes do validator retornar 422.');
}

$missing = FormulacaoQueijoFinalizationGuard::missingRequiredInputs([
    ['tipo_insumo' => 'fermento_fast', 'quantidade' => 25],
    ['tipo_insumo' => 'coalho', 'quantidade' => 0],
]);

if ($missing !== ['Coalho', 'Cloreto']) {
    throw new RuntimeException('A trava não identificou os insumos obrigatórios ausentes.');
}

$complete = FormulacaoQueijoFinalizationGuard::missingRequiredInputs([
    ['tipo_insumo' => 'fermento_mvd', 'quantidade' => 0.1],
    ['tipo_insumo' => 'coalho', 'quantidade' => 1],
    ['tipo_insumo' => 'cloreto', 'quantidade' => 1.5],
]);

if ($complete !== []) {
    throw new RuntimeException('A trava recusou uma formulação com todos os insumos obrigatórios.');
}

$serviceSource = (string) file_get_contents(dirname(__DIR__).'/app/Services/Producao/FormulacaoQueijoService.php');

if (! str_contains($serviceSource, 'FormulacaoQueijoFinalizationGuard::missingRequiredInputs')) {
    throw new RuntimeException('A finalização da formulação não executa a trava de insumos obrigatórios.');
}

if (! str_contains($serviceSource, 'ValidationException::withMessages')) {
    throw new RuntimeException('A API não retorna um erro de validação ao recusar a finalização.');
}

$controllerSource = (string) file_get_contents(dirname(__DIR__).'/app/Http/Controllers/Api/Producao/FormulacaoQueijoController.php');
if (! str_contains($controllerSource, 'FormulacaoQueijoNumericInput::pointViolations')
    || ! str_contains($controllerSource, 'FormulacaoQueijoNumericInput::normalize')) {
    throw new RuntimeException('O controller não protege e normaliza todos os campos numéricos da formulação.');
}

echo "formulation finalization guard: ok\n";
