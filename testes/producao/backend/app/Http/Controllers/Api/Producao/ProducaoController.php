<?php

namespace App\Http\Controllers\Api\Producao;

use App\Http\Controllers\Controller;
use App\Services\ProducaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProducaoController extends Controller
{
    public function __construct(
        private readonly ProducaoService $producao
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->overview(),
        ]);
    }

    public function formulacoesQueijo(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->formulacoesQueijo($request),
        ]);
    }

    public function soroRefrigerado(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->soroRefrigerado($request),
        ]);
    }

    public function criarSoroRefrigerado(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->criarSoroRefrigerado($this->validarSoroRefrigerado($request), $request->user()?->id),
        ], 201);
    }

    public function soroRefrigeradoItem(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->soroRefrigeradoItem($id), 'PROD_404', 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function atualizarSoroRefrigerado(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->producao->atualizarSoroRefrigerado($id, $this->validarSoroRefrigerado($request), $request->user()?->id),
            'Controle de soro refrigerado não encontrado.',
            $id
        );
    }

    public function finalizarSoroRefrigerado(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->finalizarSoroRefrigerado($id), 'PROD_404', 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function controlarEstoqueSoroRefrigerado(Request $request, int $id): JsonResponse
    {
        return $this->responderItem($this->producao->controlarEstoqueSoroRefrigerado($id, $request->user()?->id), 'PROD_404', 'Controle de soro refrigerado não encontrado.', $id);
    }

    public function formulacoesCreme(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->formulacoesCreme($request),
        ]);
    }

    public function criarFormulacaoCreme(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->criarFormulacaoCreme($this->validarFormulacaoCreme($request), $request->user()?->id),
        ], 201);
    }

    public function formulacaoCreme(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->formulacaoCreme($id), 'PROD_404', 'Formulação de creme não encontrada.', $id);
    }

    public function atualizarFormulacaoCreme(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->producao->atualizarFormulacaoCreme($id, $this->validarFormulacaoCreme($request), $request->user()?->id),
            'Formulação de creme não encontrada.',
            $id
        );
    }

    public function finalizarFormulacaoCreme(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->finalizarFormulacaoCreme($id), 'PROD_404', 'Formulação de creme não encontrada.', $id);
    }

    public function producoesCreme(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->producoesCreme($request),
        ]);
    }

    public function criarProducaoCreme(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->producao->criarProducaoCreme($this->validarProducaoCreme($request), $request->user()?->id),
        ], 201);
    }

    public function producaoCreme(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->producaoCreme($id), 'PROD_404', 'Produção de creme não encontrada.', $id);
    }

    public function atualizarProducaoCreme(Request $request, int $id): JsonResponse
    {
        return $this->responderAtualizacao(
            $this->producao->atualizarProducaoCreme($id, $this->validarProducaoCreme($request), $request->user()?->id),
            'Produção de creme não encontrada.',
            $id
        );
    }

    public function finalizarProducaoCreme(int $id): JsonResponse
    {
        return $this->responderItem($this->producao->finalizarProducaoCreme($id), 'PROD_404', 'Produção de creme não encontrada.', $id);
    }

    public function criarFormulacaoQueijo(Request $request): JsonResponse
    {
        $payload = $this->validarFormulacaoQueijo($request);

        return response()->json([
            'success' => true,
            'data' => $this->producao->criarFormulacaoQueijo($payload, $request->user()?->id),
        ], 201);
    }

    public function atualizarFormulacaoQueijo(Request $request, int $id): JsonResponse
    {
        $payload = $this->validarFormulacaoQueijo($request);
        $formulacao = $this->producao->atualizarFormulacaoQueijo($id, $payload, $request->user()?->id);

        if ($formulacao === null) {
            return response()->json($this->erro('PROD_404', 'Formulação de queijo não encontrada.', ['id' => $id]), 404);
        }

        if ($formulacao === false) {
            return response()->json($this->erro('PROD_409', 'Ficha finalizada não pode ser editada.', ['id' => $id]), 409);
        }

        return response()->json([
            'success' => true,
            'data' => $formulacao,
        ]);
    }

    private function validarFormulacaoQueijo(Request $request): array
    {
        return $request->validate([
            'ordem_producao_id' => ['nullable', 'integer'],
            'tipo_queijo' => ['required', 'string', 'max:120'],
            'data_formulacao' => ['required', 'date'],
            'silo' => ['nullable', 'string', 'max:60'],
            'lote_leite' => ['nullable', 'string', 'max:80'],
            'lote_queijo' => ['required', 'string', 'max:80'],
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

    private function validarSoroRefrigerado(Request $request): array
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

    private function validarFormulacaoCreme(Request $request): array
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

    private function validarProducaoCreme(Request $request): array
    {
        return $request->validate([
            'responsavel_monitoramento' => ['nullable', 'string', 'max:120'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'ano' => ['nullable', 'integer', 'min:2020', 'max:2100'],
            'tipo_creme' => ['nullable', 'string', 'max:120'],
            'data_fabricacao' => ['required', 'date'],
            'lote_creme_produzido' => ['required', 'string', 'max:80'],
            'quantidade_produzida_kg' => ['nullable', 'numeric', 'min:0'],
            'responsavel' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);
    }

    public function finalizarFormulacaoQueijo(int $id): JsonResponse
    {
        $formulacao = $this->producao->finalizarFormulacaoQueijo($id);

        if ($formulacao === null) {
            return response()->json($this->erro('PROD_404', 'Formulação de queijo não encontrada.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $formulacao,
        ]);
    }

    public function formulacaoQueijo(int $id): JsonResponse
    {
        $formulacao = $this->producao->formulacaoQueijo($id);

        if ($formulacao === null) {
            return response()->json($this->erro('PROD_404', 'Formulação de queijo não encontrada.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $formulacao,
        ]);
    }

    public function exportarFormulacaoQueijo(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('formulacao-queijo', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarFormulacaoQueijoPdf(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('formulacao-queijo', $id, 'pdf'), 'application/pdf');
    }

    public function exportarSoroRefrigerado(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('soro-refrigerado', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarSoroRefrigeradoPdf(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('soro-refrigerado', $id, 'pdf'), 'application/pdf');
    }

    public function exportarFormulacaoCreme(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('formulacao-creme', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarFormulacaoCremePdf(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('formulacao-creme', $id, 'pdf'), 'application/pdf');
    }

    public function exportarProducaoCreme(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('producao-creme', $id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function exportarProducaoCremePdf(int $id)
    {
        return $this->downloadFormulario($this->producao->exportarFormulario('producao-creme', $id, 'pdf'), 'application/pdf');
    }

    private function erro(string $code, string $message, array $details = []): array
    {
        return [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
        ];
    }

    private function responderItem(?array $item, string $code, string $message, int $id): JsonResponse
    {
        if ($item === null) {
            return response()->json($this->erro($code, $message, ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    private function responderAtualizacao(array|bool|null $item, string $notFoundMessage, int $id): JsonResponse
    {
        if ($item === null) {
            return response()->json($this->erro('PROD_404', $notFoundMessage, ['id' => $id]), 404);
        }

        if ($item === false) {
            return response()->json($this->erro('PROD_409', 'Ficha finalizada não pode ser editada.', ['id' => $id]), 409);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    private function downloadFormulario(?array $data, string $contentType)
    {
        if ($data === null) {
            return response()->json($this->erro('PROD_404', 'Ficha não encontrada.'), 404);
        }

        if (! (bool) data_get($data, 'processor.success', false)) {
            return response()->json($this->erro('EXPORT_500', 'Falha ao gerar documento.', data_get($data, 'processor.errors', [])), 500);
        }

        return response()->download(
            $data['caminho'],
            $data['arquivo'],
            ['Content-Type' => $contentType]
        )->deleteFileAfterSend(true);
    }
}
