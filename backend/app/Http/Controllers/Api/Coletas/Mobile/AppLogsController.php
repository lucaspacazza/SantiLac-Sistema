<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileAppLogsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppLogsController extends Controller
{
    public function __invoke(Request $request, MobileAppLogsService $service): JsonResponse
    {
        return response()->json($service->store($request->all()));
    }
}
