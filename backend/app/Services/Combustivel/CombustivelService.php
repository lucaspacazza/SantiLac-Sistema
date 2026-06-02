<?php

namespace App\Services\Combustivel;

use App\Models\Combustivel\CombustivelLog;
use App\Models\Combustivel\CombustivelMovimentacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CombustivelService
{
    private const CAPACIDADE_LITROS = 3000.0;

    public function resumo(): array
    {
        $estoqueAtual = round($this->estoqueAtual(), 3);

        return [
            'capacidade_litros' => self::CAPACIDADE_LITROS,
            'estoque_atual_litros' => $estoqueAtual,
            'porcentagem' => $this->porcentagem($estoqueAtual),
            'nivel_visual' => $this->nivelVisual($estoqueAtual),
            'ultima_entrada' => $this->formatarMovimentacao($this->ultimaMovimentacao('entrada')),
            'ultima_saida' => $this->formatarMovimentacao($this->ultimaMovimentacao('saida')),
        ];
    }

    public function registrarEntrada(array $payload, ?int $usuarioId = null): array
    {
        $usuarioId = $this->usuarioResponsavel($payload['usuario_id'] ?? $usuarioId);
        $quantidade = $this->quantidade($payload['quantidade_litros'] ?? null);
        $observacao = $this->textoOpcional($payload['observacao'] ?? null);

        $resultado = DB::transaction(function () use ($quantidade, $observacao, $usuarioId): array {
            $estoqueAntes = $this->estoqueAtual();
            $estoqueDepois = round($estoqueAntes + $quantidade, 3);

            if ($estoqueDepois > self::CAPACIDADE_LITROS) {
                $this->registrarLog(
                    CombustivelLogActions::TENTATIVA_ENTRADA_ACIMA_CAPACIDADE,
                    'Tentativa de entrada acima da capacidade do tanque.',
                    null,
                    $usuarioId,
                    [
                        'quantidade_litros' => $quantidade,
                        'estoque_antes' => round($estoqueAntes, 3),
                        'capacidade_litros' => self::CAPACIDADE_LITROS,
                    ]
                );

                return [
                    'error' => 'COMBUSTIVEL_CAPACIDADE_EXCEDIDA',
                    'message' => 'Entrada ultrapassa a capacidade de 3000 litros.',
                    'details' => [
                        'estoque_atual_litros' => round($estoqueAntes, 3),
                        'quantidade_litros' => $quantidade,
                        'capacidade_litros' => self::CAPACIDADE_LITROS,
                    ],
                ];
            }

            $this->atualizarEstoque($estoqueDepois, $usuarioId);

            $movimentacao = CombustivelMovimentacao::query()->create([
                'tipo' => 'entrada',
                'quantidade_litros' => $quantidade,
                'observacao' => $observacao,
                'usuario_id' => $usuarioId,
            ]);

            $this->registrarLog(
                CombustivelLogActions::ENTRADA_REGISTRADA,
                'Entrada de combustivel registrada.',
                (int) $movimentacao->id,
                $usuarioId,
                [
                    'estoque_antes' => round($estoqueAntes, 3),
                    'estoque_depois' => $estoqueDepois,
                ]
            );

            return ['movimentacao_id' => (int) $movimentacao->id];
        });

        $this->lancarErroSeNecessario($resultado);

        return $this->movimentacaoRegistrada((int) $resultado['movimentacao_id']);
    }

    public function registrarSaida(array $payload, ?int $usuarioId = null): array
    {
        $usuarioId = $this->usuarioResponsavel($payload['usuario_id'] ?? $usuarioId);
        $motoristaNome = $this->motoristaNome($payload['motorista_nome'] ?? $payload['motorista'] ?? null);
        $caminhao = $this->caminhao($payload['caminhao_id'] ?? $payload['caminhao'] ?? null);
        $quantidade = $this->quantidade($payload['quantidade_litros'] ?? null);
        $km = $this->kmOpcional($payload['km'] ?? null);
        $observacao = $this->textoOpcional($payload['observacao'] ?? null);

        $resultado = DB::transaction(function () use ($motoristaNome, $caminhao, $quantidade, $km, $observacao, $usuarioId): array {
            $estoqueAntes = $this->estoqueAtual();
            $estoqueDepois = round($estoqueAntes - $quantidade, 3);

            if ($estoqueDepois < 0) {
                $this->registrarLog(
                    CombustivelLogActions::TENTATIVA_SAIDA_SEM_ESTOQUE,
                    'Tentativa de saida maior que o estoque disponivel.',
                    null,
                    $usuarioId,
                    [
                        'motorista_nome' => $motoristaNome,
                        'caminhao_nome' => $caminhao['nome'],
                        'placa' => $caminhao['placa'],
                        'quantidade_litros' => $quantidade,
                        'estoque_antes' => round($estoqueAntes, 3),
                    ]
                );

                return [
                    'error' => 'COMBUSTIVEL_ESTOQUE_INSUFICIENTE',
                    'message' => 'Saida maior que o estoque atual.',
                    'details' => [
                        'estoque_atual_litros' => round($estoqueAntes, 3),
                        'quantidade_litros' => $quantidade,
                    ],
                ];
            }

            $this->atualizarEstoque($estoqueDepois, $usuarioId);

            $movimentacao = CombustivelMovimentacao::query()->create([
                'tipo' => 'saida',
                'quantidade_litros' => $quantidade,
                'motorista_nome' => $motoristaNome,
                'caminhao_nome' => $caminhao['nome'],
                'placa' => $caminhao['placa'],
                'km' => $km,
                'observacao' => $observacao,
                'usuario_id' => $usuarioId,
            ]);

            $this->registrarLog(
                CombustivelLogActions::SAIDA_REGISTRADA,
                'Saida de combustivel registrada.',
                (int) $movimentacao->id,
                $usuarioId,
                [
                    'motorista_nome' => $motoristaNome,
                    'caminhao_nome' => $caminhao['nome'],
                    'placa' => $caminhao['placa'],
                    'estoque_antes' => round($estoqueAntes, 3),
                    'estoque_depois' => $estoqueDepois,
                ]
            );

            return ['movimentacao_id' => (int) $movimentacao->id];
        });

        $this->lancarErroSeNecessario($resultado);

        return $this->movimentacaoRegistrada((int) $resultado['movimentacao_id']);
    }

    public function historico(Request $request): array
    {
        $perPage = $this->perPage($request);
        $query = $this->movimentacoesBase()->orderByDesc('m.created_at')->orderByDesc('m.id');

        if ($request->filled('tipo')) {
            $tipo = (string) $request->query('tipo');
            if (! in_array($tipo, ['entrada', 'saida'], true)) {
                throw new CombustivelException('COMBUSTIVEL_VALIDATION_ERROR', 'Tipo de movimentacao invalido.', ['field' => 'tipo']);
            }

            $query->where('m.tipo', $tipo);
        }

        if ($request->filled('data_inicial')) {
            $query->whereDate('m.created_at', '>=', (string) $request->query('data_inicial'));
        }

        if ($request->filled('data_final')) {
            $query->whereDate('m.created_at', '<=', (string) $request->query('data_final'));
        }

        if ($request->filled('motorista')) {
            $motorista = trim((string) $request->query('motorista'));
            $query->where('m.motorista_nome', 'like', "%{$motorista}%");
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())->map(fn ($row): array => $this->formatarMovimentacaoRow($row))->values()->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function logs(Request $request): array
    {
        $perPage = $this->perPage($request);
        $query = DB::table('combustivel_logs as l')
            ->leftJoin('usuarios as u', 'u.id', '=', 'l.usuario_id')
            ->select([
                'l.id',
                'l.acao',
                'l.descricao',
                'l.movimentacao_id',
                'l.usuario_id',
                'u.nome as usuario_nome',
                'l.metadata',
                'l.created_at',
            ])
            ->orderByDesc('l.created_at')
            ->orderByDesc('l.id');

        if ($request->filled('acao')) {
            $query->where('l.acao', (string) $request->query('acao'));
        }

        if ($request->filled('data_inicial')) {
            $query->whereDate('l.created_at', '>=', (string) $request->query('data_inicial'));
        }

        if ($request->filled('data_final')) {
            $query->whereDate('l.created_at', '<=', (string) $request->query('data_final'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())->map(fn ($row): array => $this->formatarLog($row))->values()->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function usuarios(Request $request): array
    {
        $perPage = $this->perPage($request);
        $query = DB::table('usuarios')
            ->select(['id', 'nome', 'email'])
            ->where('ativo', true)
            ->orderBy('nome');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($inner) use ($search): void {
                $inner->where('nome', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())->map(fn ($row): array => [
                'id' => (int) $row->id,
                'nome' => (string) $row->nome,
                'email' => (string) $row->email,
            ])->values()->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function motoristas(Request $request): array
    {
        $perPage = $this->perPage($request);
        $query = DB::table('motoristas')
            ->select(['id', 'nome'])
            ->where('ativo', true)
            ->orderBy('nome');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where('nome', 'like', "%{$search}%");
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($motorista): array => [
                    'id' => (int) $motorista->id,
                    'nome' => (string) $motorista->nome,
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

    public function caminhoes(Request $request): array
    {
        $perPage = $this->perPage($request);
        $query = DB::table('caminhoes')
            ->select(['id', 'identificacao', 'placa'])
            ->where('ativo', true)
            ->orderBy('identificacao');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($inner) use ($search): void {
                $inner->where('identificacao', 'like', "%{$search}%")
                    ->orWhere('placa', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($caminhao): array => [
                    'id' => (int) $caminhao->id,
                    'identificacao' => (string) $caminhao->identificacao,
                    'placa' => (string) $caminhao->placa,
                    'nome' => trim((string) $caminhao->identificacao . ' - ' . (string) $caminhao->placa),
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

    private function movimentacaoRegistrada(int $id): array
    {
        return [
            'movimentacao' => $this->formatarMovimentacaoRow($this->movimentacoesBase()->where('m.id', $id)->first()),
            'resumo' => $this->resumo(),
        ];
    }

    private function estoqueAtual(): float
    {
        $this->garantirEstoque();

        return (float) DB::table('combustivel_estoques')
            ->where('tanque', 'interno')
            ->value('estoque_atual_litros');
    }

    private function garantirEstoque(): void
    {
        if (DB::table('combustivel_estoques')->where('tanque', 'interno')->exists()) {
            return;
        }

        DB::table('combustivel_estoques')->insert([
            'tanque' => 'interno',
            'capacidade_litros' => self::CAPACIDADE_LITROS,
            'estoque_atual_litros' => 0,
            'created_at' => now('America/Sao_Paulo'),
            'updated_at' => now('America/Sao_Paulo'),
        ]);
    }

    private function atualizarEstoque(float $estoqueAtual, ?int $usuarioId): void
    {
        $this->garantirEstoque();

        DB::table('combustivel_estoques')
            ->where('tanque', 'interno')
            ->update([
                'estoque_atual_litros' => $estoqueAtual,
                'usuario_id' => $usuarioId,
                'updated_at' => now('America/Sao_Paulo'),
            ]);
    }

    private function ultimaMovimentacao(string $tipo): ?CombustivelMovimentacao
    {
        return CombustivelMovimentacao::query()
            ->where('tipo', $tipo)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    private function movimentacoesBase()
    {
        return DB::table('combustivel_movimentacoes as m')
            ->leftJoin('usuarios as u', 'u.id', '=', 'm.usuario_id')
            ->select([
                'm.id',
                'm.tipo',
                'm.quantidade_litros',
                'm.motorista_nome',
                'm.caminhao_nome',
                'm.placa',
                'm.km',
                'm.observacao',
                'm.usuario_id',
                'u.nome as usuario_nome',
                'm.created_at',
                'm.updated_at',
            ]);
    }

    private function registrarLog(string $acao, string $descricao, ?int $movimentacaoId, ?int $usuarioId, array $metadata = []): void
    {
        CombustivelLog::query()->create([
            'acao' => $acao,
            'descricao' => $descricao,
            'movimentacao_id' => $movimentacaoId,
            'usuario_id' => $usuarioId,
            'metadata' => $metadata === [] ? null : $metadata,
            'created_at' => now('America/Sao_Paulo'),
        ]);
    }

    private function usuarioResponsavel(mixed $value): int
    {
        $usuarioId = (int) $value;

        if ($usuarioId <= 0 || ! DB::table('usuarios')->where('id', $usuarioId)->where('ativo', true)->exists()) {
            throw new CombustivelException('COMBUSTIVEL_USUARIO_INVALIDO', 'Selecione um usuario responsavel valido.', ['field' => 'usuario_id']);
        }

        return $usuarioId;
    }

    private function quantidade(mixed $value): float
    {
        if (! is_numeric($value) || (float) $value <= 0) {
            throw new CombustivelException('COMBUSTIVEL_QUANTIDADE_INVALIDA', 'Quantidade em litros deve ser maior que zero.', ['field' => 'quantidade_litros']);
        }

        return round((float) $value, 3);
    }

    private function motoristaNome(mixed $value): string
    {
        $nome = trim((string) $value);

        if ($nome === '') {
            throw new CombustivelException('COMBUSTIVEL_MOTORISTA_OBRIGATORIO', 'Motorista e obrigatorio para saida.', ['field' => 'motorista_nome']);
        }

        return mb_substr($nome, 0, 160);
    }

    private function caminhao(mixed $value): array
    {
        $id = (int) $value;

        if ($id <= 0) {
            throw new CombustivelException('COMBUSTIVEL_CAMINHAO_OBRIGATORIO', 'Caminhao e obrigatorio para saida.', ['field' => 'caminhao_id']);
        }

        $caminhao = DB::table('caminhoes')
            ->select(['identificacao', 'placa'])
            ->where('id', $id)
            ->where('ativo', true)
            ->first();

        if ($caminhao === null) {
            throw new CombustivelException('COMBUSTIVEL_CAMINHAO_INVALIDO', 'Selecione um caminhao valido.', ['field' => 'caminhao_id']);
        }

        return [
            'nome' => mb_substr((string) $caminhao->identificacao, 0, 160),
            'placa' => mb_substr((string) $caminhao->placa, 0, 20),
        ];
    }

    private function kmOpcional(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return max(0, (int) $value);
    }

    private function textoOpcional(mixed $value): ?string
    {
        $texto = trim((string) $value);

        return $texto === '' ? null : $texto;
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 50), 1), 100);
    }

    private function porcentagem(float $estoqueAtual): float
    {
        return round(($estoqueAtual / self::CAPACIDADE_LITROS) * 100, 2);
    }

    private function nivelVisual(float $estoqueAtual): int
    {
        $percentual = $this->porcentagem($estoqueAtual);

        return match (true) {
            $percentual <= 0 => 0,
            $percentual <= 25 => 25,
            $percentual <= 50 => 50,
            $percentual <= 75 => 75,
            default => 100,
        };
    }

    private function lancarErroSeNecessario(array $resultado): void
    {
        if (isset($resultado['error'])) {
            throw new CombustivelException($resultado['error'], $resultado['message'], $resultado['details'] ?? []);
        }
    }

    private function formatarMovimentacao(?CombustivelMovimentacao $movimentacao): ?array
    {
        if ($movimentacao === null) {
            return null;
        }

        return [
            'id' => (int) $movimentacao->id,
            'tipo' => (string) $movimentacao->tipo,
            'quantidade_litros' => (float) $movimentacao->quantidade_litros,
            'motorista_nome' => $movimentacao->motorista_nome,
            'caminhao_nome' => $movimentacao->caminhao_nome,
            'placa' => $movimentacao->placa,
            'km' => $movimentacao->km !== null ? (int) $movimentacao->km : null,
            'observacao' => $movimentacao->observacao,
            'usuario_id' => $movimentacao->usuario_id !== null ? (int) $movimentacao->usuario_id : null,
            'usuario_responsavel' => null,
            'data_hora' => $movimentacao->created_at?->toDateTimeString(),
            'created_at' => $movimentacao->created_at?->toDateTimeString(),
            'updated_at' => $movimentacao->updated_at?->toDateTimeString(),
        ];
    }

    private function formatarMovimentacaoRow($row): ?array
    {
        if ($row === null) {
            return null;
        }

        return [
            'id' => (int) $row->id,
            'tipo' => (string) $row->tipo,
            'quantidade_litros' => (float) $row->quantidade_litros,
            'motorista_nome' => $row->motorista_nome,
            'caminhao_nome' => $row->caminhao_nome,
            'placa' => $row->placa,
            'km' => $row->km !== null ? (int) $row->km : null,
            'observacao' => $row->observacao,
            'usuario_id' => $row->usuario_id !== null ? (int) $row->usuario_id : null,
            'usuario_responsavel' => $row->usuario_id === null ? null : [
                'id' => (int) $row->usuario_id,
                'nome' => $row->usuario_nome,
            ],
            'data_hora' => (string) $row->created_at,
            'created_at' => (string) $row->created_at,
            'updated_at' => (string) $row->updated_at,
        ];
    }

    private function formatarLog($row): array
    {
        return [
            'id' => (int) $row->id,
            'acao' => (string) $row->acao,
            'descricao' => (string) $row->descricao,
            'movimentacao_id' => $row->movimentacao_id !== null ? (int) $row->movimentacao_id : null,
            'usuario_id' => $row->usuario_id !== null ? (int) $row->usuario_id : null,
            'usuario_responsavel' => $row->usuario_id === null ? null : [
                'id' => (int) $row->usuario_id,
                'nome' => $row->usuario_nome,
            ],
            'metadata' => is_string($row->metadata) ? json_decode($row->metadata, true) : $row->metadata,
            'created_at' => (string) $row->created_at,
        ];
    }
}
