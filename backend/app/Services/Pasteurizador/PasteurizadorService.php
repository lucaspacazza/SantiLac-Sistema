<?php

namespace App\Services\Pasteurizador;

use App\Models\Pasteurizador\PasteurizadorAmostra;
use App\Models\Pasteurizador\PasteurizadorColeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PasteurizadorService
{
    public function overview(): array
    {
        $ultima = PasteurizadorColeta::query()->orderByDesc('coletado_em')->first();

        return [
            'totais' => [
                'coletas' => PasteurizadorColeta::query()->count(),
                'amostras' => PasteurizadorAmostra::query()->count(),
                'canais' => PasteurizadorAmostra::query()->distinct('canal')->count('canal'),
            ],
            'ultima_coleta' => $ultima ? $this->formatarColeta($ultima) : null,
            'canais' => PasteurizadorAmostra::query()
                ->select('canal', 'unidade')
                ->distinct()
                ->orderBy('canal')
                ->get()
                ->map(fn (PasteurizadorAmostra $item): array => [
                    'canal' => (string) $item->canal,
                    'unidade' => $item->unidade,
                ])
                ->values()
                ->all(),
        ];
    }

    public function coletas(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $query = PasteurizadorColeta::query()->orderByDesc('coletado_em')->orderByDesc('id');

        if ($request->filled('inicio')) {
            $horaInicio = $this->normalizarHora((string) $request->query('hora_inicio', '00:00'));
            $query->where('coletado_em', '>=', (string) $request->query('inicio') . ' ' . $horaInicio . ':00');
        }

        if ($request->filled('fim')) {
            $horaFim = $this->normalizarHora((string) $request->query('hora_fim', '23:59'));
            $query->where('coletado_em', '<=', (string) $request->query('fim') . ' ' . $horaFim . ':59');
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (PasteurizadorColeta $coleta): array => $this->formatarColeta($coleta))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function coleta(int $id): ?array
    {
        $coleta = PasteurizadorColeta::query()->where('id', $id)->first();

        return $coleta ? $this->formatarColeta($coleta) : null;
    }

    public function criarColeta(array $payload): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload): int {
            $samples = $payload['samples'] ?? [];
            $coleta = PasteurizadorColeta::query()->create([
                'equipamento' => $payload['equipment'] ?? 'pasteurizador',
                'origem' => $payload['source'] ?? 'fieldlogger_modbus',
                'arquivo_remoto' => $payload['remote_file'] ?? '2:/24085425/MemFlash.fl',
                'arquivo_bruto_path' => $payload['raw_file_path'] ?? null,
                'coletado_em' => $payload['downloaded_at'] ?? now('America/Sao_Paulo')->toDateTimeString(),
                'bytes_baixados' => (int) ($payload['bytes_downloaded'] ?? 0),
                'total_amostras' => count($samples),
                'status' => $payload['status'] ?? 'processada',
                'mensagem_erro' => $payload['mensagem_erro'] ?? null,
            ]);

            $rows = [];
            foreach ($samples as $sample) {
                $rows[] = [
                    'coleta_id' => $coleta->id,
                    'equipamento' => $payload['equipment'] ?? 'pasteurizador',
                    'canal' => $sample['channel'] ?? 'Temp.Pasteuriza',
                    'unidade' => $sample['unit'] ?? 'C',
                    'sample_index' => (int) ($sample['sample_index'] ?? 0),
                    'raw_offset' => isset($sample['raw_offset']) ? (int) $sample['raw_offset'] : null,
                    'timestamp_registro' => $sample['timestamp_record'] ?? null,
                    'valor' => (float) ($sample['value'] ?? 0),
                    'qualidade' => isset($sample['quality']) ? (float) $sample['quality'] : null,
                    'created_at' => now(),
                ];
            }

            foreach (array_chunk($rows, 1000) as $chunk) {
                PasteurizadorAmostra::query()->insert($chunk);
            }

            return (int) $coleta->id;
        });

        return $this->coleta($id);
    }

    public function coletarAgora(?Request $request = null): array
    {
        $url = rtrim((string) env('PASTEURIZADOR_PROCESSOR_URL', 'http://192.168.0.209:8095'), '/') . '/collect';
        $payload = [
            'timezone' => 'America/Sao_Paulo',
        ];

        if ($request !== null) {
            foreach (['inicio', 'fim', 'hora_inicio', 'hora_fim'] as $field) {
                if ($request->filled($field)) {
                    $payload[$field] = (string) $request->input($field);
                }
            }
        }

        $response = Http::timeout(240)->acceptJson()->post($url, $payload);

        if (!$response->successful()) {
            return [
                'ok' => false,
                'processor_url' => $url,
                'status' => $response->status(),
                'message' => $response->body(),
            ];
        }

        return [
            'ok' => true,
            'processor_url' => $url,
            'response' => $response->json(),
        ];
    }

    public function amostras(int $coletaId, Request $request): array
    {
        $canal = (string) $request->query('canal', 'Todos');
        $limit = min(max((int) $request->query('limit', 5000), 1), 50000);

        $query = PasteurizadorAmostra::query()
            ->select(['coleta_id', 'sample_index', 'raw_offset', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade'])
            ->where('coleta_id', $coletaId);

        if ($canal !== '' && $canal !== 'Todos') {
            $query->where('canal', $canal);
        }

        return $query
            ->orderBy('sample_index')
            ->orderBy('canal')
            ->limit($limit)
            ->get()
            ->map(fn (PasteurizadorAmostra $amostra): array => $this->formatarAmostra($amostra))
            ->values()
            ->all();
    }

    public function amostrasPeriodo(Request $request): array
    {
        $limit = min(max((int) $request->query('limit', 20000), 1), 50000);

        return $this->deduplicarAmostrasPeriodo(
            $this->queryAmostrasPeriodo($request)
            ->limit($limit)
            ->get()
        )
            ->map(fn (PasteurizadorAmostra $amostra): array => $this->formatarAmostra($amostra))
            ->values()
            ->all();
    }

    public function exportarCsv(int $coletaId, string $canal = 'Temp.Pasteuriza'): StreamedResponse
    {
        $fileName = 'pasteurizador_coleta_' . $coletaId . '.csv';
        $coleta = PasteurizadorColeta::query()->where('id', $coletaId)->first();
        $coletadoEm = $coleta ? optional($coleta->coletado_em)->toDateTimeString() : null;

        return response()->streamDownload(function () use ($coletaId, $canal, $coletadoEm): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['coleta_id', 'coletado_em', 'sample_index', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade', 'raw_offset']);

            $query = PasteurizadorAmostra::query()
                ->select(['coleta_id', 'sample_index', 'raw_offset', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade'])
                ->where('coleta_id', $coletaId);

            if ($canal !== '' && $canal !== 'Todos') {
                $query->where('canal', $canal);
            }

            $query
                ->orderBy('sample_index')
                ->orderBy('canal')
                ->chunk(1000, function ($amostras) use ($handle, $coletaId, $coletadoEm): void {
                    foreach ($amostras as $amostra) {
                        fputcsv($handle, [
                            $coletaId,
                            $coletadoEm,
                            $amostra->sample_index,
                            optional($amostra->timestamp_registro)->toDateTimeString(),
                            $amostra->canal,
                            $amostra->valor,
                            $amostra->unidade,
                            $amostra->qualidade,
                            $amostra->raw_offset,
                        ]);
                    }
                });

            fclose($handle);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportarCsvPeriodo(Request $request): StreamedResponse
    {
        $canal = (string) $request->query('canal', 'Todos');
        $fileName = 'pasteurizador_grafico_' . now('America/Sao_Paulo')->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['coleta_id', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade']);

            $this->deduplicarAmostrasPeriodo($this->queryAmostrasPeriodo($request)->limit(50000)->get())
                ->each(function (PasteurizadorAmostra $amostra) use ($handle): void {
                    fputcsv($handle, [
                        $amostra->coleta_id,
                        optional($amostra->timestamp_registro)->toDateTimeString(),
                        $amostra->canal,
                        $amostra->valor,
                        $amostra->unidade,
                        $amostra->qualidade,
                    ]);
                });

            fclose($handle);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'X-Pasteurizador-Canal' => $canal,
        ]);
    }

    public function exportarPdfPeriodo(Request $request): array
    {
        $fileName = 'pasteurizador_grafico_' . now('America/Sao_Paulo')->format('Ymd_His') . '.pdf';
        $outputPath = $this->temporaryOutputPath($fileName, 'pdf');
        $payload = $this->payloadGraficoPeriodo($request);

        $result = $this->executarExportadorGraficoPdf($payload, $outputPath);

        return [
            'arquivo' => $fileName,
            'caminho' => $outputPath,
            'processor' => $result,
        ];
    }

    private function queryAmostrasPeriodo(Request $request)
    {
        $query = PasteurizadorAmostra::query()
            ->select(['id', 'coleta_id', 'sample_index', 'raw_offset', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade'])
            ->whereNotNull('timestamp_registro')
            ->orderBy('timestamp_registro')
            ->orderBy('canal')
            ->orderByDesc('id');

        $canal = (string) $request->query('canal', 'Todos');
        if ($canal !== '' && $canal !== 'Todos') {
            $query->where('canal', $canal);
        }

        if (!$request->filled('inicio') && !$request->filled('fim')) {
            $ultimaColetaId = PasteurizadorColeta::query()
                ->orderByDesc('coletado_em')
                ->orderByDesc('id')
                ->value('id');

            if ($ultimaColetaId !== null) {
                $query->where('coleta_id', $ultimaColetaId);
            }
        }

        if ($request->filled('inicio')) {
            $horaInicio = $this->normalizarHoraComSegundos((string) $request->query('hora_inicio', '00:00:00'), '00:00:00');
            $query->where('timestamp_registro', '>=', (string) $request->query('inicio') . ' ' . $horaInicio);
        }

        if ($request->filled('fim')) {
            $horaFim = $this->normalizarHoraComSegundos((string) $request->query('hora_fim', '23:59:59'), '23:59:59');
            $query->where('timestamp_registro', '<=', (string) $request->query('fim') . ' ' . $horaFim);
        }

        return $query;
    }

    private function payloadGraficoPeriodo(Request $request): array
    {
        $inicio = (string) $request->query('inicio', '');
        $fim = (string) $request->query('fim', '');
        $horaInicio = $this->normalizarHoraComSegundos((string) $request->query('hora_inicio', '00:00:00'), '00:00:00');
        $horaFim = $this->normalizarHoraComSegundos((string) $request->query('hora_fim', '23:59:59'), '23:59:59');
        $canal = (string) $request->query('canal', 'Todos');

        $amostras = $this->deduplicarAmostrasPeriodo($this->queryAmostrasPeriodo($request)->limit(50000)->get())
            ->map(fn (PasteurizadorAmostra $amostra): array => [
                'coleta_id' => (int) $amostra->coleta_id,
                'sample_index' => (int) $amostra->sample_index,
                'timestamp_registro' => optional($amostra->timestamp_registro)->toDateTimeString(),
                'canal' => (string) $amostra->canal,
                'valor' => (float) $amostra->valor,
                'unidade' => $amostra->unidade,
                'qualidade' => $amostra->qualidade !== null ? (float) $amostra->qualidade : null,
                'raw_offset' => $amostra->raw_offset !== null ? (int) $amostra->raw_offset : null,
            ])
            ->values()
            ->all();

        return [
            'titulo' => 'Histórico do pasteurizador',
            'gerado_em' => now('America/Sao_Paulo')->format('d/m/Y H:i:s'),
            'periodo' => [
                'inicio' => $inicio,
                'fim' => $fim,
                'hora_inicio' => $horaInicio,
                'hora_fim' => $horaFim,
                'label' => $this->periodoLabel($inicio, $fim, $horaInicio, $horaFim),
            ],
            'filtros' => [
                'canal' => $canal,
            ],
            'samples' => $amostras,
        ];
    }

    private function periodoLabel(string $inicio, string $fim, string $horaInicio, string $horaFim): string
    {
        if ($inicio === '' && $fim === '') {
            return 'Última coleta salva';
        }

        $inicioLabel = $inicio !== '' ? date('d/m/Y', strtotime($inicio)) . ' ' . $horaInicio : 'início';
        $fimLabel = $fim !== '' ? date('d/m/Y', strtotime($fim)) . ' ' . $horaFim : 'fim';

        return $inicioLabel . ' a ' . $fimLabel;
    }

    private function executarExportadorGraficoPdf(array $payload, string $outputPath): array
    {
        $processorUrl = rtrim((string) env('PASTEURIZADOR_PROCESSOR_URL', 'http://192.168.0.209:8095'), '/');
        if ($processorUrl !== '') {
            $response = Http::timeout(120)
                ->accept('application/pdf')
                ->asJson()
                ->post($processorUrl . '/export-chart/pdf', $payload);

            if ($response->successful() && str_contains((string) $response->header('Content-Type'), 'application/pdf')) {
                file_put_contents($outputPath, $response->body());

                return ['success' => true, 'via' => 'http'];
            }

            return [
                'success' => false,
                'errors' => [[
                    'code' => 'PAST_PDF_HTTP',
                    'message' => 'Falha ao gerar PDF no processador do pasteurizador.',
                    'details' => [
                        'status' => $response->status(),
                        'body' => mb_substr($response->body(), 0, 2000),
                    ],
                ]],
            ];
        }

        $inputPath = $this->temporaryPayload($payload, 'santilac_pasteurizador_pdf_');
        $script = env('PASTEURIZADOR_EXPORT_CHART_PDF_SCRIPT', base_path('../processor/modules/pasteurizador/export_chart_pdf.py'));
        $python = env('PASTEURIZADOR_EXPORT_PYTHON', 'python3');
        $pythonCommand = preg_split('/\s+/', trim($python)) ?: ['python'];

        $process = new Process([
            ...$pythonCommand,
            $script,
            '--input',
            $inputPath,
            '--output',
            $outputPath,
        ]);
        $process->setTimeout(120);
        $process->run();
        @unlink($inputPath);

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'success' => false,
                'errors' => [[
                    'code' => 'PAST_PDF_LOCAL',
                    'message' => 'Falha ao gerar PDF do gráfico.',
                    'details' => [
                        'stdout' => $process->getOutput(),
                        'stderr' => $process->getErrorOutput(),
                    ],
                ]],
            ];
        }

        return $decoded;
    }

    private function temporaryOutputPath(string $fileName, string $extension): string
    {
        return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR
            . pathinfo($fileName, PATHINFO_FILENAME)
            . '_'
            . bin2hex(random_bytes(4))
            . '.'
            . $extension;
    }

    private function temporaryPayload(array $payload, string $prefix): string
    {
        $inputPath = tempnam(sys_get_temp_dir(), $prefix);
        file_put_contents($inputPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $inputPath;
    }

    private function deduplicarAmostrasPeriodo($amostras)
    {
        return $amostras
            ->unique(fn (PasteurizadorAmostra $amostra): string => (string) $amostra->canal . '|' . optional($amostra->timestamp_registro)->toDateTimeString())
            ->sort(function (PasteurizadorAmostra $a, PasteurizadorAmostra $b): int {
                $time = strcmp((string) optional($a->timestamp_registro)->toDateTimeString(), (string) optional($b->timestamp_registro)->toDateTimeString());

                return $time !== 0 ? $time : strcmp((string) $a->canal, (string) $b->canal);
            })
            ->values();
    }

    private function formatarColeta(PasteurizadorColeta $coleta): array
    {
        return [
            'id' => (int) $coleta->id,
            'equipamento' => (string) $coleta->equipamento,
            'origem' => (string) $coleta->origem,
            'arquivo_remoto' => (string) $coleta->arquivo_remoto,
            'coletado_em' => optional($coleta->coletado_em)->toDateTimeString(),
            'bytes_baixados' => (int) $coleta->bytes_baixados,
            'total_amostras' => (int) $coleta->total_amostras,
            'status' => (string) $coleta->status,
            'mensagem_erro' => $coleta->mensagem_erro,
        ];
    }

    private function formatarAmostra(PasteurizadorAmostra $amostra): array
    {
        return [
            'sample_index' => (int) $amostra->sample_index,
            'timestamp_registro' => optional($amostra->timestamp_registro)->toDateTimeString(),
            'canal' => (string) $amostra->canal,
            'valor' => (float) $amostra->valor,
            'unidade' => $amostra->unidade,
            'qualidade' => $amostra->qualidade !== null ? (float) $amostra->qualidade : null,
            'raw_offset' => $amostra->raw_offset !== null ? (int) $amostra->raw_offset : null,
        ];
    }

    private function normalizarHora(string $hora): string
    {
        if (preg_match('/^\d{2}:\d{2}$/', $hora)) {
            return $hora;
        }

        return '00:00';
    }

    private function normalizarHoraComSegundos(string $hora, string $fallback): string
    {
        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $hora)) {
            return $hora;
        }

        if (preg_match('/^\d{2}:\d{2}$/', $hora)) {
            return $hora . ':00';
        }

        return $fallback;
    }
}
