<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\ProducaoOverviewService;
use Illuminate\Http\JsonResponse;

class ProducaoController extends BaseProducaoController
{
    public function __construct(
        private readonly ProducaoOverviewService $producao
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->overview(),
        ]);
    }
}