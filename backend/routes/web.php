<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Combustivel\CombustivelController;
use App\Http\Controllers\Api\Estoque\EstoqueController;
use App\Http\Controllers\Api\Pasteurizador\PasteurizadorController;
use App\Http\Controllers\Api\ProdutorController;
use App\Http\Controllers\Api\Producao\FormulacaoCremeController;
use App\Http\Controllers\Api\Producao\FormulacaoQueijoController;
use App\Http\Controllers\Api\Producao\OrdemProducaoController;
use App\Http\Controllers\Api\Producao\ProducaoController;
use App\Http\Controllers\Api\Producao\ProducaoCremeController;
use App\Http\Controllers\Api\Producao\SoroRefrigeradoController;
use App\Http\Controllers\Api\Qualidade\QualidadeController;
use App\Http\Controllers\Api\Qualidade\RelatoriosController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/auth')->group(function (): void {
    Route::get('/csrf', [AuthController::class, 'csrf']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');
});

Route::post('/api/pasteurizador/coletas', [PasteurizadorController::class, 'criarColeta'])
    ->middleware('throttle:6,1');

Route::middleware(['auth', 'audit.action'])->prefix('api')->group(function (): void {
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
        Route::post('/relatorios/exportacoes/produtores/{codigo}/analises', [RelatoriosController::class, 'exportarProdutorAnalises']);
        Route::post('/relatorios/exportacoes/produtores/{codigo}/analises/pdf', [RelatoriosController::class, 'exportarProdutorAnalisesPdf']);
        Route::post('/relatorios/exportacoes/produtores/{codigo}/pendencias', [RelatoriosController::class, 'exportarProdutorPendencias']);
        Route::post('/relatorios/exportacoes/produtores/{codigo}/pendencias/pdf', [RelatoriosController::class, 'exportarProdutorPendenciasPdf']);
        Route::post('/relatorios/exportacoes/fora-padrao', [RelatoriosController::class, 'exportarForaPadrao']);
        Route::post('/relatorios/exportacoes/fora-padrao/pdf', [RelatoriosController::class, 'exportarForaPadraoPdf']);
        Route::post('/relatorios/exportacoes/fora-padrao/{codigo}', [RelatoriosController::class, 'exportarIndicadorForaPadrao']);
        Route::post('/relatorios/exportacoes/fora-padrao/{codigo}/pdf', [RelatoriosController::class, 'exportarIndicadorForaPadraoPdf']);
    });

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

    Route::prefix('combustivel')->group(function (): void {
        Route::get('/resumo', [CombustivelController::class, 'resumo']);
        Route::post('/entrada', [CombustivelController::class, 'entrada']);
        Route::post('/saida', [CombustivelController::class, 'saida']);
        Route::get('/historico', [CombustivelController::class, 'historico']);
        Route::get('/logs', [CombustivelController::class, 'logs']);
        Route::get('/usuarios', [CombustivelController::class, 'usuarios']);
        Route::get('/motoristas', [CombustivelController::class, 'motoristas']);
        Route::get('/caminhoes', [CombustivelController::class, 'caminhoes']);
    });

    Route::prefix('pasteurizador')->group(function (): void {
        Route::get('/overview', [PasteurizadorController::class, 'overview']);
        Route::get('/coletas', [PasteurizadorController::class, 'coletas']);
        Route::post('/coletar-agora', [PasteurizadorController::class, 'coletarAgora']);
        Route::get('/coletas/{id}', [PasteurizadorController::class, 'coleta']);
        Route::get('/coletas/{id}/amostras', [PasteurizadorController::class, 'amostras']);
        Route::get('/coletas/{id}/exportar.csv', [PasteurizadorController::class, 'exportarCsv']);
        Route::get('/amostras', [PasteurizadorController::class, 'amostrasPeriodo']);
        Route::get('/amostras/exportar.csv', [PasteurizadorController::class, 'exportarCsvPeriodo']);
        Route::get('/amostras/exportar.pdf', [PasteurizadorController::class, 'exportarPdfPeriodo']);
    });

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
});

Route::view('/login', 'app')->name('login');
Route::view('/{path?}', 'app')->where('path', '.*');
