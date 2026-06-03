<?php

use App\Http\Controllers\Api\Producao\FormulacaoCremeController;
use App\Http\Controllers\Api\Producao\FormulacaoQueijoController;
use App\Http\Controllers\Api\Producao\OrdemProducaoController;
use App\Http\Controllers\Api\Producao\ProducaoController;
use App\Http\Controllers\Api\Producao\ProducaoCremeController;
use App\Http\Controllers\Api\Producao\SoroRefrigeradoController;
use Illuminate\Support\Facades\Route;

Route::prefix('producao')->group(function (): void {
    Route::get('/overview', [ProducaoController::class, 'overview']);

    Route::get('/ordens-producao/catalogos', [OrdemProducaoController::class, 'catalogos']);
    Route::get('/ordens-producao/exportar/{formato}', [OrdemProducaoController::class, 'exportarDia'])
        ->whereIn('formato', ['xlsx', 'pdf']);
    Route::get('/ordens-producao', [OrdemProducaoController::class, 'index']);
    Route::get('/ordens-producao/{id}/exportar/{formato}', [OrdemProducaoController::class, 'exportar'])
        ->whereNumber('id')
        ->whereIn('formato', ['xlsx', 'pdf']);
    Route::get('/ordens-producao/{id}', [OrdemProducaoController::class, 'show'])->whereNumber('id');
    Route::post('/ordens-producao', [OrdemProducaoController::class, 'store']);
    Route::post('/formulacoes-queijo/{id}/gerar-op', [OrdemProducaoController::class, 'gerarDaFormulacao']);

    Route::get('/formulacoes-queijo/catalogos', [FormulacaoQueijoController::class, 'catalogos']);
    Route::get('/formulacoes-queijo', [FormulacaoQueijoController::class, 'index']);
    Route::post('/formulacoes-queijo', [FormulacaoQueijoController::class, 'store']);
    Route::get('/formulacoes-queijo/{id}', [FormulacaoQueijoController::class, 'show']);
    Route::patch('/formulacoes-queijo/{id}', [FormulacaoQueijoController::class, 'update']);
    Route::patch('/formulacoes-queijo/{id}/finalizar', [FormulacaoQueijoController::class, 'finalizar']);
    Route::patch('/formulacoes-queijo/{id}/cancelar', [FormulacaoQueijoController::class, 'cancelar']);
    Route::get('/formulacoes-queijo/{id}/exportar', [FormulacaoQueijoController::class, 'exportar']);
    Route::get('/formulacoes-queijo/{id}/exportar/pdf', [FormulacaoQueijoController::class, 'exportarPdf']);

    Route::get('/soro-refrigerado', [SoroRefrigeradoController::class, 'index']);
    Route::post('/soro-refrigerado', [SoroRefrigeradoController::class, 'store']);
    Route::get('/soro-refrigerado/estoque', [SoroRefrigeradoController::class, 'estoque']);
    Route::get('/soro-refrigerado/{id}', [SoroRefrigeradoController::class, 'show']);
    Route::patch('/soro-refrigerado/{id}', [SoroRefrigeradoController::class, 'update']);
    Route::patch('/soro-refrigerado/{id}/finalizar', [SoroRefrigeradoController::class, 'finalizar']);
    Route::patch('/soro-refrigerado/{id}/cancelar', [SoroRefrigeradoController::class, 'cancelar']);
    Route::get('/soro-refrigerado/{id}/exportar', [SoroRefrigeradoController::class, 'exportar']);
    Route::get('/soro-refrigerado/{id}/exportar/pdf', [SoroRefrigeradoController::class, 'exportarPdf']);

    Route::get('/formulacoes-creme', [FormulacaoCremeController::class, 'index']);
    Route::post('/formulacoes-creme', [FormulacaoCremeController::class, 'store']);
    Route::get('/formulacoes-creme/{id}', [FormulacaoCremeController::class, 'show']);
    Route::patch('/formulacoes-creme/{id}', [FormulacaoCremeController::class, 'update']);
    Route::patch('/formulacoes-creme/{id}/finalizar', [FormulacaoCremeController::class, 'finalizar']);
    Route::patch('/formulacoes-creme/{id}/cancelar', [FormulacaoCremeController::class, 'cancelar']);
    Route::get('/formulacoes-creme/{id}/exportar', [FormulacaoCremeController::class, 'exportar']);
    Route::get('/formulacoes-creme/{id}/exportar/pdf', [FormulacaoCremeController::class, 'exportarPdf']);

    Route::get('/producoes-creme', [ProducaoCremeController::class, 'index']);
    Route::post('/producoes-creme', [ProducaoCremeController::class, 'store']);
    Route::get('/producoes-creme/{id}', [ProducaoCremeController::class, 'show']);
    Route::patch('/producoes-creme/{id}', [ProducaoCremeController::class, 'update']);
    Route::patch('/producoes-creme/{id}/finalizar', [ProducaoCremeController::class, 'finalizar']);
    Route::patch('/producoes-creme/{id}/cancelar', [ProducaoCremeController::class, 'cancelar']);
    Route::get('/producoes-creme/{id}/exportar', [ProducaoCremeController::class, 'exportar']);
    Route::get('/producoes-creme/{id}/exportar/pdf', [ProducaoCremeController::class, 'exportarPdf']);
});
