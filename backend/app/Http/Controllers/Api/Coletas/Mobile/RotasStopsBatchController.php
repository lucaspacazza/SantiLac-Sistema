<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileStopsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RotasStopsBatchController extends Controller
{
    public function __invoke(Request $request, MobileStopsService $service): JsonResponse
    {
        return response()->json($service->storeBatch($request->all()));
    }
}
