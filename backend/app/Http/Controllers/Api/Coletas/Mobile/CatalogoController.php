<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileCatalogoService;
use Illuminate\Http\JsonResponse;

class CatalogoController extends Controller
{
    public function __invoke(MobileCatalogoService $service): JsonResponse
    {
        return response()->json($service->catalogo());
    }
}
