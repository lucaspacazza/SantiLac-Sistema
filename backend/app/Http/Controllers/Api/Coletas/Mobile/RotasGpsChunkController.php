<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileGpsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RotasGpsChunkController extends Controller
{
    public function __invoke(Request $request, MobileGpsService $service): JsonResponse
    {
        return response()->json($service->storeChunk($request->all()));
    }
}
