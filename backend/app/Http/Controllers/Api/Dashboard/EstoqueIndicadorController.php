<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\EstoqueIndicadorService;
use Illuminate\Http\JsonResponse;

class EstoqueIndicadorController extends Controller
{
    public function __invoke(EstoqueIndicadorService $estoque): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $estoque->resumo()]);
    }
}
