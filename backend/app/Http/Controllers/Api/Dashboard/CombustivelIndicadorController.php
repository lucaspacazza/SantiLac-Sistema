<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\CombustivelIndicadorService;
use Illuminate\Http\JsonResponse;

class CombustivelIndicadorController extends Controller
{
    public function __invoke(CombustivelIndicadorService $combustivel): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $combustivel->resumo()]);
    }
}
