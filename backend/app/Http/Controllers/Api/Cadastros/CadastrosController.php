<?php

namespace App\Http\Controllers\Api\Cadastros;

use App\Http\Controllers\Controller;
use App\Services\Cadastros\CadastrosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class CadastrosController extends Controller
{
    public function __construct(
        private readonly CadastrosService $cadastros
    ) {
    }

    public function usuarios(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['usuarios' => $this->cadastros->usuarios($request)]]);
    }

    public function usuario(Request $request): JsonResponse
    {
        return $this->item('usuario', $this->cadastros->usuario((int) $request->query('id')));
    }

    public function criarUsuario(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['usuario' => $this->cadastros->criarUsuario($request->all(), $this->isAdmin($request))], 201);
    }

    public function editarUsuario(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['usuario' => $this->cadastros->editarUsuario($request->all(), $this->isAdmin($request))]);
    }

    public function inativarUsuario(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['usuario' => $this->cadastros->inativarUsuario((int) $request->input('id'))]);
    }

    public function produtores(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['produtores' => $this->cadastros->produtores($request)]]);
    }

    public function produtor(Request $request): JsonResponse
    {
        return $this->item('produtor', $this->cadastros->produtor((int) $request->query('id')));
    }

    public function criarProdutor(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['produtor' => $this->cadastros->criarProdutor($request->all())], 201);
    }

    public function editarProdutor(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['produtor' => $this->cadastros->editarProdutor($request->all())]);
    }

    public function inativarProdutor(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['produtor' => $this->cadastros->inativarProdutor((int) $request->input('id'))]);
    }

    public function motoristas(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['motoristas' => $this->cadastros->motoristas($request)]]);
    }

    public function motorista(Request $request): JsonResponse
    {
        return $this->item('motorista', $this->cadastros->motorista((int) $request->query('id')));
    }

    public function criarMotorista(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['motorista' => $this->cadastros->criarMotorista($request->all())], 201);
    }

    public function editarMotorista(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['motorista' => $this->cadastros->editarMotorista($request->all())]);
    }

    public function inativarMotorista(Request $request): JsonResponse
    {
        return $this->salvar(fn () => ['motorista' => $this->cadastros->inativarMotorista((int) $request->input('id'))]);
    }

    private function item(string $key, ?array $item): JsonResponse
    {
        if ($item === null) {
            return response()->json($this->erro('CADASTROS_404', 'Cadastro não encontrado.'), 404);
        }

        return response()->json(['success' => true, 'data' => [$key => $item]]);
    }

    private function salvar(callable $callback, int $status = 200): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $callback()], $status);
        } catch (InvalidArgumentException $exception) {
            return response()->json($this->erro('CADASTROS_422', $exception->getMessage()), 422);
        }
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

    private function isAdmin(Request $request): bool
    {
        return (bool) ($request->user()?->admin ?? false);
    }
}
