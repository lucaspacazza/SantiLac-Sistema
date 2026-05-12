<?php

namespace App\Http\Controllers\Api\Qualidade;

use App\Http\Controllers\Controller;
use App\Services\QualidadeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QualidadeController extends Controller
{
    public function __construct(
        private readonly QualidadeService $qualidade
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->qualidade->overview(),
        ]);
    }

    public function produtores(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->qualidade->produtores($request),
        ]);
    }

    public function produtor(string $codigo): JsonResponse
    {
        $data = $this->qualidade->produtor($codigo);

        if ($data === null) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PRODUCER_410',
                    'message' => 'Produtor nao encontrado.',
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

    public function analisesDoProdutor(Request $request, string $codigo): JsonResponse
    {
        $data = $this->qualidade->analisesDoProdutor($request, $codigo);

        if ($data === null) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PRODUCER_410',
                    'message' => 'Produtor nao encontrado.',
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

    public function relatoriosResumo(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->qualidade->relatoriosResumo(),
        ]);
    }

    public function relatoriosProdutores(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->qualidade->relatoriosProdutores($request),
        ]);
    }
}
