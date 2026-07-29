<?php

namespace App\Services\Pasteurizador;

use App\Models\Pasteurizador\PasteurizadorAmostra;
use App\Models\Pasteurizador\PasteurizadorColeta;
use Generator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Process\Process;

class PasteurizadorService
{
    private const GRAPH_DEFAULT_MAX_POINTS = 12000;

    private const GRAPH_MAX_POINTS = 50000;

    private const PDF_MAX_POINTS = 1200;

    private const QUERY_CHUNK_SIZE = 2000;

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
            $horaInicio = $this->normalizarHora(
                (string) $request->query('hora_inicio', '00:00:00'),
                '00:00:00'
            );
            $query->where('coletado_em', '>=', (string) $request->query('inicio').' '.$horaInicio);
        }

        if ($request->filled('fim')) {
            $horaFim = $this->normalizarHora(
                (string) $request->query('hora_fim', '23:59:59'),
                '23:59:59'
            );
            $query->where('coletado_em', '<=', (string) $request->query('fim').' '.$horaFim);
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

    public function syncState(?Request $request = null): array
    {
        $primeiraAmostra = PasteurizadorAmostra::query()
            ->whereNotNull('timestamp_registro')
            ->orderBy('timestamp_registro')
            ->first();
        $ultimaAmostra = PasteurizadorAmostra::query()
            ->whereNotNull('timestamp_registro')
            ->orderByDesc('timestamp_registro')
            ->first();

        $ultimaColetaComAmostras = PasteurizadorColeta::query()
            ->where('total_amostras', '>', 0)
            ->orderByDesc('coletado_em')
            ->orderByDesc('id')
            ->first();

        $ultimoPeriodoProcessado = PasteurizadorColeta::query()
            ->where('status', 'processada')
            ->whereNotNull('period_start')
            ->whereNotNull('period_end')
            ->whereColumn('period_start', '<=', 'period_end')
            ->orderByDesc('period_end')
            ->value('period_end');
        $ultimaDataConhecida = collect([
            optional($ultimaAmostra?->timestamp_registro)->format('Y-m-d'),
            $ultimoPeriodoProcessado !== null
                ? Carbon::parse((string) $ultimoPeriodoProcessado)->format('Y-m-d')
                : null,
        ])->filter()->max();
        $coverageStart = $request?->filled('inicio')
            ? (string) $request->query('inicio')
            : ($ultimaDataConhecida !== null
                ? Carbon::parse($ultimaDataConhecida)->subDays(119)->format('Y-m-d')
                : null);
        $coverageEnd = $request?->filled('fim')
            ? (string) $request->query('fim')
            : null;

        $coverageQuery = PasteurizadorAmostra::query()
            ->whereNotNull('timestamp_registro');

        if ($coverageStart !== null) {
            $coverageQuery->where(
                'timestamp_registro',
                '>=',
                $coverageStart.' 00:00:00'
            );
        }

        if ($coverageEnd !== null) {
            $coverageQuery->where(
                'timestamp_registro',
                '<=',
                $coverageEnd.' 23:59:59'
            );
        }

        $observedBounds = (clone $coverageQuery)
            ->selectRaw(
                'MIN(timestamp_registro) as first_timestamp, '
                .'MAX(timestamp_registro) as last_timestamp'
            )
            ->first();

        // A timestamp only proves that a sample was observed on that date. It
        // does not prove that the complete day was downloaded and processed.
        // Keep this legacy evidence visible, but never promote it to coverage.
        $observedDates = $coverageQuery
            ->selectRaw('DATE(timestamp_registro) as data')
            ->distinct()
            ->orderBy('data')
            ->pluck('data')
            ->map(fn (mixed $data): string => (string) $data)
            ->values();
        $coveredDates = collect();

        $coveredPeriods = PasteurizadorColeta::query()
            ->where('status', 'processada')
            ->whereNotNull('period_start')
            ->whereNotNull('period_end')
            ->whereColumn('period_start', '<=', 'period_end')
            ->where(
                'period_end',
                '<',
                Carbon::now('America/Sao_Paulo')->startOfDay()->toDateTimeString()
            );

        if ($coverageStart !== null) {
            $coveredPeriods->where('period_end', '>=', $coverageStart.' 00:00:00');
        }
        if ($coverageEnd !== null) {
            $coveredPeriods->where('period_start', '<=', $coverageEnd.' 23:59:59');
        }

        foreach ($coveredPeriods->get(['period_start', 'period_end']) as $coveredPeriod) {
            $periodStart = $coveredPeriod->period_start;
            $periodEnd = $coveredPeriod->period_end;
            if ($periodStart === null || $periodEnd === null) {
                continue;
            }

            $cursor = $periodStart->copy()->startOfDay();
            $lastDay = $periodEnd->copy()->startOfDay();
            if ($coverageStart !== null && $cursor->lt(Carbon::parse($coverageStart))) {
                $cursor = Carbon::parse($coverageStart)->startOfDay();
            }
            if ($coverageEnd !== null && $lastDay->gt(Carbon::parse($coverageEnd))) {
                $lastDay = Carbon::parse($coverageEnd)->startOfDay();
            }

            while ($cursor->lte($lastDay)) {
                $day = $cursor->format('Y-m-d');
                $dayStart = $cursor->copy()->startOfDay();
                $dayEnd = $cursor->copy()->setTime(23, 59, 59);
                $insideRequestedRange = ($coverageStart === null || $day >= $coverageStart)
                    && ($coverageEnd === null || $day <= $coverageEnd);
                $coversWholeDay = $periodStart->lte($dayStart)
                    && $periodEnd->gte($dayEnd);

                if ($insideRequestedRange && $coversWholeDay) {
                    $coveredDates->put($day, $day);
                }
                $cursor->addDay();
            }
        }

        $coveredDates = $coveredDates
            ->keys()
            ->sort()
            ->values()
            ->all();
        $observedDates = $observedDates->all();
        $uncertifiedObservedDates = array_values(array_diff(
            $observedDates,
            $coveredDates
        ));

        return [
            'coverage_contract_version' => 2,
            'coverage_basis' => 'processed_period_full_day',
            // Anchor for legacy installations. Consumers may use it to avoid
            // inventing gaps before the logger existed, but not as proof that
            // any individual date is complete.
            'series_start_date' => optional($primeiraAmostra?->timestamp_registro)->format('Y-m-d'),
            'last_sample_timestamp' => optional($ultimaAmostra?->timestamp_registro)->toDateTimeString(),
            'last_sample_date' => optional($ultimaAmostra?->timestamp_registro)->format('Y-m-d'),
            'last_collection_with_samples_at' => optional($ultimaColetaComAmostras?->coletado_em)->toDateTimeString(),
            'last_collection_with_samples_id' => $ultimaColetaComAmostras?->id !== null ? (int) $ultimaColetaComAmostras->id : null,
            'covered_dates' => $coveredDates,
            'coverage_start' => $coveredDates[0] ?? null,
            'coverage_end' => $coveredDates !== [] ? $coveredDates[array_key_last($coveredDates)] : null,
            'observed_dates' => $observedDates,
            'observed_start' => $observedDates[0] ?? null,
            'observed_end' => $observedDates !== [] ? $observedDates[array_key_last($observedDates)] : null,
            'observed_first_timestamp' => $observedBounds?->first_timestamp !== null
                ? Carbon::parse((string) $observedBounds->first_timestamp)->toDateTimeString()
                : null,
            'observed_last_timestamp' => $observedBounds?->last_timestamp !== null
                ? Carbon::parse((string) $observedBounds->last_timestamp)->toDateTimeString()
                : null,
            'uncertified_observed_dates' => $uncertifiedObservedDates,
        ];
    }

    public function criarColeta(array $payload): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload): int {
            $samples = $payload['samples'] ?? [];
            $attributes = [
                'equipamento' => $payload['equipment'] ?? 'pasteurizador',
                'origem' => $payload['source'] ?? 'fieldlogger_modbus',
                'arquivo_remoto' => $payload['remote_file'] ?? '2:/24085425/MemFlash.fl',
                'arquivo_bruto_path' => $payload['raw_file_path'] ?? null,
                'coletado_em' => $payload['downloaded_at'] ?? now('America/Sao_Paulo')->toDateTimeString(),
                'bytes_baixados' => (int) ($payload['bytes_downloaded'] ?? 0),
                'total_amostras' => count($samples),
                'status' => $payload['status'] ?? 'processada',
                'mensagem_erro' => $payload['mensagem_erro'] ?? null,
                'period_start' => $payload['period_start'] ?? null,
                'period_end' => $payload['period_end'] ?? null,
                'raw_sha256' => $payload['raw_sha256'] ?? null,
            ];

            $ingestionKey = trim((string) ($payload['ingestion_key'] ?? ''));
            $replaceExistingSamples = false;
            if ($ingestionKey !== '') {
                $coleta = PasteurizadorColeta::query()->firstOrCreate(
                    ['ingestion_key' => $ingestionKey],
                    $attributes
                );
                $wasCreated = $coleta->wasRecentlyCreated;
                $coleta = PasteurizadorColeta::query()
                    ->whereKey($coleta->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! $wasCreated) {
                    if (count($samples) <= (int) $coleta->total_amostras) {
                        return (int) $coleta->id;
                    }

                    $coleta->fill($attributes);
                    $coleta->save();
                    $replaceExistingSamples = true;
                }
            } else {
                $coleta = PasteurizadorColeta::query()->create($attributes);
            }

            if ($replaceExistingSamples) {
                PasteurizadorAmostra::query()
                    ->where('coleta_id', $coleta->id)
                    ->delete();
            }

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
        $url = rtrim((string) config('services.pasteurizador.processor_url', 'http://192.168.5.203:8095'), '/').'/collect';
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

        $timeout = max(
            (int) config('services.pasteurizador.timeout_seconds', 10800),
            1
        );
        $response = Http::timeout($timeout)->acceptJson()->post($url, $payload);

        if (! $response->successful()) {
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
        $maxPoints = min(
            max((int) $request->query('limit', self::GRAPH_DEFAULT_MAX_POINTS), 1),
            self::GRAPH_MAX_POINTS
        );
        $series = $this->serieAmostrasPeriodo($request, $maxPoints);

        return $request->boolean('with_meta') ? $series : $series['items'];
    }

    public function exportarCsv(int $coletaId, string $canal = 'Temp.Pasteuriza'): StreamedResponse
    {
        $fileName = 'pasteurizador_coleta_'.$coletaId.'.csv';
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
        $fileName = 'pasteurizador_grafico_'.now('America/Sao_Paulo')->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['coleta_id', 'timestamp_registro', 'canal', 'valor', 'unidade', 'qualidade']);

            foreach ($this->iterarAmostrasPeriodo($this->queryAmostrasPeriodo($request)) as $amostra) {
                fputcsv($handle, [
                    $amostra->coleta_id,
                    optional($amostra->timestamp_registro)->toDateTimeString(),
                    $amostra->canal,
                    $amostra->valor,
                    $amostra->unidade,
                    $amostra->qualidade,
                ]);
            }

            fclose($handle);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'X-Pasteurizador-Canal' => $canal,
        ]);
    }

    public function exportarPdfPeriodo(Request $request): array
    {
        $fileName = 'pasteurizador_grafico_'.now('America/Sao_Paulo')->format('Ymd_His').'.pdf';
        $outputPath = $this->temporaryOutputPath($fileName, 'pdf');
        $payload = $this->payloadGraficoPeriodo($request);

        $result = $this->executarExportadorGraficoPdf($payload, $outputPath);

        return [
            'arquivo' => $fileName,
            'caminho' => $outputPath,
            'processor' => $result,
        ];
    }

    private function queryAmostrasPeriodo(Request $request): Builder
    {
        $ultimaColetaId = null;
        if (! $request->filled('inicio') && ! $request->filled('fim')) {
            $ultimaColetaId = PasteurizadorColeta::query()
                ->where('total_amostras', '>', 0)
                ->orderByDesc('coletado_em')
                ->orderByDesc('id')
                ->value('id');
        }

        $deduplicadas = DB::connection('raw')
            ->table('pasteurizador_amostras as source')
            ->selectRaw('MAX(source.id) as id')
            ->whereNotNull('source.timestamp_registro');

        $this->aplicarFiltrosAmostrasPeriodo($deduplicadas, $request, 'source', $ultimaColetaId);

        $deduplicadas
            ->groupBy('source.canal')
            ->groupBy('source.timestamp_registro');

        return PasteurizadorAmostra::query()
            ->from('pasteurizador_amostras as pa')
            ->joinSub($deduplicadas, 'deduplicadas', function ($join): void {
                $join->on('deduplicadas.id', '=', 'pa.id');
            })
            ->select([
                'pa.id',
                'pa.coleta_id',
                'pa.sample_index',
                'pa.raw_offset',
                'pa.timestamp_registro',
                'pa.canal',
                'pa.valor',
                'pa.unidade',
                'pa.qualidade',
            ])
            ->orderBy('pa.timestamp_registro')
            ->orderBy('pa.canal')
            ->orderByDesc('pa.id');
    }

    private function aplicarFiltrosAmostrasPeriodo(
        $query,
        Request $request,
        string $alias,
        mixed $ultimaColetaId
    ): void {
        $canal = (string) $request->query('canal', 'Todos');
        if ($canal !== '' && $canal !== 'Todos') {
            $query->where($alias.'.canal', $canal);
        }

        if (! $request->filled('inicio') && ! $request->filled('fim') && $ultimaColetaId !== null) {
            $query->where($alias.'.coleta_id', $ultimaColetaId);
        }

        if ($request->filled('inicio')) {
            $horaInicio = $this->normalizarHoraComSegundos(
                (string) $request->query('hora_inicio', '00:00:00'),
                '00:00:00'
            );
            $query->where(
                $alias.'.timestamp_registro',
                '>=',
                (string) $request->query('inicio').' '.$horaInicio
            );
        }

        if ($request->filled('fim')) {
            $horaFim = $this->normalizarHoraComSegundos(
                (string) $request->query('hora_fim', '23:59:59'),
                '23:59:59'
            );
            $query->where(
                $alias.'.timestamp_registro',
                '<=',
                (string) $request->query('fim').' '.$horaFim
            );
        }
    }

    private function serieAmostrasPeriodo(Request $request, int $maxPoints): array
    {
        $maxPoints = max(1, min($maxPoints, self::GRAPH_MAX_POINTS));
        $query = $this->queryAmostrasPeriodo($request);
        $channelStats = $this->estatisticasCanaisPeriodo($query);
        $sourceTotal = array_sum(array_column($channelStats, 'total'));

        if ($sourceTotal === 0) {
            return [
                'items' => [],
                'meta' => [
                    'source_total' => 0,
                    'returned' => 0,
                    'max_points' => $maxPoints,
                    'reduced' => false,
                    'truncated' => false,
                    'first_timestamp' => null,
                    'last_timestamp' => null,
                    'channels' => [],
                ],
            ];
        }

        $amostras = $sourceTotal <= $maxPoints
            ? $query->get()
            : $this->reduzirAmostrasPeriodo($query, $channelStats, $maxPoints);

        $items = $amostras
            ->map(fn (PasteurizadorAmostra $amostra): array => $this->formatarAmostra($amostra))
            ->values()
            ->all();

        $primeira = $amostras->first();
        $ultima = $amostras->last();

        return [
            'items' => $items,
            'meta' => [
                'source_total' => $sourceTotal,
                'returned' => count($items),
                'max_points' => $maxPoints,
                'reduced' => $sourceTotal > count($items),
                'truncated' => false,
                'first_timestamp' => optional($primeira?->timestamp_registro)->toDateTimeString(),
                'last_timestamp' => optional($ultima?->timestamp_registro)->toDateTimeString(),
                'channels' => $channelStats,
            ],
        ];
    }

    private function estatisticasCanaisPeriodo(Builder $query): array
    {
        return (clone $query)
            ->reorder()
            ->select(['pa.canal'])
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('MIN(pa.valor) as minimo')
            ->selectRaw('MAX(pa.valor) as maximo')
            ->selectRaw('AVG(pa.valor) as media')
            ->groupBy('pa.canal')
            ->orderBy('pa.canal')
            ->get()
            ->map(fn (PasteurizadorAmostra $row): array => [
                'canal' => (string) $row->canal,
                'total' => (int) $row->getAttribute('total'),
                'minimo' => (float) $row->getAttribute('minimo'),
                'maximo' => (float) $row->getAttribute('maximo'),
                'media' => (float) $row->getAttribute('media'),
            ])
            ->values()
            ->all();
    }

    private function reduzirAmostrasPeriodo(
        Builder $query,
        array $channelStats,
        int $maxPoints
    ): Collection {
        $allocations = $this->alocarPontosPorCanal($channelStats, $maxPoints);
        $totals = collect($channelStats)
            ->mapWithKeys(fn (array $stats): array => [$stats['canal'] => (int) $stats['total']])
            ->all();
        $positions = [];
        $selected = [];
        $buckets = [];
        $smallChannelBuckets = [];

        foreach ($this->iterarAmostrasPeriodo($query) as $amostra) {
            $channel = (string) $amostra->canal;
            $position = $positions[$channel] ?? 0;
            $positions[$channel] = $position + 1;
            $allocation = $allocations[$channel] ?? 0;
            $channelTotal = $totals[$channel] ?? 0;

            if ($allocation <= 0) {
                continue;
            }

            if ($channelTotal <= $allocation) {
                $selected[(int) $amostra->id] = $amostra;

                continue;
            }

            if ($allocation < 4) {
                $smallChannelBuckets[$channel] ??= null;
                $this->atualizarBucket($smallChannelBuckets[$channel], $amostra);

                continue;
            }

            $bucketCount = max(1, intdiv($allocation, 4));
            $bucketIndex = min(
                $bucketCount - 1,
                intdiv($position * $bucketCount, max($channelTotal, 1))
            );
            $buckets[$channel] ??= [];
            $buckets[$channel][$bucketIndex] ??= null;
            $this->atualizarBucket($buckets[$channel][$bucketIndex], $amostra);
        }

        foreach ($buckets as $channelBuckets) {
            foreach ($channelBuckets as $bucket) {
                foreach (['first', 'min', 'max', 'last'] as $key) {
                    $amostra = $bucket[$key] ?? null;
                    if ($amostra instanceof PasteurizadorAmostra) {
                        $selected[(int) $amostra->id] = $amostra;
                    }
                }
            }
        }

        foreach ($smallChannelBuckets as $channel => $bucket) {
            $keys = match ($allocations[$channel] ?? 0) {
                1 => ['last'],
                2 => ['first', 'last'],
                default => ['first', 'min', 'last'],
            };

            foreach ($keys as $key) {
                $amostra = $bucket[$key] ?? null;
                if ($amostra instanceof PasteurizadorAmostra) {
                    $selected[(int) $amostra->id] = $amostra;
                }
            }
        }

        return collect(array_values($selected))
            ->sort(function (PasteurizadorAmostra $a, PasteurizadorAmostra $b): int {
                $timestamp = strcmp(
                    (string) optional($a->timestamp_registro)->toDateTimeString(),
                    (string) optional($b->timestamp_registro)->toDateTimeString()
                );

                return $timestamp !== 0
                    ? $timestamp
                    : strcmp((string) $a->canal, (string) $b->canal);
            })
            ->values();
    }

    private function alocarPontosPorCanal(array $channelStats, int $maxPoints): array
    {
        $ordered = collect($channelStats)
            ->filter(fn (array $stats): bool => (int) $stats['total'] > 0)
            ->sort(function (array $a, array $b): int {
                if ($a['canal'] === 'Temp.Pasteuriza') {
                    return -1;
                }
                if ($b['canal'] === 'Temp.Pasteuriza') {
                    return 1;
                }

                return strcmp((string) $a['canal'], (string) $b['canal']);
            })
            ->values()
            ->all();

        $allocations = array_fill_keys(
            array_map(fn (array $stats): string => (string) $stats['canal'], $ordered),
            0
        );
        $minimum = $maxPoints >= count($ordered) * 4 ? 4 : 1;
        $remaining = $maxPoints;

        foreach ($ordered as $stats) {
            if ($remaining <= 0) {
                break;
            }

            $channel = (string) $stats['canal'];
            $allocation = min($minimum, (int) $stats['total'], $remaining);
            $allocations[$channel] = $allocation;
            $remaining -= $allocation;
        }

        while ($remaining > 0) {
            $progress = false;
            foreach ($ordered as $stats) {
                $channel = (string) $stats['canal'];
                if ($allocations[$channel] >= (int) $stats['total']) {
                    continue;
                }

                $allocations[$channel]++;
                $remaining--;
                $progress = true;

                if ($remaining === 0) {
                    break;
                }
            }

            if (! $progress) {
                break;
            }
        }

        return $allocations;
    }

    private function atualizarBucket(?array &$bucket, PasteurizadorAmostra $amostra): void
    {
        if ($bucket === null) {
            $bucket = [
                'first' => $amostra,
                'last' => $amostra,
                'min' => $amostra,
                'max' => $amostra,
            ];

            return;
        }

        $bucket['last'] = $amostra;
        if ((float) $amostra->valor < (float) $bucket['min']->valor) {
            $bucket['min'] = $amostra;
        }
        if ((float) $amostra->valor > (float) $bucket['max']->valor) {
            $bucket['max'] = $amostra;
        }
    }

    private function iterarAmostrasPeriodo(Builder $query): Generator
    {
        $lastTimestamp = null;
        $lastChannel = null;

        while (true) {
            $pageQuery = clone $query;
            if ($lastTimestamp !== null && $lastChannel !== null) {
                $pageQuery->where(function (Builder $cursor) use ($lastTimestamp, $lastChannel): void {
                    $cursor
                        ->where('pa.timestamp_registro', '>', $lastTimestamp)
                        ->orWhere(function (Builder $sameTimestamp) use ($lastTimestamp, $lastChannel): void {
                            $sameTimestamp
                                ->where('pa.timestamp_registro', $lastTimestamp)
                                ->where('pa.canal', '>', $lastChannel);
                        });
                });
            }

            $page = $pageQuery
                ->limit(self::QUERY_CHUNK_SIZE)
                ->get();

            if ($page->isEmpty()) {
                return;
            }

            foreach ($page as $amostra) {
                yield $amostra;
            }

            /** @var PasteurizadorAmostra $last */
            $last = $page->last();
            $lastTimestamp = optional($last->timestamp_registro)->toDateTimeString();
            $lastChannel = (string) $last->canal;

            if ($page->count() < self::QUERY_CHUNK_SIZE) {
                return;
            }
        }
    }

    private function payloadGraficoPeriodo(Request $request): array
    {
        $inicio = (string) $request->query('inicio', '');
        $fim = (string) $request->query('fim', '');
        $horaInicio = $this->normalizarHoraComSegundos((string) $request->query('hora_inicio', '00:00:00'), '00:00:00');
        $horaFim = $this->normalizarHoraComSegundos((string) $request->query('hora_fim', '23:59:59'), '23:59:59');
        $canal = (string) $request->query('canal', 'Todos');

        $series = $this->serieAmostrasPeriodo($request, self::PDF_MAX_POINTS);

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
            'samples' => $series['items'],
            'series_meta' => $series['meta'],
        ];
    }

    private function periodoLabel(string $inicio, string $fim, string $horaInicio, string $horaFim): string
    {
        if ($inicio === '' && $fim === '') {
            return 'Última coleta salva';
        }

        $inicioLabel = $inicio !== '' ? date('d/m/Y', strtotime($inicio)).' '.$horaInicio : 'início';
        $fimLabel = $fim !== '' ? date('d/m/Y', strtotime($fim)).' '.$horaFim : 'fim';

        return $inicioLabel.' a '.$fimLabel;
    }

    private function executarExportadorGraficoPdf(array $payload, string $outputPath): array
    {
        $processorUrl = rtrim((string) config('services.pasteurizador.processor_url', 'http://192.168.5.203:8095'), '/');
        if ($processorUrl !== '') {
            $response = Http::timeout(120)
                ->accept('application/pdf')
                ->asJson()
                ->post($processorUrl.'/export-chart/pdf', $payload);

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
            .DIRECTORY_SEPARATOR
            .pathinfo($fileName, PATHINFO_FILENAME)
            .'_'
            .bin2hex(random_bytes(4))
            .'.'
            .$extension;
    }

    private function temporaryPayload(array $payload, string $prefix): string
    {
        $inputPath = tempnam(sys_get_temp_dir(), $prefix);
        file_put_contents($inputPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $inputPath;
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
            'ingestion_key' => $coleta->ingestion_key,
            'period_start' => optional($coleta->period_start)->toDateTimeString(),
            'period_end' => optional($coleta->period_end)->toDateTimeString(),
            'raw_sha256' => $coleta->raw_sha256,
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

    private function normalizarHora(string $hora, string $fallback = '00:00:00'): string
    {
        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $hora)) {
            return $hora;
        }

        if (preg_match('/^\d{2}:\d{2}$/', $hora)) {
            return $hora.':'.substr($fallback, -2);
        }

        return $fallback;
    }

    private function normalizarHoraComSegundos(string $hora, string $fallback): string
    {
        return $this->normalizarHora($hora, $fallback);
    }
}
