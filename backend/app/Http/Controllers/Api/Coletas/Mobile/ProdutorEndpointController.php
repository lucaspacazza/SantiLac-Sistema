<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileProdutorEndpointService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProdutorEndpointController extends Controller
{
    public function __invoke(Request $request, MobileProdutorEndpointService $service): JsonResponse
    {
        return response()->json($service->store($request->all()));
    }
}
