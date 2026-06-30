<?php

namespace App\Http\Controllers\Api\Producao;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

abstract class BaseProducaoController extends Controller
{
    protected function responderItem(?array $item, string $mensagem, int $id): JsonResponse
    {
        if ($item === null) {
            return response()->json([
                'success' => false,
                'error' => [
                    'message' => $mensagem,
                    'id' => $id,
                ],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    protected function responderAtualizacao(array|bool|null $item, string $mensagem, int $id): JsonResponse
    {
        if ($item === false) {
            return response()->json([
                'success' => false,
                'error' => [
                    'message' => 'Registro finalizado nao pode ser alterado.',
                    'id' => $id,
                ],
            ], 409);
        }

        return $this->responderItem($item, $mensagem, $id);
    }
}
