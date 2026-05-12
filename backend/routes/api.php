<?php

use App\Http\Controllers\Api\ProdutorController;
use Illuminate\Support\Facades\Route;

Route::prefix('produtores')->group(function (): void {
    Route::get('/', [ProdutorController::class, 'index']);
    Route::get('/{codigo}', [ProdutorController::class, 'show']);
});
