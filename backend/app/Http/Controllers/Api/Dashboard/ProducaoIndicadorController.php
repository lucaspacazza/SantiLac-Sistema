<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\DashboardDateRangeRequest;
use App\Services\Dashboard\ProducaoIndicadorService;
use Illuminate\Http\JsonResponse;

class ProducaoIndicadorController extends Controller
{
    public function __invoke(DashboardDateRangeRequest $request, ProducaoIndicadorService $producao): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $producao->resumo($request->range())]);
    }
}
