<?php

namespace App\Http\Controllers\Api\Qualidade;

use App\Http\Controllers\Controller;
use App\Http\Requests\Qualidade\RelatoriosV2ResumoRequest;
use App\Services\Qualidade\RelatoriosV2Service;
use Illuminate\Http\JsonResponse;

class RelatoriosV2Controller extends Controller
{
    public function __construct(private readonly RelatoriosV2Service $relatorios)
    {
    }

    public function resumo(RelatoriosV2ResumoRequest $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->relatorios->resumo($request->validated()),
        ]);
    }
}
