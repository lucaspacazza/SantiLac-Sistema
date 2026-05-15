<?php

use App\Http\Controllers\Api\Qualidade\QualidadeController;
use App\Http\Controllers\Api\Qualidade\RelatoriosController;
use Illuminate\Support\Facades\Route;

Route::prefix('qualidade')->group(function (): void {
    Route::get('/overview', [QualidadeController::class, 'overview']);

    Route::get('/analises', [QualidadeController::class, 'analises']);
    Route::post('/analises/importacoes', [QualidadeController::class, 'importarAnalises']);

    Route::get('/produtores', [QualidadeController::class, 'produtores']);
    Route::get('/produtores/{codigo}', [QualidadeController::class, 'produtor']);
    Route::get('/produtores/{codigo}/analises', [QualidadeController::class, 'analisesDoProdutor']);

    Route::get('/relatorios/resumo', [RelatoriosController::class, 'resumo']);
    Route::get('/relatorios/produtores/{codigo}/pendencias', [RelatoriosController::class, 'pendenciasProdutor']);
    Route::post('/relatorios/exportacoes/produtores-analises', [RelatoriosController::class, 'exportarProdutoresAnalises']);
    Route::post('/relatorios/exportacoes/produtores-analises/pdf', [RelatoriosController::class, 'exportarProdutoresAnalisesPdf']);
    Route::post('/relatorios/exportacoes/produtores/{codigo}/analises', [RelatoriosController::class, 'exportarProdutorAnalises']);
    Route::post('/relatorios/exportacoes/produtores/{codigo}/analises/pdf', [RelatoriosController::class, 'exportarProdutorAnalisesPdf']);
    Route::post('/relatorios/exportacoes/produtores/{codigo}/pendencias', [RelatoriosController::class, 'exportarProdutorPendencias']);
    Route::post('/relatorios/exportacoes/produtores/{codigo}/pendencias/pdf', [RelatoriosController::class, 'exportarProdutorPendenciasPdf']);
    Route::post('/relatorios/exportacoes/fora-padrao', [RelatoriosController::class, 'exportarForaPadrao']);
    Route::post('/relatorios/exportacoes/fora-padrao/pdf', [RelatoriosController::class, 'exportarForaPadraoPdf']);
    Route::post('/relatorios/exportacoes/fora-padrao/{codigo}', [RelatoriosController::class, 'exportarIndicadorForaPadrao']);
    Route::post('/relatorios/exportacoes/fora-padrao/{codigo}/pdf', [RelatoriosController::class, 'exportarIndicadorForaPadraoPdf']);
});
