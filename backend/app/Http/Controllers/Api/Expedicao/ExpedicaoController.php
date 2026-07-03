<?php

namespace App\Http\Controllers\Api\Expedicao;

use App\Http\Controllers\Controller;
use App\Services\Expedicao\ExpedicaoExportacaoService;
use App\Services\Expedicao\ExpedicaoService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ExpedicaoController extends Controller
{
    public function __construct(
        private readonly ExpedicaoService $expedicao,
        private readonly ExpedicaoExportacaoService $exportacao,
    ) {
    }

    public function resumo(): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->resumo());
    }

    public function estoque(Request $request): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->estoque([
            'busca' => $request->query('busca'),
            'produto' => $request->query('produto'),
            'disponivel' => $request->boolean('disponivel'),
        ]));
    }

    public function palete(int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->palete($id));
    }

    public function ordens(Request $request): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->ordens($request->only(['busca', 'status'])));
    }

    public function ordem(int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->ordem($id));
    }

    public function criar(Request $request): JsonResponse
    {
        return $this->executar(
            fn (): array => $this->expedicao->salvar($this->dadosOrdem($request), (int) $request->user()->id),
            201,
        );
    }

    public function atualizar(Request $request, int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->salvar(
            $this->dadosOrdem($request),
            (int) $request->user()->id,
            $id,
        ));
    }

    public function lancar(Request $request, int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->lancar($id, (int) $request->user()->id));
    }

    public function cancelar(int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->cancelar($id));
    }

    public function relatorio(Request $request): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->relatorio($request->only(['inicio', 'fim', 'status'])));
    }

    public function exportar(Request $request, string $formato): BinaryFileResponse|JsonResponse
    {
        try {
            $arquivo = $this->exportacao->exportar(
                $this->expedicao->relatorio($request->only(['inicio', 'fim', 'status']))['itens'],
                $formato,
            );

            return response()->download($arquivo['caminho'], $arquivo['arquivo'])->deleteFileAfterSend(true);
        } catch (DomainException $exception) {
            return response()->json(['success' => false, 'error' => ['message' => $exception->getMessage()]], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['success' => false, 'error' => ['message' => 'Não foi possível gerar o relatório.']], 500);
        }
    }

    public function carregamentos(): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->ordensParaCarregamento());
    }

    public function carregamento(int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->ordem($id, true));
    }

    public function iniciar(Request $request, int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->iniciarCarregamento($id, (int) $request->user()->id));
    }

    public function escanear(Request $request, int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->escanearPalete(
            $id,
            (string) $request->input('codigo', ''),
            (int) $request->user()->id,
        ));
    }

    public function concluir(Request $request, int $id): JsonResponse
    {
        return $this->executar(fn (): array => $this->expedicao->concluirCarregamento($id, (int) $request->user()->id));
    }

    private function dadosOrdem(Request $request): array
    {
        $paletes = $request->input('paletes', []);
        if (is_string($paletes)) {
            $decoded = json_decode($paletes, true);
            $paletes = is_array($decoded) ? $decoded : [];
        }

        return [
            ...$request->only(['cliente', 'destino', 'data_prevista', 'placa', 'motorista', 'observacoes']),
            'paletes' => $paletes,
        ];
    }

    private function executar(callable $callback, int $status = 200): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $callback()], $status);
        } catch (DomainException $exception) {
            return response()->json(['success' => false, 'error' => ['message' => $exception->getMessage()]], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['success' => false, 'error' => ['message' => 'Não foi possível concluir a operação.']], 500);
        }
    }
}
