<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\ExportacaoFormularioService;
use App\Services\Producao\SoroRefrigeradoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoroRefrigeradoController extends BaseProducaoController
{
    public function __construct(
        private readonly SoroRefrigeradoService $soros,
        private readonly ExportacaoFormularioService $exportacao,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->soros->listar($request)]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->soros->criar($this->validar($request), $request->user()?->id)], 201);
    }

    public function show(int $id): JsonResponse
    {
        return $this->responderItem($this->soros->buscar($id), 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function estoque(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->soros->estoqueResumo()]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao($this->soros->atualizar($id, $this->validar($request), $request->user()?->id), 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function finalizar(int $id): JsonResponse
    {
        return $this->responderItem($this->soros->finalizar($id), 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem($this->soros->cancelar($id), 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function exportar(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('soro-refrigerado', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarPdf(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('soro-refrigerado', $id, 'pdf'), 'application/pdf');
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'data_registro' => ['required', 'date'],
            'entrada_diaria_estoque' => ['nullable', 'numeric', 'min:0'],
            'litragem_vendida' => ['nullable', 'numeric', 'min:0'],
            'silo_armazenado' => ['nullable', 'string', 'max:80'],
            'responsavel' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);
    }
}
