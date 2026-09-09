<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\DashboardDateRangeRequest;
use App\Services\Dashboard\PasteurizadorIndicadorService;
use Illuminate\Http\JsonResponse;

class PasteurizadorIndicadorController extends Controller
{
    public function __invoke(DashboardDateRangeRequest $request, PasteurizadorIndicadorService $pasteurizador): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $pasteurizador->resumo($request->range())]);
    }
}
