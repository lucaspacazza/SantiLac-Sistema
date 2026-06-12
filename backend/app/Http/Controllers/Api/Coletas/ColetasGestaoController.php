<?php

namespace App\Http\Controllers\Api\Coletas;

use App\Http\Controllers\Controller;
use App\Services\Coletas\ColetasGestaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ColetasGestaoController extends Controller
{
    public function __construct(
        private readonly ColetasGestaoService $coletas
    ) {
    }

    public function rotas(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => ['rotas' => $this->coletas->rotas($request)],
        ]);
    }

    public function rotaDetalhe(Request $request): JsonResponse
    {
        $uuid = trim((string) $request->query('uuid'));
        $detalhe = $this->coletas->rotaDetalhe($uuid);

        if ($detalhe === null) {
            return response()->json($this->erro('COLETAS_404', 'Rota não encontrada.'), 404);
        }

        return response()->json(['success' => true, 'data' => $detalhe]);
    }

    public function rotaColetas(Request $request): JsonResponse
    {
        $uuid = trim((string) $request->query('uuid'));
        $detalhe = $this->coletas->rotaColetas($uuid);

        if ($detalhe === null) {
            return response()->json($this->erro('COLETAS_404', 'Rota não encontrada.'), 404);
        }

        return response()->json(['success' => true, 'data' => $detalhe]);
    }

    public function coletaDetalhe(Request $request): JsonResponse
    {
        $id = (int) $request->query('id');
        $detalhe = $this->coletas->coletaDetalhe($id);

        if ($detalhe === null) {
            return response()->json($this->erro('COLETAS_405', 'Coleta não encontrada.'), 404);
        }

        return response()->json(['success' => true, 'data' => $detalhe]);
    }

    private function erro(string $code, string $message): array
    {
        return [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];
    }
}