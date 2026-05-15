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

    public function exportarProdutorAnalises(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarProdutorAnalises($request, $codigo);

        return $this->downloadExcel($data, 'EXPORT_831', 'Falha ao gerar planilha individual do produtor.');
    }

    public function exportarProdutorAnalisesPdf(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarProdutorAnalisesPdf($request, $codigo);

        return $this->downloadPdf($data, 'EXPORT_841', 'Falha ao gerar PDF individual do produtor.');
    }

    public function exportarProdutorPendencias(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarProdutorPendencias($request, $codigo);

        return $this->downloadExcel($data, 'EXPORT_851', 'Falha ao gerar planilha de inconsistências do produtor.');
    }

    public function exportarProdutorPendenciasPdf(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarProdutorPendenciasPdf($request, $codigo);

        return $this->downloadPdf($data, 'EXPORT_861', 'Falha ao gerar PDF de inconsistências do produtor.');
    }

    public function exportarForaPadrao(Request $request)
    {
        $data = $this->relatorios->exportarForaPadrao($request);

        return $this->downloadExcel($data, 'EXPORT_911', 'Falha ao gerar planilha de fora do padrão.');
    }

    public function exportarForaPadraoPdf(Request $request)
    {
        $data = $this->relatorios->exportarForaPadraoPdf($request);

        return $this->downloadPdf($data, 'EXPORT_931', 'Falha ao gerar PDF de fora do padrão.');
    }

    public function exportarIndicadorForaPadrao(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarIndicadorForaPadrao($request, $codigo);

        return $this->downloadExcel($data, 'EXPORT_921', 'Falha ao gerar planilha do indicador.');
    }

    public function exportarIndicadorForaPadraoPdf(Request $request, string $codigo)
    {
        $data = $this->relatorios->exportarIndicadorForaPadraoPdf($request, $codigo);

        return $this->downloadPdf($data, 'EXPORT_941', 'Falha ao gerar PDF do indicador.');
    }

    private function downloadExcel(array $data, string $code, string $message)
    {
        $success = (bool) data_get($data, 'processor.success', false);

        if (! $success) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => $code,
                    'message' => $message,
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

    private function downloadPdf(array $data, string $code, string $message)
    {
        $success = (bool) data_get($data, 'processor.success', false);

        if (! $success) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => $code,
                    'message' => $message,
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
