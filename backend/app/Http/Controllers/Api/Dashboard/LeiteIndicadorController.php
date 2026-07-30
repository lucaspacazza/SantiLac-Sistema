<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\LeiteIndicadorService;
use Illuminate\Http\JsonResponse;

class LeiteIndicadorController extends Controller
{
    public function __invoke(LeiteIndicadorService $leite): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $leite->evolucaoMensal(),
        ]);
    }
}
