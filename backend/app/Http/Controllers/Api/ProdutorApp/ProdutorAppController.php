<?php

namespace App\Http\Controllers\Api\ProdutorApp;

use App\Http\Controllers\Controller;
use App\Services\ProdutorApp\ProdutorAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProdutorAppController extends Controller
{
    public function __construct(
        private readonly ProdutorAppService $produtorApp
    ) {
    }

    public function login(Request $request): JsonResponse
    {
        return $this->respond($this->produtorApp->login(
            (string) ($request->input('cpf') ?? $request->input('login') ?? ''),
            (string) $request->input('senha', '')
        ));
    }

    public function logout(): JsonResponse
    {
        return $this->respond($this->produtorApp->logout());
    }

    public function me(): JsonResponse
    {
        return $this->respond($this->produtorApp->me());
    }

    public function adminProdutores(): JsonResponse
    {
        return $this->respond($this->produtorApp->adminProdutores());
    }

    public function adminImpersonate(Request $request): JsonResponse
    {
        return $this->respond($this->produtorApp->adminImpersonate((string) $request->input('codigo', '')));
    }

    public function coletas(Request $request): JsonResponse
    {
        return $this->respond($this->produtorApp->coletas($request->query('mes_ano')));
    }

    public function analises(): JsonResponse
    {
        return $this->respond($this->produtorApp->analises());
    }

    public function notas(Request $request): JsonResponse
    {
        return $this->respond($this->produtorApp->notas($request->query('competencia')));
    }

    public function version(): JsonResponse
    {
        $defaultApkUrl = rtrim((string) config('app.url'), '/') . '/downloads/SantiLac-Produtor-Release.apk';

        return response()->json([
            'ok' => true,
            'data' => [
                'version_code' => (int) env('APP_PRODUTOR_VERSION_CODE', 1),
                'version_name' => (string) env('APP_PRODUTOR_VERSION_NAME', '0.1.0'),
                'apk_url' => (string) env('APP_PRODUTOR_APK_URL', $defaultApkUrl),
                'required' => filter_var(env('APP_PRODUTOR_UPDATE_REQUIRED', false), FILTER_VALIDATE_BOOLEAN),
                'message' => (string) env('APP_PRODUTOR_UPDATE_MESSAGE', 'Nova versão disponível.'),
            ],
        ]);
    }

    private function respond(array $payload): JsonResponse
    {
        $status = (int) ($payload['_status'] ?? 200);
        unset($payload['_status']);

        return response()->json($payload, $status);
    }
}