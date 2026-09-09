<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\DashboardDateRangeRequest;
use App\Services\Dashboard\ExpedicaoIndicadorService;
use Illuminate\Http\JsonResponse;

class ExpedicaoIndicadorController extends Controller
{
    public function __invoke(DashboardDateRangeRequest $request, ExpedicaoIndicadorService $expedicao): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $expedicao->resumo($request->range())]);
    }
}
