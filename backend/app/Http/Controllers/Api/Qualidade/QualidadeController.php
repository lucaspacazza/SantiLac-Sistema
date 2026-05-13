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

    public function analises(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->qualidade->analises($request),
        ]);
    }

    public function importarAnalises(Request $request): JsonResponse
    {
        if (! $request->hasFile('arquivo')) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'IMPORT_310',
                    'message' => 'Arquivo nao enviado.',
                    'details' => [
                        'field' => 'arquivo',
                    ],
                ],
            ], 422);
        }

        $resultado = $this->qualidade->importarAnalises($request->file('arquivo'));
        $summary = $resultado['summary'];
        $processado = (
            $summary['registros_criados']
            + $summary['registros_completados']
            + $summary['registros_sem_mudanca']
            + $summary['produtores_nao_encontrados']
        ) > 0;

        return response()->json([
            'success' => $processado,
            'data' => $resultado,
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

    public function analisesDoProdutor(Request $request, string $codigo): JsonResponse
    {
        $data = $this->qualidade->analisesDoProdutor($request, $codigo);

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
