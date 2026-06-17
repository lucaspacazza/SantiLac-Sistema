<?php

namespace App\Http\Controllers\Api\ProdutorApp;

use App\Http\Controllers\Controller;
use App\Services\ProdutorApp\ProdutorAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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
        $defaultApkUrl = rtrim((string) config('app.url'), '/') . '/api/produtor-app/download';
        $apkUrl = (string) (config('services.produtor_app.apk_url') ?: $defaultApkUrl);

        return response()->json([
            'ok' => true,
            'data' => [
                'version_code' => (int) config('services.produtor_app.version_code', 1),
                'version_name' => (string) config('services.produtor_app.version_name', '0.1.0'),
                'apk_url' => $apkUrl,
                'required' => (bool) config('services.produtor_app.update_required', false),
                'message' => (string) config('services.produtor_app.update_message', 'Nova versão disponível.'),
            ],
        ]);
    }

    public function download(): JsonResponse|BinaryFileResponse
    {
        $path = public_path('downloads/SantiLac-Produtor-Release.apk');
        if (! is_file($path)) {
            return response()->json([
                'ok' => false,
                'error' => 'APK não encontrado.',
            ], 404);
        }

        return response()->download($path, 'SantiLac-Produtor-Release.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
        ]);
    }

    private function respond(array $payload): JsonResponse
    {
        $status = (int) ($payload['_status'] ?? 200);
        unset($payload['_status']);

        return response()->json($payload, $status);
    }
}
