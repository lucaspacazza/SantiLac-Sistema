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
            return response()->json($this->erro('PROD_409', 'Ficha finalizada nao pode ser editada.', ['id' => $id]), 409);
        }

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    protected function downloadFormulario(?array $data, string $contentType)
    {
        if ($data === null) {
            return response()->json($this->erro('PROD_404', 'Ficha nao encontrada.'), 404);
        }

        if (! (bool) data_get($data, 'processor.success', false)) {
            $errors = data_get($data, 'processor.errors', []);

            return response()->json(
                $this->erro('EXPORT_500', $this->mensagemErroExportacao($errors), is_array($errors) ? $errors : []),
                500
            );
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

    private function mensagemErroExportacao(mixed $errors): string
    {
        if (! is_array($errors) || $errors === []) {
            return 'Falha ao gerar documento.';
        }

        $first = $errors[0] ?? null;

        if (is_string($first) && trim($first) !== '') {
            return trim($first);
        }

        if (is_array($first)) {
            $message = trim((string) ($first['message'] ?? ''));
            if ($message !== '') {
                return $message;
            }
        }

        return 'Falha ao gerar documento.';
    }
}
