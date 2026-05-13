<?php

namespace App\Services\Qualidade;

use App\Models\ProdutorQualidade;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;

class RelatoriosService
{
    private const ANALISES_TABLE = 'resultadosanalises';
    private const IMPORTACOES_TABLE = 'importacoes_analises';

    public function resumo(Request $request): array
    {
        $produtores = ProdutorQualidade::query()
            ->select([
                'codigo',
                'nome',
                'cidade',
                'rota',
                'cpf_cnpj',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
            ])
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get();

        $ultimaAnalise = $this->analisesDisponiveis() ? $this->analisesBase()->max('ra.data') : null;
        $periodo = $this->resolverPeriodo($request, $ultimaAnalise);
        $codigos = $produtores->pluck('codigo')->map(fn ($codigo): string => (string) $codigo)->all();
        $analisesDoPeriodo = $this->ultimasAnalisesPorProdutorNoPeriodo($codigos, $periodo['inicio'], $periodo['fim']);

        $produtoresRelatorio = $produtores
            ->map(function (ProdutorQualidade $produtor) use ($analisesDoPeriodo): array {
                $analise = $analisesDoPeriodo[(string) $produtor->codigo] ?? null;
                $pendencias = $analise !== null ? $this->avaliarIndicadores($analise) : [];

                return [
                    ...$this->formatarProdutor($produtor),
                    'ultima_analise' => $analise,
                    'status_qualidade' => $analise === null
                        ? 'sem_analise'
                        : ($pendencias === [] ? 'dentro_padrao' : 'fora_padrao'),
                    'total_pendencias' => count($pendencias),
                    'pendencias' => $pendencias,
                ];
            })
            ->values();

        $ativos = $produtoresRelatorio->where('ativo', true);
        $ativosComAnalise = $ativos->filter(fn (array $produtor): bool => $produtor['ultima_analise'] !== null);
        $ativosSemAnalise = $ativos->filter(fn (array $produtor): bool => $produtor['ultima_analise'] === null)->values();
        $foraPadrao = $ativosComAnalise
            ->filter(fn (array $produtor): bool => $produtor['status_qualidade'] === 'fora_padrao')
            ->values();

        $analisesNoPeriodo = $this->analisesDisponiveis()
            ? $this->analisesBase()
                ->whereDate('ra.data', '>=', $periodo['inicio'])
                ->whereDate('ra.data', '<=', $periodo['fim'])
                ->count()
            : 0;

        $comAnaliseTotal = $ativosComAnalise->count();
        $dentroPadrao = max($comAnaliseTotal - $foraPadrao->count(), 0);

        return [
            'periodo' => $periodo,
            'totais' => [
                'produtores' => $produtoresRelatorio->count(),
                'ativos' => $ativos->count(),
                'inativos' => $produtoresRelatorio->where('ativo', false)->count(),
                'novos' => $produtoresRelatorio->where('novo', true)->count(),
                'analises' => $analisesNoPeriodo,
                'produtores_com_analise' => $comAnaliseTotal,
                'produtores_sem_analise' => $ativosSemAnalise->count(),
                'dentro_padrao' => $dentroPadrao,
                'fora_padrao' => $foraPadrao->count(),
                'percentual_dentro' => $comAnaliseTotal > 0 ? round(($dentroPadrao / $comAnaliseTotal) * 100, 1) : 0.0,
                'percentual_fora' => $comAnaliseTotal > 0 ? round(($foraPadrao->count() / $comAnaliseTotal) * 100, 1) : 0.0,
            ],
            'opcoes' => [
                'rotas' => $produtoresRelatorio->pluck('rota')->filter()->unique()->sort()->values()->all(),
                'cidades' => $produtoresRelatorio->pluck('cidade')->filter()->unique()->sort()->values()->all(),
            ],
            'ultima_analise' => $ultimaAnalise,
            'ultima_importacao' => $this->ultimaImportacao(),
            'produtores' => $produtoresRelatorio->all(),
            'sem_analise' => $ativosSemAnalise->all(),
            'ranking_atencao' => $foraPadrao
                ->sortByDesc('total_pendencias')
                ->take(20)
                ->values()
                ->all(),
            'fora_padrao' => $this->agruparPendencias($foraPadrao->all()),
            'importacoes' => $this->historicoImportacoes(20),
            'evolucao_mensal' => $this->evolucaoMensal(),
        ];
    }

