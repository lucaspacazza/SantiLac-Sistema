<?php

namespace App\Services\Producao;

use App\Models\ProducaoFormulacaoCreme;
use Illuminate\Http\Request;

class FormulacaoCremeService extends BaseFormularioService
{
    public function listar(Request $request): array
    {
        return $this->paginarFormulario(
            $request,
            ProducaoFormulacaoCreme::class,
            ['tipo_creme', 'lote_creme_produzido', 'responsavel'],
            'data_fabricacao',
            fn (ProducaoFormulacaoCreme $item): array => $this->formatar($item),
        );
    }

    public function criar(array $payload, ?int $usuarioId = null): array
    {
        $id = $this->criarFormulario(ProducaoFormulacaoCreme::class, [
            ...$payload,
            'documento_codigo' => 'PLAN_6.9',
            'documento_nome' => 'Controle de Formulação Creme',
            'responsavel_id' => $usuarioId,
        ]);

        return $this->buscar($id);
    }

    public function atualizar(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        return $this->atualizarFormulario(ProducaoFormulacaoCreme::class, $id, [
            ...$payload,
            'responsavel_id' => $usuarioId,
        ], fn (int $id): ?array => $this->buscar($id));
    }

    public function finalizar(int $id): ?array
    {
        return $this->finalizarFormulario(ProducaoFormulacaoCreme::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function cancelar(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoFormulacaoCreme::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function buscar(int $id): ?array
    {
        $item = ProducaoFormulacaoCreme::query()->where('id', $id)->first();

        return $item === null ? null : $this->formatar($item);
    }

    private function formatar(ProducaoFormulacaoCreme $item): array
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
}
