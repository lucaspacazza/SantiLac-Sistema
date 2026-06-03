<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\ExportacaoFormularioService;
use App\Services\Producao\FormulacaoCremeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormulacaoCremeController extends BaseProducaoController
{
    public function __construct(
        private readonly FormulacaoCremeService $formulacoes,
        private readonly ExportacaoFormularioService $exportacao,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->formulacoes->listar($request)]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->formulacoes->criar($this->validar($request), $request->user()?->id)], 201);
    }

    public function show(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->buscar($id), 'Formulação de creme não encontrada.', $id);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao($this->formulacoes->atualizar($id, $this->validar($request), $request->user()?->id), 'Formulação de creme não encontrada.', $id);
    }

    public function finalizar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->finalizar($id), 'Formulação de creme não encontrada.', $id);
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->cancelar($id), 'Formulação de creme não encontrada.', $id);
    }

    public function exportar(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('formulacao-creme', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarPdf(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('formulacao-creme', $id, 'pdf'), 'application/pdf');
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'responsavel_monitoramento' => ['nullable', 'string', 'max:120'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'ano' => ['nullable', 'integer', 'min:2020', 'max:2100'],
            'tipo_creme' => ['nullable', 'string', 'max:120'],
            'data_fabricacao' => ['required', 'date'],
            'lote_creme_produzido' => ['required', 'string', 'max:80'],
            'gordura_inicial' => ['nullable', 'numeric', 'min:0'],
            'gordura_final' => ['nullable', 'numeric', 'min:0'],
            'acidez' => ['nullable', 'numeric', 'min:0'],
            'responsavel' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);
    }
}
