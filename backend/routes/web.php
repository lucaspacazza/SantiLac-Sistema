<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProdutorController;
use App\Http\Controllers\Api\Qualidade\QualidadeController;
use App\Http\Controllers\Api\Qualidade\RelatoriosController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/auth')->group(function (): void {
    Route::get('/csrf', [AuthController::class, 'csrf']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');
});

Route::middleware('auth')->prefix('api')->group(function (): void {
    Route::prefix('produtores')->group(function (): void {
        Route::get('/', [ProdutorController::class, 'index']);
        Route::get('/{codigo}', [ProdutorController::class, 'show']);
    });

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
    });
});

Route::view('/login', 'app')->name('login');
Route::view('/{path?}', 'app')->where('path', '.*');
