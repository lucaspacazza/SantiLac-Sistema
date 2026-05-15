<?php

namespace App\Http\Controllers\Api\Estoque;

use App\Http\Controllers\Controller;
use App\Services\EstoqueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class EstoqueController extends Controller
{
    public function __construct(
        private readonly EstoqueService $estoque
    ) {
    }

    public function overview(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->estoque->overview(),
        ]);
    }

    public function itens(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->estoque->itens($request),
        ]);
    }

    public function categorias(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->estoque->categorias(),
        ]);
    }

    public function criarItem(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'codigo' => ['nullable', 'string', 'max:60'],
            'nome' => ['required', 'string', 'max:180'],
            'categoria' => ['required', 'string', 'max:50'],
            'descricao' => ['nullable', 'string'],
            'unidade' => ['required', 'string', 'max:20'],
            'saldo_atual' => ['nullable', 'numeric', 'min:0'],
            'estoque_minimo' => ['nullable', 'numeric', 'min:0'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->estoque->criarItem($payload, $request->user()?->id),
        ], 201);
    }

    public function item(int $id): JsonResponse
    {
        $item = $this->estoque->item($id);

        if ($item === null) {
            return response()->json($this->erro('STOCK_810', 'Item de estoque não encontrado.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    public function atualizarItem(Request $request, int $id): JsonResponse
    {
        $payload = $request->validate([
            'codigo' => ['nullable', 'string', 'max:60'],
            'nome' => ['required', 'string', 'max:180'],
            'categoria' => ['required', 'string', 'max:50'],
            'descricao' => ['nullable', 'string'],
            'unidade' => ['required', 'string', 'max:20'],
            'estoque_minimo' => ['nullable', 'numeric', 'min:0'],
            'ativo' => ['nullable', 'boolean'],
        ]);

        $item = $this->estoque->atualizarItem($id, $payload);

        if ($item === null) {
            return response()->json($this->erro('STOCK_810', 'Item de estoque não encontrado.', ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    public function movimentos(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->estoque->movimentos($request),
        ]);
    }

    public function registrarMovimento(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'tipo' => ['required', 'string', 'in:entrada,saida,ajuste'],
            'item_id' => ['required', 'integer'],
            'quantidade' => ['required', 'numeric'],
            'data_movimento' => ['required', 'date'],
            'documento' => ['nullable', 'string', 'max:120'],
            'motivo' => ['nullable', 'string', 'max:160'],
            'observacao' => ['nullable', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->estoque->registrarMovimento($payload, $request->user()?->id),
            ], 201);
        } catch (ValidationException $exception) {
            $payload = $this->erroValidacaoEstoque($exception);

            return response()->json($payload, 422);
        }
    }

    private function erroValidacaoEstoque(ValidationException $exception): array
    {
        $raw = $exception->errors()['estoque'][0] ?? null;
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        if (is_array($decoded) && isset($decoded['code'], $decoded['message'])) {
            return $this->erro((string) $decoded['code'], (string) $decoded['message']);
        }

        return $this->erro('VALID_211', 'Valor em formato inválido.', $exception->errors());
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
}
