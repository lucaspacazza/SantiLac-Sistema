<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileColetasService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RotasColetasBatchController extends Controller
{
    public function __invoke(Request $request, MobileColetasService $service): JsonResponse
    {
        return response()->json($service->storeBatch($request->all()));
    }
}
