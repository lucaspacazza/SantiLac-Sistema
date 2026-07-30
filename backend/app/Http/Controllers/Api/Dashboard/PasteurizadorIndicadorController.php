<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\PasteurizadorIndicadorService;
use Illuminate\Http\JsonResponse;

class PasteurizadorIndicadorController extends Controller
{
    public function __invoke(PasteurizadorIndicadorService $pasteurizador): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $pasteurizador->resumo()]);
    }
}
