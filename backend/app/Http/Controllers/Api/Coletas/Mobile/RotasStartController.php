<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileRotasService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RotasStartController extends Controller
{
    public function __invoke(Request $request, MobileRotasService $service): JsonResponse
    {
        return response()->json($service->start($request->all()));
    }
}
