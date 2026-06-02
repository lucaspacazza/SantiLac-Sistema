<?php

use App\Http\Controllers\Api\Producao\ProducaoController;
use Illuminate\Support\Facades\Route;

Route::prefix('producao')->group(function (): void {
    Route::get('/overview', [ProducaoController::class, 'overview']);

    Route::get('/formulacoes-queijo', [ProducaoController::class, 'formulacoesQueijo']);
    Route::post('/formulacoes-queijo', [ProducaoController::class, 'criarFormulacaoQueijo']);
    Route::get('/formulacoes-queijo/{id}', [ProducaoController::class, 'formulacaoQueijo']);
    Route::patch('/formulacoes-queijo/{id}', [ProducaoController::class, 'atualizarFormulacaoQueijo']);
    Route::patch('/formulacoes-queijo/{id}/finalizar', [ProducaoController::class, 'finalizarFormulacaoQueijo']);
    Route::patch('/formulacoes-queijo/{id}/cancelar', [ProducaoController::class, 'cancelarFormulacaoQueijo']);
    Route::get('/formulacoes-queijo/{id}/exportar', [ProducaoController::class, 'exportarFormulacaoQueijo']);
    Route::get('/formulacoes-queijo/{id}/exportar/pdf', [ProducaoController::class, 'exportarFormulacaoQueijoPdf']);

    Route::get('/soro-refrigerado', [ProducaoController::class, 'soroRefrigerado']);
    Route::post('/soro-refrigerado', [ProducaoController::class, 'criarSoroRefrigerado']);
    Route::get('/soro-refrigerado/estoque', [ProducaoController::class, 'estoqueSoroRefrigerado']);
    Route::get('/soro-refrigerado/{id}', [ProducaoController::class, 'soroRefrigeradoItem']);
    Route::patch('/soro-refrigerado/{id}', [ProducaoController::class, 'atualizarSoroRefrigerado']);
    Route::patch('/soro-refrigerado/{id}/finalizar', [ProducaoController::class, 'finalizarSoroRefrigerado']);
    Route::patch('/soro-refrigerado/{id}/cancelar', [ProducaoController::class, 'cancelarSoroRefrigerado']);
    Route::get('/soro-refrigerado/{id}/exportar', [ProducaoController::class, 'exportarSoroRefrigerado']);
    Route::get('/soro-refrigerado/{id}/exportar/pdf', [ProducaoController::class, 'exportarSoroRefrigeradoPdf']);

    Route::get('/formulacoes-creme', [ProducaoController::class, 'formulacoesCreme']);
    Route::post('/formulacoes-creme', [ProducaoController::class, 'criarFormulacaoCreme']);
    Route::get('/formulacoes-creme/{id}', [ProducaoController::class, 'formulacaoCreme']);
    Route::patch('/formulacoes-creme/{id}', [ProducaoController::class, 'atualizarFormulacaoCreme']);
    Route::patch('/formulacoes-creme/{id}/finalizar', [ProducaoController::class, 'finalizarFormulacaoCreme']);
    Route::patch('/formulacoes-creme/{id}/cancelar', [ProducaoController::class, 'cancelarFormulacaoCreme']);
    Route::get('/formulacoes-creme/{id}/exportar', [ProducaoController::class, 'exportarFormulacaoCreme']);
    Route::get('/formulacoes-creme/{id}/exportar/pdf', [ProducaoController::class, 'exportarFormulacaoCremePdf']);

    Route::get('/producoes-creme', [ProducaoController::class, 'producoesCreme']);
    Route::post('/producoes-creme', [ProducaoController::class, 'criarProducaoCreme']);
    Route::get('/producoes-creme/{id}', [ProducaoController::class, 'producaoCreme']);
    Route::patch('/producoes-creme/{id}', [ProducaoController::class, 'atualizarProducaoCreme']);
    Route::patch('/producoes-creme/{id}/finalizar', [ProducaoController::class, 'finalizarProducaoCreme']);
    Route::patch('/producoes-creme/{id}/cancelar', [ProducaoController::class, 'cancelarProducaoCreme']);
    Route::get('/producoes-creme/{id}/exportar', [ProducaoController::class, 'exportarProducaoCreme']);
    Route::get('/producoes-creme/{id}/exportar/pdf', [ProducaoController::class, 'exportarProducaoCremePdf']);

});
