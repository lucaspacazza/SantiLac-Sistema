<?php

namespace App\Services\Producao;

use App\Models\ProducaoCreme;
use Illuminate\Http\Request;

class ProducaoCremeService extends BaseFormularioService
{
    public function listar(Request $request): array
    {
        return $this->paginarFormulario(
            $request,
            ProducaoCreme::class,
            ['tipo_creme', 'lote_creme_produzido', 'responsavel'],
            'data_fabricacao',
            fn (ProducaoCreme $item): array => $this->formatar($item),
        );
    }

    public function criar(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoCreme::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.10',
            'documento_nome' => 'Controle de Produção Creme',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->buscar($id);
    }

    public function atualizar(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoCreme::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->buscar($id));
    }

    public function finalizar(int $id): ?array
    {
        return $this->finalizarFormulario(ProducaoCreme::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function cancelar(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoCreme::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function buscar(int $id): ?array
    {
        $item = ProducaoCreme::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatar($item);
    }

    private function formatar(ProducaoCreme $item): array
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
