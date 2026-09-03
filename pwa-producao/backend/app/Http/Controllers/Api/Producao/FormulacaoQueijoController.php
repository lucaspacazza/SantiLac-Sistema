<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\FormulacaoQueijoService;
use App\Services\Producao\FormulacaoQueijoNumericInput;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class FormulacaoQueijoController extends BaseProducaoController
{
    public function __construct(
        private readonly FormulacaoQueijoService $formulacoes
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->formulacoes->listar($request),
        ]);
    }

    public function catalogos(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->formulacoes->catalogos(),
        ]);
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
        return $this->responderItem($this->formulacoes->buscar($id), 'Formulacao de queijo nao encontrada.', $id);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->formulacoes->atualizar($id, $this->validar($request), $request->user()?->id),
            'Formulacao de queijo nao encontrada.',
            $id
        );
    }

    public function finalizar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->finalizar($id), 'Formulacao de queijo nao encontrada.', $id);
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem($this->formulacoes->cancelar($id), 'Formulacao de queijo nao encontrada.', $id);
    }

    private function validar(Request $request): array
    {
        $payload = $request->all();
        $pointViolations = FormulacaoQueijoNumericInput::pointViolations($payload);

        if ($pointViolations !== []) {
            throw ValidationException::withMessages([
                'numeros' => 'Não use ponto nos campos: '.implode(', ', $pointViolations).'. Digite somente números e vírgula.',
            ]);
        }

        return Validator::make(FormulacaoQueijoNumericInput::normalize($payload), [
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
        ])->validate();
    }
}
