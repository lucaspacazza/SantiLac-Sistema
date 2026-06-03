<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\ProducaoService;
use Illuminate\Http\JsonResponse;

class ProducaoController extends BaseProducaoController
{
    public function __construct(
        private readonly ProducaoService $producao
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
