<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\OrdemProducaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrdemProducaoController extends BaseProducaoController
{
    public function __construct(
        private readonly OrdemProducaoService $ordens
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->ordens->listar($request),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        return $this->responderItem(
            $this->ordens->buscar($id),
            'Ordem de producao nao encontrada.',
            $id
        );
    }

    public function catalogos(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->ordens->catalogos(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'data' => ['required', 'date'],
            'codigo_ordem' => ['nullable', 'string', 'max:32'],
            'campos' => ['required', 'array'],
            'campos.*.rotulo' => ['required', 'string', 'max:120'],
            'campos.*.valor' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->ordens->salvar($payload),
        ], 201);
    }

    public function gerarDaFormulacao(int $id): JsonResponse
    {
        return $this->responderItem(
            $this->ordens->gerarDaFormulacao($id),
            'Formulacao de queijo nao encontrada para gerar OP.',
            $id
        );
    }
}
