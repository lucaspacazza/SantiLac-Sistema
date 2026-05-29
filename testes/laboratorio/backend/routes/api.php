<?php

use App\Http\Controllers\Api\Laboratorio\LaboratorioController;
use Illuminate\Support\Facades\Route;

Route::prefix('laboratorio')->group(function (): void {
    Route::get('/overview', [LaboratorioController::class, 'overview']);

    Route::get('/cronogramas', [LaboratorioController::class, 'cronogramas']);
    Route::post('/cronogramas', [LaboratorioController::class, 'criarCronograma']);
    Route::get('/cronogramas/{id}', [LaboratorioController::class, 'cronograma']);

    Route::get('/agua-filagem', [LaboratorioController::class, 'aguaFilagem']);
    Route::post('/agua-filagem', [LaboratorioController::class, 'criarAguaFilagem']);
    Route::get('/agua-filagem/{id}', [LaboratorioController::class, 'aguaFilagemItem']);
    Route::patch('/agua-filagem/{id}', [LaboratorioController::class, 'atualizarAguaFilagem']);
    Route::patch('/agua-filagem/{id}/finalizar', [LaboratorioController::class, 'finalizarAguaFilagem']);
});
