<?php

use App\Http\Controllers\Api\Qualidade\QualidadeController;
use Illuminate\Support\Facades\Route;

Route::prefix('qualidade')->group(function (): void {
    Route::get('/overview', [QualidadeController::class, 'overview']);

    Route::get('/analises', [QualidadeController::class, 'analises']);

    Route::get('/produtores', [QualidadeController::class, 'produtores']);
    Route::get('/produtores/{codigo}', [QualidadeController::class, 'produtor']);
    Route::get('/produtores/{codigo}/analises', [QualidadeController::class, 'analisesDoProdutor']);

    Route::get('/relatorios/resumo', [QualidadeController::class, 'relatoriosResumo']);
    Route::get('/relatorios/produtores', [QualidadeController::class, 'relatoriosProdutores']);
});
