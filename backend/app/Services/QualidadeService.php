<?php

namespace App\Services;

use App\Models\Qualidade\ProdutorQualidade;
use App\Services\Coletas\ColetasGestaoService;
use App\Services\Qualidade\ProducerInsightsCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class QualidadeService
{
    private const DASHBOARD_MONTHS = 12;
    private const ANALISES_TABLE = 'resultadosanalises';
    private const IMPORTACOES_TABLE = 'importacoes_analises';
    private const ANALISE_FIELDS = [
        'gordura',
        'proteina',
        'lactose',
        'solidos_totais',
        'ccs',
        'ufc',
        'caseina',
        'sng',
        'ureia',
        'antibiotico',
        'bacteria',
        'temperatura',
    ];
    private const DASHBOARD_QUALITY_FIELDS = [
        'gordura',
        'proteina',
        'lactose',
        'solidos_totais',
        'ccs',
        'ufc',
    ];

    public function __construct(
        private readonly ColetasGestaoService $coletas,
        private readonly ProducerInsightsCalculator $insights,
    ) {
    }

    public function overview(): array
    {
        $agora = CarbonImmutable::now(config('app.timezone'));
        $produtoresAtivos = ProdutorQualidade::query()->where('ativo', 1)->count();
        $novosNoMes = ProdutorQualidade::query()
            ->whereBetween('data_cadastro', [$agora->startOfMonth(), $agora->endOfMonth()])
            ->count();
        $saidasDoisMeses = ProdutorQualidade::query()
            ->whereNotNull('data_inativacao')
            ->whereBetween('data_inativacao', [$agora->subMonth()->startOfMonth(), $agora->endOfMonth()])
            ->count();
        $evolucaoLeite = Schema::connection('raw')->hasTable('coletas')
            ? $this->coletas->resumoMensal()['serie']
            : [];

        if (! $this->analisesDisponiveis()) {
            return [
                'produtores_ativos' => $produtoresAtivos,
                'analises_validadas' => 0,
                'ultima_analise' => null,
                'periodo_atual' => now()->format('m/Y'),
                'produtores_com_analise' => 0,
                'produtores_sem_analise' => $produtoresAtivos,
                'novos_no_mes' => $novosNoMes,
                'saidas_ultimos_dois_meses' => $saidasDoisMeses,
                'evolucao_leite' => $evolucaoLeite,
            ];
        }

        $analises = $this->analisesBase();
        $produtoresComAnalise = (clone $analises)->distinct('ra.produtor_codigo')->count('ra.produtor_codigo');

        return [
            'produtores_ativos' => $produtoresAtivos,
            'analises_validadas' => (clone $analises)->count(),
            'ultima_analise' => (clone $analises)->max('ra.data'),
            'periodo_atual' => now()->format('m/Y'),
            'produtores_com_analise' => $produtoresComAnalise,
            'produtores_sem_analise' => max($produtoresAtivos - $produtoresComAnalise, 0),
            'novos_no_mes' => $novosNoMes,
            'saidas_ultimos_dois_meses' => $saidasDoisMeses,
            'evolucao_leite' => $evolucaoLeite,
        ];
    }

    public function produtores(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $query = ProdutorQualidade::query()
            ->select([
                'codigo',
                'nome',
                'cidade',
                'rota',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
            ])
            ->where('ativo', 1)
            ->orderBy('nome');

        $this->aplicarFiltrosProdutor($query, $request);

        $page = $query->paginate($perPage);
        $produtores = collect($page->items());
        $ultimasAnalises = $this->ultimasAnalisesPorProdutor(
            $produtores->pluck('codigo')->map(fn ($codigo): string => (string) $codigo)->all()
        );

        return [
            'items' => $produtores
                ->map(fn (ProdutorQualidade $produtor): array => [
                    ...$this->formatarProdutor($produtor),
                    'ultima_analise' => $ultimasAnalises[(string) $produtor->codigo] ?? null,
                ])
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function analises(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 100);

        if (! $this->analisesDisponiveis()) {
            return $this->paginaVazia($perPage);
        }

        $query = $this->analisesBase()
            ->orderByDesc('ra.data')
            ->orderBy('p.nome')
            ->orderByDesc('ra.id');

        $this->aplicarFiltrosAnalise($query, $request);

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($analise): array => $this->formatarAnalise($analise))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function importarAnalises(UploadedFile $arquivo): array
    {
        $extensao = strtolower((string) $arquivo->getClientOriginalExtension());
        if (! in_array($extensao, ['xlsx', 'xls', 'csv'], true)) {
            return $this->resultadoImportacaoVazio('IMPORT_311', 'Formato de arquivo nao suportado.');
        }

        $nomeOriginal = $arquivo->getClientOriginalName();
        $nomeStorage = now()->format('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $nomeOriginal;
        $caminhoRelativo = $arquivo->storeAs('importacoes/analises', $nomeStorage, 'local');
        $caminhoCompleto = Storage::disk('local')->path($caminhoRelativo);
        $hash = hash_file('sha256', $caminhoCompleto);
        $jaImportado = $this->importacaoJaRegistrada($hash);

        $processor = $this->executarProcessorAnalises($caminhoCompleto, $nomeOriginal, $hash);
        $records = collect($processor['records'] ?? []);
        $processorErrors = $processor['errors'] ?? [];
        $processorWarnings = $processor['warnings'] ?? [];

        $codigos = $records
            ->map(fn (array $record): string => (string) data_get($record, 'data.produtor_codigo'))
            ->filter()
            ->unique()
            ->values();

        $produtoresExistentes = ProdutorQualidade::query()
            ->whereIn('codigo', $codigos->all())
            ->pluck('codigo')
            ->map(fn ($codigo): string => (string) $codigo)
            ->flip();

        $missingCodes = [];
        $recordsValidos = [];
        $producerErrors = [];

        foreach ($records as $record) {
            $codigo = (string) data_get($record, 'data.produtor_codigo');
            if (! $produtoresExistentes->has($codigo)) {
                $missingCodes[$codigo] = true;
                $producerErrors[] = [
                    'sheet' => data_get($record, 'source.sheet'),
                    'line' => data_get($record, 'source.line'),
                    'code' => 'PRODUCER_410',
                    'message' => 'Produtor nao encontrado.',
                    'details' => [
                        'produtor_codigo' => $codigo,
                    ],
                ];
                continue;
            }

            $recordsValidos[] = $record;
        }

        $merge = $this->gravarAnalisesValidas($recordsValidos);
        $missingCodes = array_keys($missingCodes);
        sort($missingCodes);

        $warnings = $processorWarnings;
        if ($missingCodes !== []) {
            $warnings[] = [
                'code' => 'PRODUCER_410',
                'message' => 'Alguns produtores da planilha não estão registrados e foram ignorados.',
                'details' => [
                    'produtor_codigos' => $missingCodes,
                ],
            ];
        }

        $errors = array_values(array_merge($processorErrors, $producerErrors));
        $summary = [
            'arquivo' => $nomeOriginal,
            'arquivo_hash' => $hash,
            'ja_importado' => $jaImportado,
            'total_linhas' => (int) data_get($processor, 'summary.total', count($records) + count($errors)),
            'linhas_validas_processor' => (int) data_get($processor, 'summary.valid', count($records)),
            'linhas_com_erro' => count($errors),
            'produtores_nao_encontrados' => count($missingCodes),
            'registros_criados' => $merge['created'],
            'registros_completados' => $merge['completed'],
            'registros_sem_mudanca' => $merge['unchanged'],
        ];

        $this->registrarImportacaoAnalises($nomeOriginal, $caminhoRelativo, $hash, $summary, $processor, $errors);

        return [
            'summary' => $summary,
            'warnings' => $warnings,
            'errors' => $errors,
        ];
    }

    public function produtor(string $codigo): ?array
    {
        $produtor = ProdutorQualidade::query()
            ->where('codigo', $codigo)
            ->first();

        if ($produtor === null) {
            return null;
        }

        $analisesCanonicas = $this->idsAnalisesCanonicasDoProdutor($codigo);
        $analisesRecentes = $this->analisesRecentesDoProdutor($codigo, $analisesCanonicas, 12);

        return [
            'produtor' => $this->formatarProdutor($produtor),
            'resumo' => $this->resumoAnalisesDoProdutor($analisesCanonicas),
            'ultima_analise' => $analisesRecentes[0] ?? null,
            'analises_recentes' => $analisesRecentes,
            'dashboard' => $this->dashboardDoProdutor($codigo, $analisesCanonicas),
        ];
    }

    public function analisesDoProdutor(Request $request, string $codigo): ?array
    {
        $exists = ProdutorQualidade::query()
            ->where('codigo', $codigo)
            ->exists();

        if (! $exists) {
            return null;
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        if (! $this->analisesDisponiveis()) {
            return $this->paginaVazia($perPage);
        }

        $analisesCanonicas = $this->idsAnalisesCanonicasDoProdutor($codigo);

        if ($analisesCanonicas === []) {
            return $this->paginaVazia($perPage);
        }

        $page = $this->analisesBase()
            ->where('ra.produtor_codigo', $codigo)
            ->whereIn('ra.id', $analisesCanonicas)
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($analise): array => $this->formatarAnalise($analise))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    private function aplicarFiltrosProdutor($query, Request $request): void
    {
        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query->where('codigo', 'like', "%{$search}%")
                    ->orWhere('nome', 'like', "%{$search}%")
                    ->orWhere('cidade', 'like', "%{$search}%")
                    ->orWhere('rota', 'like', "%{$search}%");
            });
        }

        if ($request->has('ativo')) {
            $query->where('ativo', $request->boolean('ativo') ? 1 : 0);
        }

        if ($request->filled('rota')) {
            $query->where('rota', (string) $request->query('rota'));
        }
    }

    private function executarProcessorAnalises(string $caminhoCompleto, string $nomeOriginal, string $hash): array
    {
        $processorUrl = rtrim((string) config('services.processor.url', ''), '/');
        if ($processorUrl !== '') {
            return $this->executarProcessorAnalisesHttp($processorUrl, $caminhoCompleto, $nomeOriginal, $hash);
        }

        $script = env(
            'QUALIDADE_PROCESSOR_SCRIPT',
            base_path('../processor/modules/qualidade/import_analyses.py')
        );
        $python = env('PYTHON_BINARY', 'python');
        $pythonCommand = preg_split('/\s+/', trim($python)) ?: ['python'];

        $process = new Process([
            ...$pythonCommand,
            $script,
            '--input',
            $caminhoCompleto,
            '--filename',
            $nomeOriginal,
            '--hash',
            $hash,
        ]);
        $process->setTimeout(120);
        $process->run();

        $output = trim($process->getOutput());
        $decoded = $output !== '' ? json_decode($output, true) : null;

        if (! is_array($decoded)) {
            return [
                'success' => false,
                'summary' => [
                    'total' => 0,
                    'valid' => 0,
                    'errors' => 1,
                    'warnings' => 0,
                ],
                'records' => [],
                'errors' => [[
                    'code' => 'PROCESSOR_711',
                    'message' => 'Retorno do processor invalido.',
                    'details' => [
                        'stderr' => $process->getErrorOutput(),
                    ],
                ]],
                'warnings' => [],
            ];
        }

        return $decoded;
    }

    private function executarProcessorAnalisesHttp(string $processorUrl, string $caminhoCompleto, string $nomeOriginal, string $hash): array
    {
        try {
            $request = Http::timeout(120);
            $token = (string) config('services.processor.token', '');
            if ($token !== '') {
                $request = $request->withHeaders(['X-Processor-Token' => $token]);
            }

            $response = $request->post($processorUrl . '/qualidade/import-analises', [
                'filename' => $nomeOriginal,
                'hash' => $hash,
                'content_base64' => base64_encode((string) file_get_contents($caminhoCompleto)),
            ]);
        } catch (\Throwable $exc) {
            return $this->processorError('PROCESSOR_712', 'Falha ao conectar ao processor.', [
                'error' => $exc->getMessage(),
            ]);
        }

        $decoded = $response->json();
        if (! $response->successful() || ! is_array($decoded)) {
            return $this->processorError('PROCESSOR_711', 'Retorno do processor invalido.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }

        return $decoded;
    }

    private function processorError(string $code, string $message, array $details): array
    {
        return [
            'success' => false,
            'summary' => [
                'total' => 0,
                'valid' => 0,
                'errors' => 1,
                'warnings' => 0,
            ],
            'records' => [],
            'errors' => [[
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ]],
            'warnings' => [],
        ];
    }

    private function gravarAnalisesValidas(array $records): array
    {
        $summary = [
            'created' => 0,
            'completed' => 0,
            'unchanged' => 0,
        ];

        DB::connection('raw')->transaction(function () use ($records, &$summary): void {
            foreach ($records as $record) {
                $dados = data_get($record, 'data', []);
                $existente = DB::connection('raw')
                    ->table(self::ANALISES_TABLE)
                    ->where('produtor_codigo', $dados['produtor_codigo'])
                    ->whereDate('data', $dados['data'])
                    ->orderByDesc('id')
                    ->first();

                if ($existente === null) {
                    $insert = [
                        'produtor_codigo' => $dados['produtor_codigo'],
                        'data' => $dados['data'],
                        'created_at' => now(),
                    ];
                    foreach (self::ANALISE_FIELDS as $field) {
                        if (array_key_exists($field, $dados) && $dados[$field] !== null) {
                            $insert[$field] = $dados[$field];
                        }
                    }
                    DB::connection('raw')->table(self::ANALISES_TABLE)->insert($insert);
                    $summary['created']++;
                    continue;
                }

                $update = [];
                foreach (self::ANALISE_FIELDS as $field) {
                    if (($dados[$field] ?? null) !== null && ($existente->{$field} ?? null) === null) {
                        $update[$field] = $dados[$field];
                    }
                }

                if ($update === []) {
                    $summary['unchanged']++;
                    continue;
                }

                $update['updated_at'] = now();
                DB::connection('raw')
                    ->table(self::ANALISES_TABLE)
                    ->where('id', $existente->id)
                    ->update($update);
                $summary['completed']++;
            }
        });

        return $summary;
    }

    private function importacaoJaRegistrada(string $hash): bool
    {
        return Schema::connection('raw')->hasTable(self::IMPORTACOES_TABLE)
            && DB::connection('raw')->table(self::IMPORTACOES_TABLE)->where('arquivo_hash', $hash)->exists();
    }

    private function registrarImportacaoAnalises(string $nomeOriginal, string $caminhoRelativo, string $hash, array $summary, array $processor, array $errors): void
    {
        if (! Schema::connection('raw')->hasTable(self::IMPORTACOES_TABLE)) {
            return;
        }

        $registrosProcessados = $summary['registros_criados']
            + $summary['registros_completados']
            + $summary['registros_sem_mudanca'];
        $status = $registrosProcessados > 0
            ? ($errors === [] ? 'processed' : 'processed_with_warnings')
            : 'failed';

        DB::connection('raw')->table(self::IMPORTACOES_TABLE)->insert([
            'arquivo_nome_original' => $nomeOriginal,
            'arquivo_caminho_storage' => $caminhoRelativo,
            'arquivo_hash' => $hash,
            'usuario_id' => auth()->id(),
            'status' => $status,
            'ja_importado' => $summary['ja_importado'] ? 1 : 0,
            'total_linhas' => $summary['total_linhas'],
            'linhas_validas' => $summary['linhas_validas_processor'],
            'linhas_com_erro' => $summary['linhas_com_erro'],
            'registros_criados' => $summary['registros_criados'],
            'registros_completados' => $summary['registros_completados'],
            'registros_sem_mudanca' => $summary['registros_sem_mudanca'],
            'erro_codigo' => $errors[0]['code'] ?? null,
            'erro_mensagem' => $errors[0]['message'] ?? null,
            'processor_summary' => json_encode($processor['summary'] ?? [], JSON_UNESCAPED_UNICODE),
            'processor_errors' => json_encode($errors, JSON_UNESCAPED_UNICODE),
            'processed_at' => now(),
        ]);
    }

    private function resultadoImportacaoVazio(string $code, string $message): array
    {
        return [
            'summary' => [
                'arquivo' => null,
                'arquivo_hash' => null,
                'ja_importado' => false,
                'total_linhas' => 0,
                'linhas_validas_processor' => 0,
                'linhas_com_erro' => 1,
                'produtores_nao_encontrados' => 0,
                'registros_criados' => 0,
                'registros_completados' => 0,
                'registros_sem_mudanca' => 0,
            ],
            'warnings' => [],
            'errors' => [[
                'code' => $code,
                'message' => $message,
                'details' => [],
            ]],
        ];
    }

    private function aplicarFiltrosAnalise($query, Request $request): void
    {
        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query->where('ra.produtor_codigo', 'like', "%{$search}%")
                    ->orWhere('p.nome', 'like', "%{$search}%")
                    ->orWhere('p.cidade', 'like', "%{$search}%");
            });
        }

        if ($request->filled('produtor_codigo')) {
            $query->where('ra.produtor_codigo', (string) $request->query('produtor_codigo'));
        }

        if ($request->filled('data_inicio')) {
            $query->whereDate('ra.data', '>=', (string) $request->query('data_inicio'));
        }

        if ($request->filled('data_fim')) {
            $query->whereDate('ra.data', '<=', (string) $request->query('data_fim'));
        }
    }

    private function analisesBase()
    {
        return DB::connection('raw')
            ->table(self::ANALISES_TABLE . ' as ra')
            ->leftJoin('produtores as p', 'p.codigo', '=', 'ra.produtor_codigo')
            ->select([
                'ra.id',
                'ra.produtor_codigo',
                'p.nome as produtor_nome',
                'p.cidade as produtor_cidade',
                'ra.data',
                'ra.gordura',
                'ra.proteina',
                'ra.lactose',
                'ra.solidos_totais',
                'ra.ccs',
                'ra.ufc',
                'ra.caseina',
                'ra.sng',
                'ra.ureia',
                'ra.antibiotico',
                'ra.bacteria',
                'ra.temperatura',
                'ra.created_at',
                'ra.updated_at',
            ]);
    }

    private function analisesDisponiveis(): bool
    {
        return Schema::connection('raw')->hasTable(self::ANALISES_TABLE);
    }

    private function dashboardDoProdutor(string $codigo, array $analisesCanonicas): array
    {
        $milkHistory = $this->coletas->resumoMensalProdutor($codigo, self::DASHBOARD_MONTHS);
        $milkSeries = collect($milkHistory['serie_mensal']);
        $currentMilk = $milkSeries->firstWhere('periodo', $milkHistory['periodo_atual']);
        $milkComparison = $this->insights->compareMilkVolume(
            ($currentMilk['coletas'] ?? 0) > 0 ? (float) $currentMilk['litros'] : null,
            $milkHistory['anterior_comparavel_coletas'] > 0
                ? (float) $milkHistory['anterior_comparavel_litros']
                : null,
        );
        $qualityHistory = $this->historicoQualidadeDoProdutor($codigo, $analisesCanonicas, self::DASHBOARD_MONTHS);
        $qualitySeries = collect($qualityHistory['serie_mensal']);
        $currentQuality = $qualitySeries->firstWhere('periodo', $qualityHistory['periodo_atual']);
        $previousQuality = $qualitySeries->firstWhere('periodo', $qualityHistory['periodo_anterior']);
        $qualityComparison = $this->insights->compareQuality(
            ($currentQuality['analises'] ?? 0) > 0 ? $currentQuality : [],
            ($previousQuality['analises'] ?? 0) > 0 ? $previousQuality : [],
        );

        return [
            'leite' => [
                'periodo_atual' => $milkHistory['periodo_atual'],
                'periodo_anterior' => $milkHistory['periodo_anterior'],
                'periodo_parcial' => $milkHistory['periodo_parcial'],
                'dia_comparacao' => $milkHistory['dia_comparacao'],
                ...$milkComparison,
                'coletas_atual' => (int) ($currentMilk['coletas'] ?? 0),
                'dias_coleta_atual' => (int) ($currentMilk['dias_coleta'] ?? 0),
                'media_por_coleta' => $currentMilk['media_por_coleta'] ?? null,
                'ultima_coleta' => $milkHistory['ultima_coleta'],
                'serie_mensal' => $milkHistory['serie_mensal'],
            ],
            'qualidade' => [
                'periodo_atual' => $qualityHistory['periodo_atual'],
                'periodo_anterior' => $qualityHistory['periodo_anterior'],
                ...$qualityComparison,
                'media_atual' => ($currentQuality['analises'] ?? 0) > 0 ? $currentQuality : null,
                'media_anterior' => ($previousQuality['analises'] ?? 0) > 0 ? $previousQuality : null,
                'serie_mensal' => $qualityHistory['serie_mensal'],
            ],
        ];
    }

    private function historicoQualidadeDoProdutor(string $codigo, array $analisesCanonicas, int $meses): array
    {
        if (! $this->analisesDisponiveis() || $analisesCanonicas === []) {
            return [
                'periodo_atual' => null,
                'periodo_anterior' => null,
                'serie_mensal' => [],
            ];
        }

        $query = DB::connection('raw')
            ->table(self::ANALISES_TABLE)
            ->where('produtor_codigo', $codigo)
            ->whereIn('id', $analisesCanonicas);
        $latestDate = (clone $query)->max('data');

        if ($latestDate === null) {
            return [
                'periodo_atual' => null,
                'periodo_anterior' => null,
                'serie_mensal' => [],
            ];
        }

        $reference = CarbonImmutable::parse((string) $latestDate)->startOfMonth();
        $start = $reference->subMonths($meses - 1);
        $end = $reference->addMonth();
        $rows = (clone $query)
            ->select(['data', ...self::DASHBOARD_QUALITY_FIELDS])
            ->where('data', '>=', $start->format('Y-m-d'))
            ->where('data', '<', $end->format('Y-m-d'))
            ->orderBy('data')
            ->get();
        $rowsByMonth = $rows->groupBy(
            fn ($row): string => CarbonImmutable::parse((string) $row->data)->format('Y-m')
        );
        $series = [];

        for ($index = 0; $index < $meses; $index++) {
            $period = $start->addMonths($index)->format('Y-m');
            $monthRows = $rowsByMonth->get($period, collect());
            $point = [
                'periodo' => $period,
                'analises' => $monthRows->count(),
            ];

            foreach (self::DASHBOARD_QUALITY_FIELDS as $field) {
                $values = $monthRows
                    ->pluck($field)
                    ->filter(fn ($value): bool => $value !== null && is_numeric($value))
                    ->map(fn ($value): float => (float) $value);
                $average = $values->isNotEmpty() ? (float) $values->average() : null;
                $point[$field] = $average === null
                    ? null
                    : ($field === 'ccs' || $field === 'ufc' ? round($average) : round($average, 2));
            }

            $series[] = $point;
        }

        return [
            'periodo_atual' => $reference->format('Y-m'),
            'periodo_anterior' => $reference->subMonth()->format('Y-m'),
            'serie_mensal' => $series,
        ];
    }

    private function analisesRecentesDoProdutor(string $codigo, array $analisesCanonicas, int $limit): array
    {
        if (! $this->analisesDisponiveis() || $analisesCanonicas === []) {
            return [];
        }

        return $this->analisesBase()
            ->where('ra.produtor_codigo', $codigo)
            ->whereIn('ra.id', $analisesCanonicas)
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->limit($limit)
            ->get()
            ->map(fn ($analise): array => $this->formatarAnalise($analise))
            ->values()
            ->all();
    }

    private function resumoAnalisesDoProdutor(array $analisesCanonicas): array
    {
        if (! $this->analisesDisponiveis() || $analisesCanonicas === []) {
            return [
                'total_analises' => 0,
                'ultima_analise' => null,
                'media_gordura' => null,
                'media_proteina' => null,
                'media_ccs' => null,
                'media_ufc' => null,
            ];
        }

        $resumo = DB::connection('raw')
            ->table(self::ANALISES_TABLE)
            ->whereIn('id', $analisesCanonicas)
            ->selectRaw('COUNT(*) as total_analises')
            ->selectRaw('MAX(data) as ultima_analise')
            ->selectRaw('AVG(gordura) as media_gordura')
            ->selectRaw('AVG(proteina) as media_proteina')
            ->selectRaw('AVG(ccs) as media_ccs')
            ->selectRaw('AVG(ufc) as media_ufc')
            ->first();

        return [
            'total_analises' => (int) ($resumo->total_analises ?? 0),
            'ultima_analise' => $resumo->ultima_analise ?? null,
            'media_gordura' => $resumo->media_gordura !== null ? round((float) $resumo->media_gordura, 2) : null,
            'media_proteina' => $resumo->media_proteina !== null ? round((float) $resumo->media_proteina, 2) : null,
            'media_ccs' => $resumo->media_ccs !== null ? round((float) $resumo->media_ccs) : null,
            'media_ufc' => $resumo->media_ufc !== null ? round((float) $resumo->media_ufc) : null,
        ];
    }

    /**
     * Mantém apenas a análise mais recente de cada dia. Importações antigas podiam
     * gerar mais de uma linha para o mesmo produtor e data.
     *
     * @return array<int, int>
     */
    private function idsAnalisesCanonicasDoProdutor(string $codigo): array
    {
        if (! $this->analisesDisponiveis()) {
            return [];
        }

        return DB::connection('raw')
            ->table(self::ANALISES_TABLE)
            ->where('produtor_codigo', $codigo)
            ->selectRaw('MAX(id) AS id')
            ->groupBy('data')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    private function ultimasAnalisesPorProdutor(array $codigos): array
    {
        if ($codigos === [] || ! $this->analisesDisponiveis()) {
            return [];
        }

        return $this->analisesBase()
            ->whereIn('ra.produtor_codigo', $codigos)
            ->orderBy('ra.produtor_codigo')
            ->orderByDesc('ra.data')
            ->orderByDesc('ra.id')
            ->get()
            ->unique(fn ($analise): string => (string) $analise->produtor_codigo)
            ->mapWithKeys(fn ($analise): array => [
                (string) $analise->produtor_codigo => $this->formatarAnalise($analise),
            ])
            ->all();
    }

    private function paginaVazia(int $perPage): array
    {
        return [
            'items' => [],
            'pagination' => [
                'current_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
            ],
        ];
    }

    private function formatarProdutor(ProdutorQualidade $produtor): array
    {
        return [
            'codigo' => (string) $produtor->codigo,
            'nome' => (string) $produtor->nome,
            'cidade' => (string) $produtor->cidade,
            'rota' => (string) $produtor->rota,
            'cpf_cnpj' => $produtor->cpf_cnpj,
            'celular' => $produtor->celular,
            'ativo' => (bool) $produtor->ativo,
            'novo' => (bool) $produtor->novo,
            'data_cadastro' => $produtor->data_cadastro?->format('Y-m-d H:i:s'),
            'data_inativacao' => $produtor->data_inativacao?->format('Y-m-d H:i:s'),
        ];
    }

    private function formatarAnalise($analise): array
    {
        return [
            'id' => (int) $analise->id,
            'produtor_codigo' => (string) $analise->produtor_codigo,
            'produtor_nome' => $analise->produtor_nome,
            'produtor_cidade' => $analise->produtor_cidade,
            'data' => (string) $analise->data,
            'gordura' => $analise->gordura !== null ? (float) $analise->gordura : null,
            'proteina' => $analise->proteina !== null ? (float) $analise->proteina : null,
            'lactose' => $analise->lactose !== null ? (float) $analise->lactose : null,
            'solidos_totais' => $analise->solidos_totais !== null ? (float) $analise->solidos_totais : null,
            'ccs' => $analise->ccs !== null ? (int) $analise->ccs : null,
            'ufc' => $analise->ufc !== null ? (int) $analise->ufc : null,
            'caseina' => $analise->caseina !== null ? (float) $analise->caseina : null,
            'sng' => $analise->sng !== null ? (float) $analise->sng : null,
            'ureia' => $analise->ureia !== null ? (float) $analise->ureia : null,
            'antibiotico' => $analise->antibiotico !== null ? (float) $analise->antibiotico : null,
            'bacteria' => $analise->bacteria !== null ? (float) $analise->bacteria : null,
            'temperatura' => $analise->temperatura !== null ? (float) $analise->temperatura : null,
        ];
    }
}
