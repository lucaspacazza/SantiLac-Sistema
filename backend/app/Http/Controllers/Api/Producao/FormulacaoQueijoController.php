<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\ExportacaoFormularioService;
use App\Services\Producao\FormulacaoQueijoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormulacaoQueijoController extends BaseProducaoController
{
    public function __construct(
        private readonly FormulacaoQueijoService $formulacoes,
        private readonly ExportacaoFormularioService $exportacao,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->formulacoes->listar($request)]);
    }

    public function catalogos(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->formulacoes->catalogos()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->formulacoes->criar($this->validar($request), $request->user()?->id),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->buscar($id), 'Formulação de queijo não encontrada.', $id);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->formulacoes->atualizar($id, $this->validar($request), $request->user()?->id),
            'Formulação de queijo não encontrada.',
            $id
        );
    }

    public function finalizar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->finalizar($id), 'Formulação de queijo não encontrada.', $id);
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->cancelar($id), 'Formulação de queijo não encontrada.', $id);
    }

    public function exportar(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('formulacao-queijo', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarPdf(int $id)
    {
        return $this->downloadFormulario($this->exportacao->exportar('formulacao-queijo', $id, 'pdf'), 'application/pdf');
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'ordem_producao_id' => ['nullable', 'integer'],
            'tipo_queijo' => ['nullable', 'string', 'max:120'],
            'data_formulacao' => ['required', 'date'],
            'silo' => ['nullable', 'string', 'max:60'],
            'lote_leite' => ['nullable', 'string', 'max:80'],
            'lote_queijo' => ['nullable', 'string', 'max:80'],
            'numero_queijomatic' => ['nullable', 'string', 'max:60'],
            'inicio_enchimento' => ['nullable', 'date_format:H:i'],
            'quantidade_leite' => ['nullable', 'numeric', 'min:0'],
            'temperatura_pasteurizacao' => ['nullable', 'numeric'],
            'fosfatase' => ['nullable', 'string', 'in:negativo,positivo,nao_aplicavel'],
            'peroxidase' => ['nullable', 'string', 'in:negativo,positivo,nao_aplicavel'],
            'gordura_inicial' => ['nullable', 'numeric'],
            'gordura_final' => ['nullable', 'numeric'],
            'acidez' => ['nullable', 'numeric'],
            'temperatura_coagulacao' => ['nullable', 'numeric'],
            'hora_coagulacao' => ['nullable', 'date_format:H:i'],
            'hora_corte' => ['nullable', 'date_format:H:i'],
            'temperatura_cozimento' => ['nullable', 'numeric'],
            'observacoes' => ['nullable', 'string'],
            'insumos' => ['nullable', 'array'],
            'insumos.*.tipo_insumo' => ['required_with:insumos', 'string', 'in:fermento_mvd,fermento_fast,fermento,cloreto,corante,coalho,outro'],
            'insumos.*.nome_insumo' => ['nullable', 'string', 'max:120'],
            'insumos.*.quantidade' => ['required_with:insumos', 'numeric', 'min:0'],
            'insumos.*.unidade' => ['required_with:insumos', 'string', 'max:20'],
            'insumos.*.lote_insumo' => ['nullable', 'string', 'max:80'],
        ]);
    }
}