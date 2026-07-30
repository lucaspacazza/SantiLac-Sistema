<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\ProdutoresIndicadorService;
use Illuminate\Http\JsonResponse;

class ProdutoresIndicadorController extends Controller
{
    public function __invoke(ProdutoresIndicadorService $produtores): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total' => $produtores->total(),
            ],
        ]);
    }
}
