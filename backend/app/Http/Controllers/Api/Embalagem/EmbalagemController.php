<?php

namespace App\Http\Controllers\Api\Embalagem;

use App\Http\Controllers\Controller;
use App\Services\Embalagem\EmbalagemService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Throwable;

class EmbalagemController extends Controller
{
    public function __construct(
        private readonly EmbalagemService $embalagem,
    ) {
    }

    public function validarOrdem(Request $request): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->validarOrdem((string) $request->input('codigo_ordem', '')));
    }

    public function estado(int $loteId): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->estado($loteId));
    }

    public function registrarCaixa(Request $request, int $loteId): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->registrarCaixa(
            $loteId,
            (string) $request->input('codigo_barra', ''),
        ));
    }

    public function finalizar(Request $request, int $loteId): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->finalizar(
            $loteId,
            (int) $request->input('pecas_avulsas', 0),
            (float) $request->input('peso_pecas_avulsas', 0),
            (string) $request->input('palete_parcial', 'preencher'),
        ));
    }

    public function etiquetasPendentes(Request $request): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->paletesPendentesEtiqueta($this->baseUrl($request)));
    }

    public function marcarEtiqueta(Request $request, int $paleteId): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->marcarEtiquetaPalete(
            $paleteId,
            (bool) $request->boolean('impressa'),
            $request->input('erro') !== null ? (string) $request->input('erro') : null,
        ));
    }

    public function resumoPalete(Request $request, string $token): JsonResponse
    {
        return $this->executar(fn (): array => $this->embalagem->resumoPaletePorToken($token, $this->baseUrl($request)));
    }

    public function visualizarPalete(Request $request, string $token): Response
    {
        try {
            return response($this->embalagem->htmlResumoPalete($token, $this->baseUrl($request)))
                ->header('Content-Type', 'text/html; charset=UTF-8');
        } catch (DomainException $exception) {
            return response('<!doctype html><meta charset="utf-8"><title>Palete</title><p>Palete não encontrado.</p>', 404)
                ->header('Content-Type', 'text/html; charset=UTF-8');
        }
    }

    private function executar(callable $callback): JsonResponse
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $callback(),
            ]);
        } catch (DomainException $exception) {
            return response()->json([
                'success' => false,
                'error' => ['message' => $exception->getMessage()],
            ], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'error' => ['message' => 'Não foi possível concluir a operação.'],
            ], 500);
        }
    }

    private function baseUrl(Request $request): string
    {
        $configured = trim((string) env('EMBALAGEM_PUBLIC_URL', ''));
        if ($configured !== '') {
            return rtrim($configured, '/');
        }

        $host = (string) ($request->headers->get('X-Forwarded-Host') ?: $request->getHost());
        $proto = (string) ($request->headers->get('X-Forwarded-Proto') ?: $request->getScheme());

        return rtrim($proto . '://' . $host, '/');
    }
}
