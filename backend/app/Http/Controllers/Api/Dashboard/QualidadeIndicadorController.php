<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\QualidadeIndicadorService;
use Illuminate\Http\JsonResponse;

class QualidadeIndicadorController extends Controller
{
    public function __invoke(QualidadeIndicadorService $qualidade): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $qualidade->resumo()]);
    }
}