    public function pendenciasProdutor(Request $request, string $codigo): ?array
    {
        $resumo = $this->resumo($request);
        $produtor = collect($resumo['produtores'])
            ->first(fn (array $item): bool => $item['codigo'] === $codigo);

        if ($produtor === null) {
            return null;
        }

        return [
            'periodo' => $resumo['periodo'],
            'produtor' => [
                'codigo' => $produtor['codigo'],
                'nome' => $produtor['nome'],
                'cidade' => $produtor['cidade'],
                'rota' => $produtor['rota'],
                'ativo' => $produtor['ativo'],
                'novo' => $produtor['novo'],
            ],
            'ultima_analise' => $produtor['ultima_analise'],
            'status_qualidade' => $produtor['status_qualidade'],
            'total_pendencias' => $produtor['total_pendencias'],
            'pendencias' => $produtor['pendencias'],
        ];
    }

    public function exportarProdutoresAnalises(Request $request): array
    {
        $payload = $this->payloadProdutoresAnalises($request);
        $periodo = $payload['periodo'];
        $fileName = 'qualidade_produtores_analises_' . str_replace('-', '_', $periodo['mes']) . '.xlsx';
        $outputPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR
            . pathinfo($fileName, PATHINFO_FILENAME)
            . '_'
            . bin2hex(random_bytes(4))
            . '.xlsx';
        $inputPath = tempnam(sys_get_temp_dir(), 'santilac_export_');
        file_put_contents($inputPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $result = $this->executarExportadorProdutoresAnalises($inputPath, $outputPath);
        @unlink($inputPath);

        return [
            'arquivo' => $fileName,
            'caminho' => $outputPath,
            'periodo' => $periodo,
            'totais' => $payload['totais'],
            'processor' => $result,
        ];
    }

    public function exportarProdutoresAnalisesPdf(Request $request): array
    {
        $payload = $this->payloadProdutoresAnalises($request);
        $periodo = $payload['periodo'];
        $fileName = 'qualidade_produtores_analises_' . str_replace('-', '_', $periodo['mes']) . '.pdf';
        $outputPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR
            . pathinfo($fileName, PATHINFO_FILENAME)
            . '_'
            . bin2hex(random_bytes(4))
            . '.pdf';
        $inputPath = tempnam(sys_get_temp_dir(), 'santilac_pdf_export_');
        file_put_contents($inputPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $result = $this->executarExportadorProdutoresAnalisesPdf($inputPath, $outputPath);
        @unlink($inputPath);

        return [
            'arquivo' => $fileName,
            'caminho' => $outputPath,
            'periodo' => $periodo,
            'totais' => $payload['totais'],
            'processor' => $result,
        ];
    }

    private function payloadProdutoresAnalises(Request $request): array
    {
        $periodo = $this->resolverPeriodoExportacao($request);
        $produtores = ProdutorQualidade::query()
            ->select([
                'codigo',
                'nome',
                'cidade',
                'rota',
                'cpf_cnpj',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
            ])
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get();

        $codigos = $produtores->pluck('codigo')->map(fn ($codigo): string => (string) $codigo)->all();
        $analises = $this->ultimasAnalisesPorProdutorNoPeriodo($codigos, $periodo['inicio'], $periodo['fim']);
        $items = $produtores
            ->map(fn (ProdutorQualidade $produtor): array => [
                ...$this->formatarProdutor($produtor),
                'ultima_analise' => $analises[(string) $produtor->codigo] ?? null,
            ])
            ->values()
            ->all();

        $comAnalise = collect($items)->filter(fn (array $produtor): bool => $produtor['ultima_analise'] !== null)->count();
        return [
            'periodo' => $periodo,
            'gerado_em' => now()->toDateString(),
            'gerado_hora' => now()->format('H:i:s'),
            'totais' => [
                'produtores' => count($items),
                'com_analise' => $comAnalise,
                'sem_analise' => count($items) - $comAnalise,
            ],
            'produtores' => $items,
        ];
    }

    private function resolverPeriodo(Request $request, ?string $ultimaAnalise): array
    {
        $base = $ultimaAnalise !== null ? Carbon::parse($ultimaAnalise) : now();
        $inicio = $request->filled('data_inicio')
            ? Carbon::parse((string) $request->query('data_inicio'))
            : $base->copy()->startOfMonth();
        $fim = $request->filled('data_fim')
            ? Carbon::parse((string) $request->query('data_fim'))
            : $base->copy()->endOfMonth();

        if ($fim->lt($inicio)) {
            [$inicio, $fim] = [$fim, $inicio];
        }

        return [
            'inicio' => $inicio->toDateString(),
            'fim' => $fim->toDateString(),
            'label' => $inicio->isSameMonth($fim)
                ? $inicio->format('m/Y')
                : $inicio->format('d/m/Y') . ' a ' . $fim->format('d/m/Y'),
        ];
    }

    private function resolverPeriodoExportacao(Request $request): array
    {
        $ultimaAnalise = $this->analisesDisponiveis() ? $this->analisesBase()->max('ra.data') : null;
        $mes = trim((string) $request->input('mes', ''));
        $base = $mes !== '' && preg_match('/^\d{4}-\d{2}$/', $mes) === 1
            ? Carbon::createFromFormat('Y-m-d', $mes . '-01')
            : ($ultimaAnalise !== null ? Carbon::parse($ultimaAnalise) : now());

        return [
            'mes' => $base->format('Y-m'),
            'inicio' => $base->copy()->startOfMonth()->toDateString(),
            'fim' => $base->copy()->endOfMonth()->toDateString(),
            'label' => $base->format('m/Y'),
        ];
    }

    private function executarExportadorProdutoresAnalises(string $inputPath, string $outputPath): array
    {
        $script = env(
            'QUALIDADE_EXPORT_PRODUTORES_ANALISES_SCRIPT',
            base_path('../processor/modules/qualidade/produtores/excel/export_producer_analyses.py')
        );
        $logo = env('SANTILAC_LOGO_PATH', base_path('../processor/assets/logo.png'));
        $python = env('QUALIDADE_EXPORT_PYTHON', 'python3');
        $pythonCommand = preg_split('/\s+/', trim($python)) ?: ['python'];

        $process = new Process([
            ...$pythonCommand,
            $script,
            '--input',
            $inputPath,
            '--output',
            $outputPath,
            '--logo',
            $logo,
        ]);
        $process->setTimeout(120);
        $process->run();

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'success' => false,
                'errors' => [[
                    'code' => 'EXPORT_811',
                    'message' => 'Falha ao executar exportador.',
                    'details' => [
                        'stdout' => $process->getOutput(),
                        'stderr' => $process->getErrorOutput(),
                    ],
                ]],
            ];
        }

        return $decoded;
    }

