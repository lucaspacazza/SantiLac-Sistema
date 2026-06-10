<?php

namespace App\Http\Controllers\Api\Pasteurizador;

use App\Http\Controllers\Controller;
use App\Services\Pasteurizador\PasteurizadorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PasteurizadorController extends Controller
{
    public function __construct(
        private readonly PasteurizadorService $pasteurizador
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->overview(),
        ]);
    }

    public function coletas(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->coletas($request),
        ]);
    }

    public function criarColeta(Request $request): JsonResponse
    {
        set_time_limit(240);

        $payload = $request->validate([
            'source' => ['nullable', 'string', 'max:80'],
            'equipment' => ['nullable', 'string', 'max:80'],
            'remote_file' => ['nullable', 'string', 'max:80'],
            'raw_file_path' => ['nullable', 'string', 'max:255'],
            'downloaded_at' => ['required', 'date'],
            'bytes_downloaded' => ['required', 'integer', 'min:0'],
            'status' => ['nullable', 'string', 'max:40'],
            'mensagem_erro' => ['nullable', 'string'],
            'samples' => ['present', 'array'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->criarColeta($payload),
        ], 201);
    }

    public function coletarAgora(Request $request): JsonResponse
    {
        if (!$request->filled('inicio') || !$request->filled('fim')) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PAST_PERIOD_REQUIRED',
                    'message' => 'Informe dia inicial e dia final antes de coletar direto do equipamento.',
                ],
            ], 422);
        }

        $result = $this->pasteurizador->coletarAgora($request);

        if (($result['ok'] ?? false) !== true) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PAST_PROCESSOR_ERROR',
                    'message' => 'Não foi possível acionar o processador do pasteurizador.',
                    'details' => $result,
                ],
            ], 502);
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function coleta(int $id): JsonResponse
    {
        $coleta = $this->pasteurizador->coleta($id);

        if ($coleta === null) {
            return response()->json($this->erro('PAST_404', 'Coleta não encontrada.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $coleta,
        ]);
    }

    public function amostras(int $id, Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->amostras($id, $request),
        ]);
    }

    public function amostrasPeriodo(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->amostrasPeriodo($request),
        ]);
    }

    public function exportarCsv(int $id, Request $request): StreamedResponse
    {
        return $this->pasteurizador->exportarCsv($id, (string) $request->query('canal', 'Temp.Pasteuriza'));
    }

    public function exportarCsvPeriodo(Request $request): StreamedResponse
    {
        return $this->pasteurizador->exportarCsvPeriodo($request);
    }

    public function exportarPdfPeriodo(Request $request)
    {
        $data = $this->pasteurizador->exportarPdfPeriodo($request);
        $success = (bool) data_get($data, 'processor.success', false);

        if (! $success) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'PAST_PDF_500',
                    'message' => 'Falha ao gerar PDF do gráfico.',
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

    private function erro(string $code, string $message, array $details = []): array
    {
        return [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
        ];
    }
}
