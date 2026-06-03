<?php

namespace App\Services\Producao;

use App\Models\ProducaoSoroRefrigerado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SoroRefrigeradoService extends BaseFormularioService
{
    public function listar(Request $request): array
    {
        return $this->paginarFormulario($request, ProducaoSoroRefrigerado::class, ['silo_armazenado', 'responsavel'], 'data_registro', fn (ProducaoSoroRefrigerado $item): array => $this->formatar($item));
    }

    public function criar(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoSoroRefrigerado::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.7',
            'documento_nome' => 'Controle de Produção de Soro Refrigerado',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->buscar($id);
    }

    public function atualizar(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoSoroRefrigerado::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->buscar($id));
    }

    public function finalizar(int $id): ?array
    {
        $ficha = $this->finalizarFormulario(ProducaoSoroRefrigerado::class, $id, fn (int $id): ?array => $this->buscar($id));

        if ($ficha === null) {
            return null;
        }

        if (($ficha['status'] ?? null) === 'finalizada') {
            $this->controlarEstoque($id);
        }

        return $this->buscar($id);
    }

    public function cancelar(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoSoroRefrigerado::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function buscar(int $id): ?array
    {
        $item = ProducaoSoroRefrigerado::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatar($item);
    }

    public function estoqueResumo(): array
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

    public function controlarEstoque(int $id, ?int $usuarioId = null): ?array
    {
        $resultado = DB::connection('raw')->transaction(function () use ($id, $usuarioId): ?array {
            $soro = ProducaoSoroRefrigerado::query()->where('id', $id)->lockForUpdate()->first();

            if ($soro === null) {
                return null;
            }

            $documento = "PLAN_6.7:{$soro->id}";
            $estoque = $this->estoqueSoro();
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
                    $movimentos[] = $this->registrarMovimento(
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
                    $movimentos[] = $this->registrarMovimento(
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
            'ficha' => $this->buscar($id),
            ...$resultado,
        ];
    }

    public function formatar(ProducaoSoroRefrigerado $item): array
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

    private function estoqueSoro(): object
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

    private function registrarMovimento(
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
        $saldoDepois = $tipo === 'entrada' ? $saldoAntes + $quantidade : $saldoAntes - $quantidade;

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
}