    private function executarExportadorProdutoresAnalisesPdf(string $inputPath, string $outputPath): array
    {
        $script = env(
            'QUALIDADE_EXPORT_PRODUTORES_ANALISES_PDF_SCRIPT',
            base_path('../processor/modules/qualidade/produtores/pdf/export_producer_analyses_pdf.py')
        );
        $logo = env('SANTILAC_LOGO_PATH', base_path('../processor/assets/logo.png'));
        $python = env('QUALIDADE_EXPORT_PYTHON', 'python3');
        $pythonCommand = preg_split('/\s+/', trim($python)) ?: ['python'];

        $process = new Process([
            ...$pythonCommand,
            $script,
            '--input',
            $inputPath,
            '--output',
            $outputPath,
            '--logo',
            $logo,
        ]);
        $process->setTimeout(120);
        $process->run();

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'success' => false,
                'errors' => [[
                    'code' => 'EXPORT_821',
                    'message' => 'Falha ao executar exportador PDF.',
                    'details' => [
                        'stdout' => $process->getOutput(),
                        'stderr' => $process->getErrorOutput(),
                    ],
                ]],
            ];
        }

        return $decoded;
    }

    private function ultimasAnalisesPorProdutorNoPeriodo(array $codigos, string $inicio, string $fim): array
    {
        if ($codigos === [] || ! $this->analisesDisponiveis()) {
            return [];
        }

        return $this->analisesBase()
            ->whereIn('ra.produtor_codigo', $codigos)
            ->whereDate('ra.data', '>=', $inicio)
            ->whereDate('ra.data', '<=', $fim)
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

    private function avaliarIndicadores(array $analise): array
    {
        $pendencias = [];

        $this->adicionarPendenciaMinima($pendencias, $analise, 'gordura', 'Gordura baixa', 3.5, '%');
        $this->adicionarPendenciaMinima($pendencias, $analise, 'proteina', 'Proteína baixa', 3.2, '%');
        $this->adicionarPendenciaMinima($pendencias, $analise, 'lactose', 'Lactose baixa', 4.5, '%');
        $this->adicionarPendenciaMinima($pendencias, $analise, 'solidos_totais', 'Sólidos totais baixos', 12.2, '%');
        $this->adicionarPendenciaMaxima($pendencias, $analise, 'ccs', 'CCS acima do limite', 500, 'mil/mL', 100);
        $this->adicionarPendenciaMaxima($pendencias, $analise, 'ufc', 'UFC acima do limite', 300, 'mil/mL', 100);
        $this->adicionarPendenciaFaixa($pendencias, $analise, 'ureia', 'Ureia fora da faixa', 11, 15, 'mg/dL');
        $this->adicionarPendenciaFaixa($pendencias, $analise, 'temperatura', 'Temperatura fora da faixa', 2, 8, '°C');

        if ($this->valorPositivo($analise['antibiotico'] ?? null)) {
            $pendencias[] = $this->pendencia('antibiotico', 'Antibiótico positivo', 1, 'negativo', null, 1);
        }

        if ($this->valorPositivo($analise['bacteria'] ?? null)) {
            $pendencias[] = $this->pendencia('bacteria', 'Bactéria positiva', 1, 'negativo', null, 1);
        }

        return $pendencias;
    }

    private function adicionarPendenciaMinima(array &$pendencias, array $analise, string $campo, string $label, float $limite, string $unidade): void
    {
        $valor = $analise[$campo] ?? null;
        if ($valor === null || (float) $valor >= $limite) {
            return;
        }

        $pendencias[] = $this->pendencia($campo, $label, (float) $valor, 'mínimo ' . $limite, $unidade, $limite - (float) $valor);
    }

    private function adicionarPendenciaMaxima(array &$pendencias, array $analise, string $campo, string $label, float $limite, string $unidade, float $divisor = 1): void
    {
        $valor = $analise[$campo] ?? null;
        if ($valor === null) {
            return;
        }

        $normalizado = (float) $valor / $divisor;
        if ($normalizado <= $limite) {
            return;
        }

        $pendencias[] = $this->pendencia($campo, $label, $normalizado, 'máximo ' . $limite, $unidade, $normalizado - $limite);
    }

    private function adicionarPendenciaFaixa(array &$pendencias, array $analise, string $campo, string $label, float $minimo, float $maximo, string $unidade): void
    {
        $valor = $analise[$campo] ?? null;
        if ($valor === null) {
            return;
        }

        $valor = (float) $valor;
        if ($valor >= $minimo && $valor <= $maximo) {
            return;
        }

        $distancia = $valor < $minimo ? $minimo - $valor : $valor - $maximo;
        $pendencias[] = $this->pendencia($campo, $label, $valor, $minimo . ' a ' . $maximo, $unidade, $distancia);
    }

    private function pendencia(string $campo, string $label, ?float $valor, string $referencia, ?string $unidade, float $gravidade): array
    {
        return [
            'codigo' => $campo,
            'label' => $label,
            'valor' => $valor,
            'referencia' => $referencia,
            'unidade' => $unidade,
            'gravidade' => round($gravidade, 2),
        ];
    }

    private function agruparPendencias(array $produtores): array
    {
        $grupos = [];

        foreach ($produtores as $produtor) {
            foreach ($produtor['pendencias'] as $pendencia) {
                $codigo = $pendencia['codigo'];
                $grupos[$codigo] ??= [
                    'codigo' => $codigo,
                    'label' => $pendencia['label'],
                    'total' => 0,
                    'media' => null,
                    'pior' => null,
                    'items' => [],
                    'valores' => [],
                ];

                $item = [
                    'codigo' => $produtor['codigo'],
                    'nome' => $produtor['nome'],
                    'cidade' => $produtor['cidade'],
                    'rota' => $produtor['rota'],
                    'data' => $produtor['ultima_analise']['data'] ?? null,
                    'valor' => $pendencia['valor'],
                    'referencia' => $pendencia['referencia'],
                    'unidade' => $pendencia['unidade'],
                    'gravidade' => $pendencia['gravidade'],
                ];

                $grupos[$codigo]['total']++;
                $grupos[$codigo]['items'][] = $item;
                if ($pendencia['valor'] !== null) {
                    $grupos[$codigo]['valores'][] = (float) $pendencia['valor'];
                }
                if ($grupos[$codigo]['pior'] === null || $item['gravidade'] > $grupos[$codigo]['pior']['gravidade']) {
                    $grupos[$codigo]['pior'] = $item;
                }
            }
        }

        return collect($grupos)
            ->map(function (array $grupo): array {
                $valores = $grupo['valores'];
                unset($grupo['valores']);

                $grupo['media'] = $valores !== [] ? round(array_sum($valores) / count($valores), 2) : null;
                $grupo['items'] = collect($grupo['items'])
                    ->sortByDesc('gravidade')
                    ->take(30)
                    ->values()
                    ->all();

                return $grupo;
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    private function evolucaoMensal(): array
    {
        if (! $this->analisesDisponiveis()) {
            return [];
        }

        return DB::connection('raw')
            ->table(self::ANALISES_TABLE)
            ->selectRaw("DATE_FORMAT(data, '%Y-%m') as mes")
            ->selectRaw('COUNT(*) as total_analises')
            ->selectRaw('COUNT(DISTINCT produtor_codigo) as produtores')
            ->selectRaw('AVG(gordura) as media_gordura')
            ->selectRaw('AVG(proteina) as media_proteina')
            ->selectRaw('AVG(lactose) as media_lactose')
            ->selectRaw('AVG(ccs) as media_ccs')
            ->selectRaw('AVG(ufc) as media_ufc')
            ->groupBy('mes')
            ->orderByDesc('mes')
            ->limit(12)
            ->get()
            ->reverse()
            ->map(fn ($row): array => [
                'mes' => (string) $row->mes,
                'total_analises' => (int) $row->total_analises,
                'produtores' => (int) $row->produtores,
                'media_gordura' => $row->media_gordura !== null ? round((float) $row->media_gordura, 2) : null,
                'media_proteina' => $row->media_proteina !== null ? round((float) $row->media_proteina, 2) : null,
                'media_lactose' => $row->media_lactose !== null ? round((float) $row->media_lactose, 2) : null,
                'media_ccs' => $row->media_ccs !== null ? round((float) $row->media_ccs / 100, 2) : null,
                'media_ufc' => $row->media_ufc !== null ? round((float) $row->media_ufc / 100, 2) : null,
            ])
            ->values()
            ->all();
    }

    private function ultimaImportacao(): ?array
    {
        $historico = $this->historicoImportacoes(1);
        return $historico[0] ?? null;
    }

    private function historicoImportacoes(int $limit): array
    {
        if (! Schema::connection('raw')->hasTable(self::IMPORTACOES_TABLE)) {
            return [];
        }

        return DB::connection('raw')
            ->table(self::IMPORTACOES_TABLE)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($importacao): array => $this->formatarImportacao($importacao))
            ->values()
            ->all();
    }

    private function formatarImportacao($importacao): array
    {
        $errors = json_decode((string) ($importacao->processor_errors ?? '[]'), true);
        $errors = is_array($errors) ? $errors : [];
        $produtoresNaoEncontrados = collect($errors)
            ->map(fn ($error) => data_get($error, 'details.produtor_codigo'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'id' => (int) $importacao->id,
            'arquivo_nome_original' => (string) $importacao->arquivo_nome_original,
            'arquivo_hash' => (string) $importacao->arquivo_hash,
            'status' => (string) $importacao->status,
            'ja_importado' => (bool) $importacao->ja_importado,
            'total_linhas' => (int) $importacao->total_linhas,
            'linhas_validas' => (int) $importacao->linhas_validas,
            'linhas_com_erro' => (int) $importacao->linhas_com_erro,
            'registros_criados' => (int) $importacao->registros_criados,
            'registros_completados' => (int) $importacao->registros_completados,
            'registros_sem_mudanca' => (int) $importacao->registros_sem_mudanca,
            'erro_codigo' => $importacao->erro_codigo,
            'erro_mensagem' => $importacao->erro_mensagem,
            'produtores_nao_encontrados' => $produtoresNaoEncontrados,
            'processed_at' => $importacao->processed_at,
            'created_at' => $importacao->created_at,
        ];
    }

    private function valorPositivo($valor): bool
    {
        if ($valor === null) {
            return false;
        }

        if (is_numeric($valor)) {
            return (float) $valor > 0;
        }

        $normalizado = strtoupper(trim((string) $valor));
        return in_array($normalizado, ['1', 'SIM', 'S', 'POS', 'POSITIVO', 'POSITIVE'], true);
    }

    private function analisesBase()
    {
        return DB::connection('raw')
            ->table(self::ANALISES_TABLE . ' as ra')
            ->select([
                'ra.id',
                'ra.produtor_codigo',
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
            ]);
    }

    private function analisesDisponiveis(): bool
    {
        return Schema::connection('raw')->hasTable(self::ANALISES_TABLE);
    }

    private function formatarProdutor(ProdutorQualidade $produtor): array
    {
        return [
            'codigo' => (string) $produtor->codigo,
            'nome' => $this->limparTexto($produtor->nome),
            'cidade' => $this->limparTexto($produtor->cidade),
            'rota' => $this->limparTexto($produtor->rota),
            'cpf_cnpj' => $produtor->cpf_cnpj,
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

    private function limparTexto($valor): string
    {
        $texto = (string) $valor;

        return strtr($texto, [
            "\u{00C3}\u{0192}" => "\u{00C3}",
            "\u{00C3}\u{201A}" => "\u{00C2}",
            "\u{00C3}\u{00A1}" => 'á',
            "\u{00C3}\u{00A2}" => 'â',
            "\u{00C3}\u{00A3}" => 'ã',
            "\u{00C3}\u{00AA}" => 'ê',
            "\u{00C3}\u{00A9}" => 'é',
            "\u{00C3}\u{00AD}" => 'í',
            "\u{00C3}\u{00B3}" => 'ó',
            "\u{00C3}\u{00B4}" => 'ô',
            "\u{00C3}\u{00B5}" => 'õ',
            "\u{00C3}\u{00BA}" => 'ú',
            "\u{00C3}\u{2021}" => 'Ç',
            "\u{00C3}\u{00A7}" => 'ç',
            "\u{00C2}\u{00B0}" => '°',
            "\u{00C2}" => '',
        ]);
    }
}
