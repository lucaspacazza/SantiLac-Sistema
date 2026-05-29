<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Services\LaboratorioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LaboratorioController extends Controller
{
    public function __construct(
        private readonly LaboratorioService $laboratorio
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->laboratorio->overview(),
        ]);
    }

    public function cronogramas(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->laboratorio->cronogramas($request),
        ]);
    }

    public function criarCronograma(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'documento_revisao' => ['nullable', 'string', 'max:30'],
            'ano' => ['required', 'integer', 'min:2020', 'max:2100'],
            'titulo' => ['nullable', 'string', 'max:160'],
            'status' => ['nullable', 'string', 'in:rascunho,ativo,encerrado,cancelado'],
            'observacoes' => ['nullable', 'string'],
            'itens' => ['nullable', 'array'],
            'itens.*.produto' => ['required_with:itens', 'string', 'max:140'],
            'itens.*.matriz' => ['required_with:itens', 'string', 'in:queijo,creme,soro,agua,outro'],
            'itens.*.mes' => ['required_with:itens', 'integer', 'min:1', 'max:12'],
            'itens.*.tipo_analise' => ['required_with:itens', 'string', 'in:fisico_quimica,microbiologica,fisico_quimica_microbiologica'],
            'itens.*.ate_dia' => ['nullable', 'integer', 'min:1', 'max:31'],
            'itens.*.laboratorio_destino' => ['nullable', 'string', 'max:140'],
            'itens.*.status' => ['nullable', 'string', 'in:prevista,coletada,enviada,laudo_recebido,cancelada'],
            'itens.*.observacoes' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->laboratorio->criarCronograma($payload, $request->user()?->id),
        ], 201);
    }

    public function cronograma(int $id): JsonResponse
    {
        $cronograma = $this->laboratorio->cronograma($id);

        if ($cronograma === null) {
            return response()->json($this->erro('LAB_404', 'Cronograma não encontrado.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $cronograma,
        ]);
    }

    public function aguaFilagem(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->laboratorio->aguaFilagem($request),
        ]);
    }

    public function criarAguaFilagem(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->laboratorio->criarAguaFilagem($this->validarAguaFilagem($request), $request->user()?->id),
        ], 201);
    }

    public function aguaFilagemItem(int $id): JsonResponse
    {
        return $this->responderItem($this->laboratorio->aguaFilagemItem($id), 'Água de filagem não encontrada.', $id);
    }

    public function atualizarAguaFilagem(Request $request, int $id): JsonResponse
    {
        $item = $this->laboratorio->atualizarAguaFilagem($id, $this->validarAguaFilagem($request), $request->user()?->id);

        if ($item === null) {
            return response()->json($this->erro('LAB_404', 'Água de filagem não encontrada.', ['id' => $id]), 404);
        }

        if ($item === false) {
            return response()->json($this->erro('LAB_409', 'Ficha finalizada não pode ser editada.', ['id' => $id]), 409);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    public function finalizarAguaFilagem(int $id): JsonResponse
    {
        return $this->responderItem($this->laboratorio->finalizarAguaFilagem($id), 'Água de filagem não encontrada.', $id);
    }

    private function validarAguaFilagem(Request $request): array
    {
        return $request->validate([
            'data_monitoramento' => ['required', 'date'],
            'sequencia' => ['nullable', 'integer', 'min:1', 'max:3'],
            'hora' => ['nullable', 'date_format:H:i'],
            'acidez' => ['nullable', 'numeric', 'min:0'],
            'gordura' => ['nullable', 'numeric', 'min:0'],
            'ph' => ['nullable', 'numeric', 'min:0', 'max:14'],
            'responsavel' => ['nullable', 'string', 'max:120'],
            'observacoes' => ['nullable', 'string'],
        ]);
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

    private function responderItem(?array $item, string $message, int $id): JsonResponse
    {
        if ($item === null) {
            return response()->json($this->erro('LAB_404', $message, ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }
}
