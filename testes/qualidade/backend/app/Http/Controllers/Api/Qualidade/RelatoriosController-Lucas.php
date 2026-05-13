<?php

namespace App\Http\Controllers\Api\Qualidade;

use App\Http\Controllers\Controller;
use App\Services\Qualidade\RelatoriosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RelatoriosController extends Controller
{
    public function __construct(
        private readonly RelatoriosService $relatorios
    ) {
    }

    public function resumo(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->relatorios->resumo($request),
        ]);
    }

    public function pendenciasProdutor(Request $request, string $codigo): JsonResponse
    {
        $data = $this->relatorios->pendenciasProdutor($request, $codigo);

        if ($data === null) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PRODUCER_410',
                    'message' => 'Produtor não encontrado.',
                    'details' => [
                        'codigo' => $codigo,
                    ],
                ],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
