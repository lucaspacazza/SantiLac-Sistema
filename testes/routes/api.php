<?php

use App\Http\Controllers\Api\Laboratorio\LaboratorioController;
use App\Http\Controllers\Api\Producao\ProducaoController;
use Illuminate\Support\Facades\Route;

Route::prefix('producao')->group(function (): void {
    Route::get('/overview', [ProducaoController::class, 'overview']);

    Route::get('/formulacoes-queijo', [ProducaoController::class, 'formulacoesQueijo']);
    Route::post('/formulacoes-queijo', [ProducaoController::class, 'criarFormulacaoQueijo']);
    Route::get('/formulacoes-queijo/{id}', [ProducaoController::class, 'formulacaoQueijo']);
    Route::patch('/formulacoes-queijo/{id}', [ProducaoController::class, 'atualizarFormulacaoQueijo']);
    Route::patch('/formulacoes-queijo/{id}/finalizar', [ProducaoController::class, 'finalizarFormulacaoQueijo']);
});

Route::prefix('laboratorio')->group(function (): void {
    Route::get('/overview', [LaboratorioController::class, 'overview']);

    Route::get('/cronogramas', [LaboratorioController::class, 'cronogramas']);
    Route::post('/cronogramas', [LaboratorioController::class, 'criarCronograma']);
    Route::get('/cronogramas/{id}', [LaboratorioController::class, 'cronograma']);
});
