<?php

use App\Http\Controllers\Api\Industrial\IndustrialController;
use Illuminate\Support\Facades\Route;

Route::prefix('industrial')->group(function (): void {
    Route::get('/products', [IndustrialController::class, 'products']);
    Route::post('/products', [IndustrialController::class, 'createProduct']);
    Route::put('/products/{id}', [IndustrialController::class, 'updateProduct']);

    Route::get('/milk-entries', [IndustrialController::class, 'milkEntries']);
    Route::post('/milk-entries', [IndustrialController::class, 'createMilkEntry']);
    Route::get('/milk-entries/{id}', [IndustrialController::class, 'milkEntry']);
    Route::put('/milk-entries/{id}', [IndustrialController::class, 'updateMilkEntry']);

    Route::get('/production-batches', [IndustrialController::class, 'batches']);
    Route::post('/production-batches', [IndustrialController::class, 'createBatch']);
    Route::get('/production-batches/{id}', [IndustrialController::class, 'batch']);
    Route::put('/production-batches/{id}', [IndustrialController::class, 'updateBatch']);
    Route::post('/production-batches/{id}/items', [IndustrialController::class, 'addBatchItem']);
    Route::post('/production-batches/{id}/recalculate', [IndustrialController::class, 'recalculateBatch']);
    Route::post('/production-batches/{id}/close', [IndustrialController::class, 'closeBatch']);
    Route::post('/production-batches/{id}/reopen', [IndustrialController::class, 'reopenBatch']);

    Route::put('/production-items/{id}', [IndustrialController::class, 'updateBatchItem']);
    Route::delete('/production-items/{id}', [IndustrialController::class, 'deleteBatchItem']);

    Route::get('/stock', [IndustrialController::class, 'stock']);
    Route::get('/stock/movements', [IndustrialController::class, 'stockMovements']);
    Route::get('/reports/daily-production', [IndustrialController::class, 'dailyProductionReport']);
});
