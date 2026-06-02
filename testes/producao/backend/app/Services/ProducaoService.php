<?php

namespace App\Services;

use App\Models\ProducaoCreme;
use App\Models\ProducaoFormulacaoCreme;
use App\Models\ProducaoFormulacaoQueijo;
use App\Models\ProducaoSoroRefrigerado;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class ProducaoService
{
    public function overview(): array
    {
        return [
            'totais' => [
                'formulacoes_queijo' => ProducaoFormulacaoQueijo::query()->count(),
                'soro_refrigerado' => ProducaoSoroRefrigerado::query()->count(),
                'formulacoes_creme' => ProducaoFormulacaoCreme::query()->count(),
                'producoes_creme' => ProducaoCreme::query()->count(),
                'rascunhos' => ProducaoFormulacaoQueijo::query()->where('status', 'rascunho')->count()
                    + ProducaoSoroRefrigerado::query()->where('status', 'rascunho')->count()
                    + ProducaoFormulacaoCreme::query()->where('status', 'rascunho')->count()
                    + ProducaoCreme::query()->where('status', 'rascunho')->count(),
            ],
            'submodulos' => [
                [
                    'codigo' => 'formulacao-queijo',
                    'nome' => 'Formulação de Queijo',
                    'documento' => 'PLAN_6.3',
                    'descricao' => 'Ficha operacional ligada a lote, leite, insumos e responsável.',
                    'rota_preenchimento' => 'preenchimento-formulacao-queijo',
                    'rota_listagem' => 'listagem-formulacoes-queijo',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'soro-refrigerado',
                    'nome' => 'Soro Refrigerado',
                    'documento' => 'PLAN_6.7',
                    'descricao' => 'Controle de entrada, estoque, venda e silo de soro refrigerado.',
                    'rota_preenchimento' => 'preenchimento-soro-refrigerado',
                    'rota_listagem' => 'listagem-soro-refrigerado',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'formulacao-creme',
                    'nome' => 'Formulação de Creme',
                    'documento' => 'PLAN_6.9',
                    'descricao' => 'Controle de gordura inicial, gordura final e acidez do creme.',
                    'rota_preenchimento' => 'preenchimento-formulacao-creme',
                    'rota_listagem' => 'listagem-formulacoes-creme',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'producao-creme',
                    'nome' => 'Produção de Creme de Leite e Soro',
                    'documento' => 'PLAN_6.10',
                    'descricao' => 'Controle de lote, quantidade produzida e tipo de creme.',
                    'rota_preenchimento' => 'preenchimento-producao-creme',
                    'rota_listagem' => 'listagem-producoes-creme',
                    'status' => 'ativo',
                ],
            ],
        ];
    }

    public function formulacoesQueijo(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = ProducaoFormulacaoQueijo::query()->orderByDesc('data_formulacao')->orderByDesc('id');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('tipo_queijo', 'like', "%{$search}%")
                    ->orWhere('codigo_formulacao', 'like', "%{$search}%")
                    ->orWhere('lote_queijo', 'like', "%{$search}%")
                    ->orWhere('lote_leite', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (ProducaoFormulacaoQueijo $formulacao): array => $this->formatarFormulacaoQueijo($formulacao))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function criarFormulacaoQueijo(array $payload, ?int $usuarioId = null): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload, $usuarioId): int {
            $insumos = $payload['insumos'] ?? [];
            unset($payload['insumos']);
            $payload['tipo_queijo'] = (string) ($payload['tipo_queijo'] ?? '');
            $payload['lote_queijo'] = (string) ($payload['lote_queijo'] ?? '');

            $formulacao = ProducaoFormulacaoQueijo::query()->create([
                ...$payload,
                'responsavel_id' => $usuarioId,
                'documento_codigo' => 'PLAN_6.3',
                'documento_nome' => 'Controle de formulação do queijo',
                'status' => 'rascunho',
                'insumos_json' => array_values($insumos),
            ]);
            $formulacao->codigo_formulacao = $this->codigoFormulacaoQueijo($formulacao);
            $formulacao->save();

            return (int) $formulacao->id;
        });

        return $this->formulacaoQueijo($id);
    }

    public function atualizarFormulacaoQueijo(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        if ($formulacao->status !== 'rascunho') {
            return false;
        }

        DB::connection('raw')->transaction(function () use ($formulacao, $payload, $usuarioId): void {
            $insumos = $payload['insumos'] ?? [];
            unset($payload['insumos']);
            $payload['tipo_queijo'] = (string) ($payload['tipo_queijo'] ?? '');
            $payload['lote_queijo'] = (string) ($payload['lote_queijo'] ?? '');

            $formulacao->fill([
                ...$payload,
                'responsavel_id' => $usuarioId,
                'status' => 'rascunho',
                'insumos_json' => array_values($insumos),
            ]);
            $formulacao->save();
        });

        return $this->formulacaoQueijo($id);
    }

    public function finalizarFormulacaoQueijo(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        if ($formulacao->status === 'rascunho') {
            $formulacao->status = 'finalizada';
            $formulacao->save();
        }

        return $this->formulacaoQueijo($id);
    }

    public function cancelarFormulacaoQueijo(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        if ($formulacao->status === 'rascunho') {
            $formulacao->status = 'cancelada';
            $formulacao->save();
        }

        return $this->formulacaoQueijo($id);
    }

    public function formulacaoQueijo(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        return $this->formatarFormulacaoQueijo($formulacao);
    }

    public function formulacaoQueijoDia(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        $data = optional($formulacao->data_formulacao)->toDateString();
        $items = ProducaoFormulacaoQueijo::query()
            ->whereDate('data_formulacao', $data)
            ->orderByRaw('CAST(numero_queijomatic AS UNSIGNED) ASC')
            ->orderBy('id')
            ->get()
            ->map(fn (ProducaoFormulacaoQueijo $item): array => $this->formatarFormulacaoQueijo($item))
            ->values()
            ->all();

        return [
            'id' => (int) $formulacao->id,
            'documento_codigo' => 'PLAN_6.3',
            'data_formulacao' => $data,
            'items' => $items,
        ];
    }

    public function soroRefrigerado(Request $request): array
    {
        return $this->paginarFormulario($request, ProducaoSoroRefrigerado::class, ['silo_armazenado', 'responsavel'], 'data_registro', fn (ProducaoSoroRefrigerado $item): array => $this->formatarSoroRefrigerado($item));
    }

    public function criarSoroRefrigerado(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoSoroRefrigerado::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.7',
            'documento_nome' => 'Controle de Produção de Soro Refrigerado',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->soroRefrigeradoItem($id);
    }

    public function atualizarSoroRefrigerado(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoSoroRefrigerado::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->soroRefrigeradoItem($id));
    }

    public function finalizarSoroRefrigerado(int $id): ?array
    {
        $ficha = $this->finalizarFormulario(ProducaoSoroRefrigerado::class, $id, fn (int $id): ?array => $this->soroRefrigeradoItem($id));

        if ($ficha === null) {
            return null;
        }

        if (($ficha['status'] ?? null) === 'finalizada') {
            $this->controlarEstoqueSoroRefrigerado($id);
        }

        return $this->soroRefrigeradoItem($id);
    }

    public function cancelarSoroRefrigerado(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoSoroRefrigerado::class, $id, fn (int $id): ?array => $this->soroRefrigeradoItem($id));
    }

    public function soroRefrigeradoItem(int $id): ?array
    {
        $item = ProducaoSoroRefrigerado::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatarSoroRefrigerado($item);
    }

    public function estoqueSoroRefrigeradoResumo(): array
    {
        $estoque = DB::connection('raw')
            ->table('estoque')
            ->where('codigo', 'PROD-SORO-REFRIGERADO')
            ->first();

        if ($estoque === null) {
            return [
                'estoque' => null,
                'ultima_entrada' => null,
                'movimentos' => [],
            ];
        }

        $movimentos = DB::connection('raw')
            ->table('estoque_logs')
            ->where('estoque_id', (int) $estoque->id)
            ->orderByDesc('data_movimento')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn ($movimento): array => [
                'id' => (int) $movimento->id,
                'tipo' => (string) $movimento->tipo,
                'quantidade' => (float) $movimento->quantidade,
                'saldo_antes' => (float) $movimento->saldo_antes,
                'saldo_depois' => (float) $movimento->saldo_depois,
                'data_movimento' => (string) $movimento->data_movimento,
                'documento' => $movimento->documento,
                'motivo' => $movimento->motivo,
            ])
            ->all();

        $ultimaEntrada = DB::connection('raw')
            ->table('estoque_logs')
            ->where('estoque_id', (int) $estoque->id)
            ->where('tipo', 'entrada')
            ->orderByDesc('data_movimento')
            ->orderByDesc('id')
            ->first();

        return [
            'estoque' => [
                'id' => (int) $estoque->id,
                'nome' => (string) $estoque->nome,
                'unidade' => (string) $estoque->unidade,
                'saldo_atual' => (float) $estoque->saldo_atual,
            ],
            'ultima_entrada' => $ultimaEntrada === null ? null : [
                'quantidade' => (float) $ultimaEntrada->quantidade,
                'data_movimento' => (string) $ultimaEntrada->data_movimento,
                'saldo_depois' => (float) $ultimaEntrada->saldo_depois,
                'documento' => $ultimaEntrada->documento,
            ],
            'movimentos' => $movimentos,
        ];
    }

    public function controlarEstoqueSoroRefrigerado(int $id, ?int $usuarioId = null): ?array
    {
        $resultado = DB::connection('raw')->transaction(function () use ($id, $usuarioId): ?array {
            $soro = ProducaoSoroRefrigerado::query()->where('id', $id)->lockForUpdate()->first();

            if ($soro === null) {
                return null;
            }

            $documento = "PLAN_6.7:{$soro->id}";
            $estoque = $this->estoqueSoroRefrigerado();
            $movimentosExistentes = DB::connection('raw')
                ->table('estoque_logs')
                ->where('documento', $documento)
                ->orderBy('id')
                ->get();

            $movimentado = false;
            $movimentos = [];
            $saldoAposEntrada = (float) $estoque->saldo_atual;

            if ($movimentosExistentes->isEmpty()) {
                $entrada = (float) ($soro->entrada_diaria_estoque ?? 0);
                $saida = (float) ($soro->litragem_vendida ?? 0);

                if ($entrada > 0) {
                    $movimentos[] = $this->registrarMovimentoEstoqueSoro(
                        (int) $estoque->id,
                        'entrada',
                        $entrada,
                        optional($soro->data_registro)->toDateString(),
                        $documento,
                        'Produção de soro refrigerado',
                        $usuarioId
                    );
                    $ultimoMovimento = end($movimentos);
                    $saldoAposEntrada = (float) $ultimoMovimento['saldo_depois'];
                    $movimentado = true;
                }

                if ($saida > 0) {
                    $movimentos[] = $this->registrarMovimentoEstoqueSoro(
                        (int) $estoque->id,
                        'saida',
                        $saida,
                        optional($soro->data_registro)->toDateString(),
                        $documento,
                        'Venda de soro refrigerado',
                        $usuarioId
                    );
                    $movimentado = true;
                }
            } else {
                $movimentos = $movimentosExistentes
                    ->map(fn ($movimento): array => [
                        'tipo' => (string) $movimento->tipo,
                        'quantidade' => (float) $movimento->quantidade,
                        'saldo_antes' => (float) $movimento->saldo_antes,
                        'saldo_depois' => (float) $movimento->saldo_depois,
                    ])
                    ->all();

                $entradaRegistrada = $movimentosExistentes->firstWhere('tipo', 'entrada');
                if ($entradaRegistrada !== null) {
                    $saldoAposEntrada = (float) $entradaRegistrada->saldo_depois;
                }
            }

            $estoqueAtual = DB::connection('raw')->table('estoque')->where('id', (int) $estoque->id)->first();
            $soro->forceFill([
                'estoque_total' => $saldoAposEntrada,
                'sobra_estoque' => $estoqueAtual !== null ? (float) $estoqueAtual->saldo_atual : $saldoAposEntrada,
            ])->save();

            return [
                'estoque' => [
                    'id' => (int) $estoque->id,
                    'nome' => (string) $estoque->nome,
                    'unidade' => (string) $estoque->unidade,
                    'saldo_atual' => $estoqueAtual !== null ? (float) $estoqueAtual->saldo_atual : $saldoAposEntrada,
                ],
                'movimentado' => $movimentado,
                'movimentos' => $movimentos,
            ];
        });

        if ($resultado === null) {
            return null;
        }

        return [
            'ficha' => $this->soroRefrigeradoItem($id),
            ...$resultado,
        ];
    }

    public function formulacoesCreme(Request $request): array
    {
        return $this->paginarFormulario($request, ProducaoFormulacaoCreme::class, ['tipo_creme', 'lote_creme_produzido', 'responsavel'], 'data_fabricacao', fn (ProducaoFormulacaoCreme $item): array => $this->formatarFormulacaoCreme($item));
    }

    public function criarFormulacaoCreme(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoFormulacaoCreme::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.9',
            'documento_nome' => 'Controle de Formulação Creme',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->formulacaoCreme($id);
    }

    public function atualizarFormulacaoCreme(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoFormulacaoCreme::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->formulacaoCreme($id));
    }

    public function finalizarFormulacaoCreme(int $id): ?array
    {
        return $this->finalizarFormulario(ProducaoFormulacaoCreme::class, $id, fn (int $id): ?array => $this->formulacaoCreme($id));
    }

    public function cancelarFormulacaoCreme(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoFormulacaoCreme::class, $id, fn (int $id): ?array => $this->formulacaoCreme($id));
    }

    public function formulacaoCreme(int $id): ?array
    {
        $item = ProducaoFormulacaoCreme::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatarFormulacaoCreme($item);
    }

    public function producoesCreme(Request $request): array
    {
        return $this->paginarFormulario($request, ProducaoCreme::class, ['tipo_creme', 'lote_creme_produzido', 'responsavel'], 'data_fabricacao', fn (ProducaoCreme $item): array => $this->formatarProducaoCreme($item));
    }

    public function criarProducaoCreme(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoCreme::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.10',
            'documento_nome' => 'Controle de Produção Creme',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->producaoCreme($id);
    }

    public function atualizarProducaoCreme(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoCreme::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->producaoCreme($id));
    }

    public function finalizarProducaoCreme(int $id): ?array
    {
        return $this->finalizarFormulario(ProducaoCreme::class, $id, fn (int $id): ?array => $this->producaoCreme($id));
    }

    public function cancelarProducaoCreme(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoCreme::class, $id, fn (int $id): ?array => $this->producaoCreme($id));
    }

    public function producaoCreme(int $id): ?array
    {
        $item = ProducaoCreme::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatarProducaoCreme($item);
    }

    public function exportarFormulario(string $tipo, int $id, string $formato): ?array
    {
        $config = [
            'formulacao-queijo' => ['processor' => 'formulacao_queijo', 'finder' => fn (): ?array => $this->formulacaoQueijoDia($id)],
            'soro-refrigerado' => ['processor' => 'soro_refrigerado', 'finder' => fn (): ?array => $this->soroRefrigeradoItem($id)],
            'formulacao-creme' => ['processor' => 'formulacao_creme', 'finder' => fn (): ?array => $this->formulacaoCreme($id)],
            'producao-creme' => ['processor' => 'producao_creme', 'finder' => fn (): ?array => $this->producaoCreme($id)],
        ][$tipo] ?? null;

        if ($config === null || ! in_array($formato, ['docx', 'pdf'], true)) {
            return null;
        }

        $registro = $config['finder']();
        if ($registro === null) {
            return null;
        }

        $baseDir = storage_path('app/producao-exportacoes');
        if (! is_dir($baseDir)) {
            mkdir($baseDir, 0775, true);
        }

        $payloadPath = $baseDir.'/payload-'.$tipo.'-'.$id.'-'.uniqid().'.json';
        file_put_contents($payloadPath, json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $processor = $this->processorPath();
        $python = env('PYTHON_BINARY', PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3');

        $process = new Process([
            $python,
            $processor,
            '--tipo',
            $config['processor'],
            '--payload',
            $payloadPath,
            '--out-dir',
            $baseDir,
            '--format',
            $formato,
        ]);
        $process->setTimeout(120);
        $process->run();

        @unlink($payloadPath);

        $output = trim($process->getOutput());
        $decoded = $output !== '' ? json_decode($output, true) : null;

        if (! $process->isSuccessful() || ! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => array_filter([
                        $decoded['errors'][0] ?? null,
                        trim($process->getErrorOutput()) ?: null,
                    ]),
                ],
            ];
        }

        return [
            'processor' => $decoded,
            'arquivo' => $decoded['arquivo'],
            'caminho' => $decoded['caminho'],
            'formato' => $formato,
        ];
    }

    private function processorPath(): string
    {
        $candidates = [
            env('SANTILAC_PRODUCAO_PROCESSOR'),
            base_path('../processor/producao/producao_processor.py'),
            base_path('../processor/producao_processor.py'),
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '' && file_exists($candidate)) {
                return $candidate;
            }
        }

        return base_path('../processor/producao/producao_processor.py');
    }

    private function paginarFormulario(Request $request, string $modelClass, array $searchColumns, string $dateColumn, Closure $formatter): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = $modelClass::query()->orderByDesc($dateColumn)->orderByDesc('id');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($searchColumns, $search): void {
                foreach ($searchColumns as $index => $column) {
                    $index === 0
                        ? $query->where($column, 'like', "%{$search}%")
                        : $query->orWhere($column, 'like', "%{$search}%");
                }
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())->map($formatter)->values()->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    private function criarFormulario(string $modelClass, array $payload): int
    {
        return DB::connection('raw')->transaction(function () use ($modelClass, $payload): int {
            $registro = $modelClass::query()->create([
                ...$payload,
                'status' => 'rascunho',
            ]);

            return (int) $registro->id;
        });
    }

    private function atualizarFormulario(string $modelClass, int $id, array $payload, Closure $finder): array|bool|null
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status !== 'rascunho') {
            return false;
        }

        DB::connection('raw')->transaction(function () use ($registro, $payload): void {
            $registro->fill([
                ...$payload,
                'status' => 'rascunho',
            ]);
            $registro->save();
        });

        return $finder($id);
    }

    private function finalizarFormulario(string $modelClass, int $id, Closure $finder): ?array
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status === 'rascunho') {
            $registro->status = 'finalizada';
            $registro->save();
        }

        return $finder($id);
    }

    private function cancelarFormulario(string $modelClass, int $id, Closure $finder): ?array
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status === 'rascunho') {
            $registro->status = 'cancelada';
            $registro->save();
        }

        return $finder($id);
    }

    private function status(Model $registro): string
    {
        return (string) $registro->status;
    }

    private function formatarFormulacaoQueijo(ProducaoFormulacaoQueijo $formulacao): array
    {
        return [
            'id' => (int) $formulacao->id,
            'codigo_formulacao' => $formulacao->codigo_formulacao ?: $this->codigoFormulacaoQueijo($formulacao),
            'ordem_producao_id' => null,
            'documento_codigo' => (string) $formulacao->documento_codigo,
            'tipo_queijo' => (string) $formulacao->tipo_queijo,
            'data_formulacao' => optional($formulacao->data_formulacao)->toDateString(),
            'silo' => $formulacao->silo,
            'lote_leite' => $formulacao->lote_leite,
            'lote_queijo' => (string) $formulacao->lote_queijo,
            'numero_queijomatic' => $formulacao->numero_queijomatic,
            'inicio_enchimento' => $formulacao->inicio_enchimento,
            'quantidade_leite' => $formulacao->quantidade_leite !== null ? (float) $formulacao->quantidade_leite : null,
            'temperatura_pasteurizacao' => $formulacao->temperatura_pasteurizacao !== null ? (float) $formulacao->temperatura_pasteurizacao : null,
            'fosfatase' => $formulacao->fosfatase,
            'peroxidase' => $formulacao->peroxidase,
            'gordura_inicial' => $formulacao->gordura_inicial !== null ? (float) $formulacao->gordura_inicial : null,
            'gordura_final' => $formulacao->gordura_final !== null ? (float) $formulacao->gordura_final : null,
            'acidez' => $formulacao->acidez !== null ? (float) $formulacao->acidez : null,
            'temperatura_coagulacao' => $formulacao->temperatura_coagulacao !== null ? (float) $formulacao->temperatura_coagulacao : null,
            'hora_coagulacao' => $formulacao->hora_coagulacao,
            'hora_corte' => $formulacao->hora_corte,
            'temperatura_cozimento' => $formulacao->temperatura_cozimento !== null ? (float) $formulacao->temperatura_cozimento : null,
            'responsavel_id' => $formulacao->responsavel_id !== null ? (int) $formulacao->responsavel_id : null,
            'status' => $this->status($formulacao),
            'observacoes' => $formulacao->observacoes,
            'insumos' => collect($formulacao->insumos_json ?? [])
                ->map(fn (array $insumo, int $index): array => [
                    'id' => $index + 1,
                    'tipo_insumo' => (string) ($insumo['tipo_insumo'] ?? 'outro'),
                    'nome_insumo' => $insumo['nome_insumo'] ?? null,
                    'quantidade' => (float) ($insumo['quantidade'] ?? 0),
                    'unidade' => (string) ($insumo['unidade'] ?? ''),
                    'lote_insumo' => $insumo['lote_insumo'] ?? null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function codigoFormulacaoQueijo(ProducaoFormulacaoQueijo $formulacao): string
    {
        $data = optional($formulacao->data_formulacao)->format('Ymd') ?: now('America/Sao_Paulo')->format('Ymd');

        return sprintf('FQ-%s-%06d', $data, (int) $formulacao->id);
    }

    private function formatarSoroRefrigerado(ProducaoSoroRefrigerado $item): array
    {
        return [
            'id' => (int) $item->id,
            'documento_codigo' => (string) $item->documento_codigo,
            'data_registro' => optional($item->data_registro)->toDateString(),
            'entrada_diaria_estoque' => $item->entrada_diaria_estoque !== null ? (float) $item->entrada_diaria_estoque : null,
            'estoque_total' => $item->estoque_total !== null ? (float) $item->estoque_total : null,
            'litragem_vendida' => $item->litragem_vendida !== null ? (float) $item->litragem_vendida : null,
            'sobra_estoque' => $item->sobra_estoque !== null ? (float) $item->sobra_estoque : null,
            'silo_armazenado' => $item->silo_armazenado,
            'responsavel' => $item->responsavel,
            'status' => $this->status($item),
            'observacoes' => $item->observacoes,
        ];
    }

    private function estoqueSoroRefrigerado(): object
    {
        $estoque = DB::connection('raw')
            ->table('estoque')
            ->where('codigo', 'PROD-SORO-REFRIGERADO')
            ->lockForUpdate()
            ->first();

        if ($estoque !== null) {
            return $estoque;
        }

        $id = DB::connection('raw')->table('estoque')->insertGetId([
            'codigo' => 'PROD-SORO-REFRIGERADO',
            'nome' => 'Soro Refrigerado',
            'categoria' => 'produção',
            'descricao' => 'Controle automático pelo módulo de produção.',
            'unidade' => 'L',
            'saldo_atual' => 0,
            'estoque_minimo' => 0,
            'ativo' => 1,
        ]);

        return DB::connection('raw')
            ->table('estoque')
            ->where('id', $id)
            ->lockForUpdate()
            ->first();
    }

    private function registrarMovimentoEstoqueSoro(
        int $estoqueId,
        string $tipo,
        float $quantidade,
        ?string $dataMovimento,
        string $documento,
        string $motivo,
        ?int $usuarioId
    ): array {
        $item = DB::connection('raw')->table('estoque')->where('id', $estoqueId)->lockForUpdate()->first();

        if ($item === null) {
            throw ValidationException::withMessages(['estoque' => ['Item de estoque do soro refrigerado não encontrado.']]);
        }

        $saldoAntes = (float) $item->saldo_atual;
        $saldoDepois = $tipo === 'entrada'
            ? $saldoAntes + $quantidade
            : $saldoAntes - $quantidade;

        if ($saldoDepois < 0) {
            throw ValidationException::withMessages(['estoque' => ['Saldo insuficiente para movimentar o soro refrigerado.']]);
        }

        DB::connection('raw')->table('estoque')->where('id', $estoqueId)->update([
            'saldo_atual' => $saldoDepois,
        ]);

        DB::connection('raw')->table('estoque_logs')->insert([
            'estoque_id' => $estoqueId,
            'tipo' => $tipo,
            'quantidade' => $quantidade,
            'saldo_antes' => $saldoAntes,
            'saldo_depois' => $saldoDepois,
            'data_movimento' => $dataMovimento ?? now('America/Sao_Paulo')->toDateString(),
            'documento' => $documento,
            'motivo' => $motivo,
            'observacao' => 'Movimento automático gerado pela ficha de soro refrigerado.',
            'usuario_id' => $usuarioId,
        ]);

        return [
            'tipo' => $tipo,
            'quantidade' => $quantidade,
            'saldo_antes' => $saldoAntes,
            'saldo_depois' => $saldoDepois,
        ];
    }

    private function formatarFormulacaoCreme(ProducaoFormulacaoCreme $item): array
    {
        return [
            'id' => (int) $item->id,
            'documento_codigo' => (string) $item->documento_codigo,
            'responsavel_monitoramento' => $item->responsavel_monitoramento,
            'mes' => $item->mes !== null ? (int) $item->mes : null,
            'ano' => $item->ano !== null ? (int) $item->ano : null,
            'tipo_creme' => $item->tipo_creme,
            'data_fabricacao' => optional($item->data_fabricacao)->toDateString(),
            'lote_creme_produzido' => (string) $item->lote_creme_produzido,
            'gordura_inicial' => $item->gordura_inicial !== null ? (float) $item->gordura_inicial : null,
            'gordura_final' => $item->gordura_final !== null ? (float) $item->gordura_final : null,
            'acidez' => $item->acidez !== null ? (float) $item->acidez : null,
            'responsavel' => $item->responsavel,
            'status' => $this->status($item),
            'observacoes' => $item->observacoes,
        ];
    }

    private function formatarProducaoCreme(ProducaoCreme $item): array
    {
        return [
            'id' => (int) $item->id,
            'documento_codigo' => (string) $item->documento_codigo,
            'responsavel_monitoramento' => $item->responsavel_monitoramento,
            'mes' => $item->mes !== null ? (int) $item->mes : null,
            'ano' => $item->ano !== null ? (int) $item->ano : null,
            'tipo_creme' => $item->tipo_creme,
            'data_fabricacao' => optional($item->data_fabricacao)->toDateString(),
            'lote_creme_produzido' => (string) $item->lote_creme_produzido,
            'quantidade_produzida_kg' => $item->quantidade_produzida_kg !== null ? (float) $item->quantidade_produzida_kg : null,
            'responsavel' => $item->responsavel,
            'status' => $this->status($item),
            'observacoes' => $item->observacoes,
        ];
    }

}
