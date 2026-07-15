<?php

namespace App\Http\Controllers\Api\Producao;

use App\Services\Producao\OrdemProducaoExportacaoService;
use App\Services\Producao\OrdemProducaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrdemProducaoController extends BaseProducaoController
{
    public function __construct(
        private readonly OrdemProducaoService $ordens,
        private readonly OrdemProducaoExportacaoService $exportacao
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
            'Ordem de produção não encontrada.',
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
        ]);
    }

    public function finalizar(int $id): JsonResponse
    {
        return $this->responderItem(
            $this->ordens->finalizar($id),
            'Ordem de produção não encontrada.',
            $id
        );
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->responderItem(
            $this->ordens->cancelar($id),
            'Ordem de produção não encontrada.',
            $id
        );
    }

    public function gerarDaFormulacao(int $id): JsonResponse
    {
        return $this->responderItem(
            $this->ordens->gerarDaFormulacao($id),
            'Formulação de queijo não encontrada para gerar OP.',
            $id
        );
    }

    public function definirFormato(Request $request, int $id): JsonResponse
    {
        $payload = $request->validate([
            'formato' => ['required', 'string', 'in:f1,f4,f6'],
        ]);

        return $this->responderItem(
            $this->ordens->definirFormato($id, (string) $payload['formato']),
            'Ordem de produção não encontrada.',
            $id
        );
    }

    public function exportarDia(Request $request, string $formato)
    {
        return $this->downloadFormulario(
            $this->exportacao->exportarDia((string) $request->query('data', ''), $formato),
            $this->contentType($formato)
        );
    }

    public function exportar(int $id, string $formato)
    {
        return $this->downloadFormulario(
            $this->exportacao->exportarIndividual($id, $formato),
            $this->contentType($formato)
        );
    }

    private function contentType(string $formato): string
    {
        return $formato === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf';
    }
}
