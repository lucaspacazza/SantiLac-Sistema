<?php

namespace App\Http\Controllers\Api\ProdutorApp;

use App\Http\Controllers\Controller;
use App\Services\AppVersionRegistry;
use App\Services\ProdutorApp\ProdutorAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProdutorAppController extends Controller
{
    public function __construct(
        private readonly ProdutorAppService $produtorApp,
        private readonly AppVersionRegistry $versions
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
        return response()->json([
            'ok' => true,
            'data' => $this->versions->get('produtor'),
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
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
