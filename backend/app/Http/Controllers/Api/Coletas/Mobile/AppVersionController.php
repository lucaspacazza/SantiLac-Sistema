<?php

namespace App\Http\Controllers\Api\Coletas\Mobile;

use App\Http\Controllers\Controller;
use App\Services\AppVersionRegistry;
use App\Services\Coletas\Mobile\MobileResponse;
use Illuminate\Http\JsonResponse;

class AppVersionController extends Controller
{
    public function __construct(private readonly AppVersionRegistry $versions)
    {
    }

    public function __invoke(): JsonResponse
    {
        return response()->json(MobileResponse::ok($this->versions->get('coletas')))
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    }
}
