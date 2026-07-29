<?php

namespace App\Http\Controllers\Api\Pasteurizador;

use App\Http\Controllers\Controller;
use App\Services\Pasteurizador\PasteurizadorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PasteurizadorController extends Controller
{
    public function __construct(
        private readonly PasteurizadorService $pasteurizador
    ) {}

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
        set_time_limit(max(
            (int) config('services.pasteurizador.timeout_seconds', 10800),
            1
        ));

        $validator = Validator::make($request->all(), [
            'ingestion_key' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/i'],
            'source' => ['nullable', 'string', 'max:80'],
            'equipment' => ['nullable', 'string', 'max:80'],
            'remote_file' => ['nullable', 'string', 'max:80'],
            'raw_file_path' => ['nullable', 'string', 'max:255'],
            'downloaded_at' => ['required', 'date'],
            'bytes_downloaded' => ['required', 'integer', 'min:0'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'raw_sha256' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/i'],
            'status' => ['nullable', 'string', 'in:rascunho,processada,erro'],
            'mensagem_erro' => ['nullable', 'string'],
            'samples' => ['present', 'array'],
            'samples.*' => ['array'],
            'samples.*.channel' => ['required', 'string', 'max:80'],
            'samples.*.unit' => ['nullable', 'string', 'max:20'],
            'samples.*.sample_index' => ['required', 'integer', 'min:0'],
            'samples.*.raw_offset' => ['nullable', 'integer', 'min:0'],
            'samples.*.timestamp_record' => ['required', 'date'],
            'samples.*.value' => ['required', 'numeric'],
            'samples.*.quality' => ['nullable', 'numeric'],
        ]);
        $validator->after(function ($validator) use ($request): void {
            if (
                ! $request->filled('period_end')
                || $validator->errors()->has('period_end')
            ) {
                return;
            }

            $timezone = 'America/Sao_Paulo';
            $periodEnd = Carbon::parse(
                (string) $request->input('period_end'),
                $timezone
            )->setTimezone($timezone);

            if ($periodEnd->gte(Carbon::now($timezone)->startOfDay())) {
                $validator->errors()->add(
                    'period_end',
                    'O período precisa terminar antes do dia corrente no fuso do equipamento.'
                );
            }

            if (
                $request->filled('downloaded_at')
                && ! $validator->errors()->has('downloaded_at')
            ) {
                $downloadedAt = Carbon::parse(
                    (string) $request->input('downloaded_at'),
                    $timezone
                )->setTimezone($timezone);
                if ($downloadedAt->lte($periodEnd)) {
                    $validator->errors()->add(
                        'downloaded_at',
                        'O download precisa ocorrer depois do fim do período.'
                    );
                }
            }
        });
        $payload = $validator->validate();

        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->criarColeta($payload),
        ], 201);
    }

    public function coletarAgora(Request $request): JsonResponse
    {
        if (! $request->filled('inicio') || ! $request->filled('fim')) {
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

    public function syncState(Request $request): JsonResponse
    {
        $request->validate([
            'inicio' => ['nullable', 'date_format:Y-m-d'],
            'fim' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:inicio'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->pasteurizador->syncState($request),
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
