<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\SoroRefrigeradoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoroRefrigeradoController extends BaseProducaoController
{
    public function __construct(
        private readonly SoroRefrigeradoService $soro
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->soro->listar($request)]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->soro->criar($this->validar($request), $request->user()?->id),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        return $this->responderItem($this->soro->buscar($id), 'Registro de soro nao encontrado.', $id);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->soro->atualizar($id, $this->validar($request), $request->user()?->id),
            'Registro de soro nao encontrado.',
            $id
        );
    }

    public function finalizar(Request $request, int $id): JsonResponse
    {
        $item = $this->soro->finalizar($id);

        if ($item !== null) {
            $this->soro->controlarEstoque($id, $request->user()?->id);
            $item = $this->soro->buscar($id);
        }

        return $this->responderItem($item, 'Registro de soro nao encontrado.', $id);
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem($this->soro->cancelar($id), 'Registro de soro nao encontrado.', $id);
    }

    public function estoque(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->soro->estoqueResumo(),
        ]);
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'data_registro' => ['required', 'date'],
            'entrada_diaria_estoque' => ['nullable', 'numeric', 'min:0'],
            'estoque_total' => ['nullable', 'numeric', 'min:0'],
            'litragem_vendida' => ['nullable', 'numeric', 'min:0'],
            'sobra_estoque' => ['nullable', 'numeric', 'min:0'],
            'silo_armazenado' => ['nullable', 'string', 'max:80'],
            'responsavel' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);
    }
}
