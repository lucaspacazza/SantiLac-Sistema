<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\ExpedicaoIndicadorService;
use Illuminate\Http\JsonResponse;

class ExpedicaoIndicadorController extends Controller
{
    public function __invoke(ExpedicaoIndicadorService $expedicao): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $expedicao->resumo()]);
    }
}
