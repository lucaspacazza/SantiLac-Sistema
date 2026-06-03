<?php

namespace App\Http\Controllers\Api\Producao;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

abstract class BaseProducaoController extends Controller
{
    protected function responderItem(?array $item, string $message, int $id): JsonResponse
    {
        if ($item === null) {
            return response()->json($this->erro('PROD_404', $message, ['id' => $id]), 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    protected function responderAtualizacao(array|bool|null $item, string $notFoundMessage, int $id): JsonResponse
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

    protected function downloadFormulario(?array $data, string $contentType)
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

    protected function erro(string $code, string $message, array $details = []): array
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
