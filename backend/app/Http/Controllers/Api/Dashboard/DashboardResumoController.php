<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardSnapshotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardResumoController extends Controller
{
    public function __construct(
        private readonly DashboardSnapshotService $dashboardResumo
    ) {
    }

    public function homeResumo(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardResumo->montar($request->query('data'))['homeResumo'],
        ]);
    }

    public function resumoDiario(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardResumo->montar($request->query('data'))['resumoDiario'],
        ]);
    }

    public function snapshot(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardResumo->montar($request->query('data')),
        ]);
    }
}
