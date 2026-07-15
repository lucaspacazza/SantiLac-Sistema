<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Producao\FormulacaoCremeController;
use App\Http\Controllers\Api\Producao\FormulacaoQueijoController;
use App\Http\Controllers\Api\Producao\OrdemProducaoController;
use App\Http\Controllers\Api\Producao\ProducaoCremeController;
use App\Http\Controllers\Api\Producao\ProducaoController;
use App\Http\Controllers\Api\Producao\SoroRefrigeradoController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/fabrica/auth')->group(function (): void {
    Route::get('/csrf', [AuthController::class, 'csrf']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');
});

Route::middleware(['auth', 'audit.action'])
    ->prefix('api/fabrica/producao')
    ->group(function (): void {
        Route::get('/overview', [ProducaoController::class, 'overview']);

        Route::get('/ordens-producao/catalogos', [OrdemProducaoController::class, 'catalogos']);
        Route::get('/ordens-producao', [OrdemProducaoController::class, 'index']);
        Route::get('/ordens-producao/{id}', [OrdemProducaoController::class, 'show'])->whereNumber('id');
        Route::post('/ordens-producao', [OrdemProducaoController::class, 'store']);
        Route::patch('/ordens-producao/{id}', [OrdemProducaoController::class, 'atualizar'])->whereNumber('id');
        Route::patch('/ordens-producao/{id}/definir-formato', [OrdemProducaoController::class, 'definirFormato'])->whereNumber('id');
        Route::patch('/ordens-producao/{id}/finalizar', [OrdemProducaoController::class, 'finalizar'])->whereNumber('id');
        Route::patch('/ordens-producao/{id}/cancelar', [OrdemProducaoController::class, 'cancelar'])->whereNumber('id');
        Route::post('/formulacoes-queijo/{id}/gerar-op', [OrdemProducaoController::class, 'gerarDaFormulacao'])
            ->whereNumber('id');

        Route::get('/formulacoes-queijo/catalogos', [FormulacaoQueijoController::class, 'catalogos']);
        Route::get('/formulacoes-queijo', [FormulacaoQueijoController::class, 'index']);
        Route::post('/formulacoes-queijo', [FormulacaoQueijoController::class, 'store']);
        Route::get('/formulacoes-queijo/{id}', [FormulacaoQueijoController::class, 'show'])->whereNumber('id');
        Route::patch('/formulacoes-queijo/{id}', [FormulacaoQueijoController::class, 'update'])->whereNumber('id');
        Route::patch('/formulacoes-queijo/{id}/finalizar', [FormulacaoQueijoController::class, 'finalizar'])->whereNumber('id');
        Route::patch('/formulacoes-queijo/{id}/cancelar', [FormulacaoQueijoController::class, 'cancelar'])->whereNumber('id');

        Route::get('/soro-refrigerado', [SoroRefrigeradoController::class, 'index']);
        Route::post('/soro-refrigerado', [SoroRefrigeradoController::class, 'store']);
        Route::get('/soro-refrigerado/estoque', [SoroRefrigeradoController::class, 'estoque']);
        Route::get('/soro-refrigerado/{id}', [SoroRefrigeradoController::class, 'show'])->whereNumber('id');
        Route::patch('/soro-refrigerado/{id}', [SoroRefrigeradoController::class, 'update'])->whereNumber('id');
        Route::patch('/soro-refrigerado/{id}/finalizar', [SoroRefrigeradoController::class, 'finalizar'])->whereNumber('id');
        Route::patch('/soro-refrigerado/{id}/cancelar', [SoroRefrigeradoController::class, 'cancelar'])->whereNumber('id');

        Route::get('/formulacoes-creme', [FormulacaoCremeController::class, 'index']);
        Route::post('/formulacoes-creme', [FormulacaoCremeController::class, 'store']);
        Route::get('/formulacoes-creme/{id}', [FormulacaoCremeController::class, 'show'])->whereNumber('id');
        Route::patch('/formulacoes-creme/{id}', [FormulacaoCremeController::class, 'update'])->whereNumber('id');
        Route::patch('/formulacoes-creme/{id}/finalizar', [FormulacaoCremeController::class, 'finalizar'])->whereNumber('id');
        Route::patch('/formulacoes-creme/{id}/cancelar', [FormulacaoCremeController::class, 'cancelar'])->whereNumber('id');

        Route::get('/producoes-creme', [ProducaoCremeController::class, 'index']);
        Route::post('/producoes-creme', [ProducaoCremeController::class, 'store']);
        Route::get('/producoes-creme/{id}', [ProducaoCremeController::class, 'show'])->whereNumber('id');
        Route::patch('/producoes-creme/{id}', [ProducaoCremeController::class, 'update'])->whereNumber('id');
        Route::patch('/producoes-creme/{id}/finalizar', [ProducaoCremeController::class, 'finalizar'])->whereNumber('id');
        Route::patch('/producoes-creme/{id}/cancelar', [ProducaoCremeController::class, 'cancelar'])->whereNumber('id');
    });
