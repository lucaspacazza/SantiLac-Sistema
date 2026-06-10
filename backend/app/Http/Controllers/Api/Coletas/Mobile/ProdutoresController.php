<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileProdutoresService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProdutoresController extends Controller
{
    public function __invoke(Request $request, MobileProdutoresService $service): JsonResponse
    {
        return response()->json($service->listar($request->query('rota')));
    }
}
