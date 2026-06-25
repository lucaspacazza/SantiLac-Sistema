<?php

namespace App\Http\Controllers\Api\Combustivel;

use App\Http\Controllers\Controller;
use App\Services\Combustivel\CombustivelException;
use App\Services\Combustivel\CombustivelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CombustivelController extends Controller
{
    public function __construct(
        private readonly CombustivelService $combustivel
    ) {
    }

    public function resumo(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->combustivel->resumo(),
        ]);
    }

    public function entrada(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->registrarEntrada($request->all(), $request->user()?->id), 201);
    }

    public function saida(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->registrarSaida($request->all(), $request->user()?->id), 201);
    }

    public function historico(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->historico($request));
    }

    public function logs(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->logs($request));
    }

    public function usuarios(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->usuarios($request));
    }

    public function motoristas(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->motoristas($request));
    }

    public function caminhoes(Request $request): JsonResponse
    {
        return $this->handle(fn (): array => $this->combustivel->caminhoes($request));
    }

    private function handle(callable $callback, int $status = 200): JsonResponse
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $callback(),
            ], $status);
        } catch (CombustivelException $exception) {
            return response()->json($this->erro($exception->errorCode(), $exception->getMessage(), $exception->details()), 422);
        }
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