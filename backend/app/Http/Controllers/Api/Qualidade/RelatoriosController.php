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

    public function exportarProdutoresAnalises(Request $request)
    {
        $data = $this->relatorios->exportarProdutoresAnalises($request);
        $success = (bool) data_get($data, 'processor.success', false);

        if (! $success) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                'code' => 'EXPORT_811',
                'message' => 'Falha ao gerar planilha.',
                'details' => data_get($data, 'processor.errors', []),
                ],
            ], 500);
        }

        return response()->download(
            $data['caminho'],
            $data['arquivo'],
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        )->deleteFileAfterSend(true);
    }

    public function exportarProdutoresAnalisesPdf(Request $request)
    {
        $data = $this->relatorios->exportarProdutoresAnalisesPdf($request);
        $success = (bool) data_get($data, 'processor.success', false);

        if (! $success) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                'code' => 'EXPORT_821',
                'message' => 'Falha ao gerar PDF.',
                'details' => data_get($data, 'processor.errors', []),
                ],
            ], 500);
        }

        return response()->download(
            $data['caminho'],
            $data['arquivo'],
            ['Content-Type' => 'application/pdf']
        )->deleteFileAfterSend(true);
    }
}
