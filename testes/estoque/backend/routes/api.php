<?php

use App\Http\Controllers\Api\Estoque\EstoqueController;
use Illuminate\Support\Facades\Route;

Route::prefix('estoque')->group(function (): void {
    Route::get('/overview', [EstoqueController::class, 'overview']);
    Route::get('/categorias', [EstoqueController::class, 'categorias']);

    Route::get('/itens', [EstoqueController::class, 'itens']);
    Route::post('/itens', [EstoqueController::class, 'criarItem']);
    Route::get('/itens/{id}', [EstoqueController::class, 'item']);
    Route::patch('/itens/{id}', [EstoqueController::class, 'atualizarItem']);

    Route::get('/movimentos', [EstoqueController::class, 'movimentos']);
    Route::post('/movimentos', [EstoqueController::class, 'registrarMovimento']);
});
