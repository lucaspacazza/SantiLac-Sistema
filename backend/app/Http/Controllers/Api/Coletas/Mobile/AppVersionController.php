<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\Coletas\Mobile\MobileResponse;
use Illuminate\Http\JsonResponse;

class AppVersionController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $defaultApkUrl = rtrim((string) config('app.url'), '/') . '/downloads/SantiLac-Coletas-Release.apk';

        return response()->json(MobileResponse::ok([
            'version_code' => (int) env('APP_COLETAS_VERSION_CODE', 9),
            'version_name' => (string) env('APP_COLETAS_VERSION_NAME', '1.0.8'),
            'apk_url' => (string) env('APP_COLETAS_APK_URL', $defaultApkUrl),
            'required' => filter_var(env('APP_COLETAS_UPDATE_REQUIRED', false), FILTER_VALIDATE_BOOLEAN),
            'message' => (string) env('APP_COLETAS_UPDATE_MESSAGE', 'Nova versão disponível.'),
        ]));
    }
}
