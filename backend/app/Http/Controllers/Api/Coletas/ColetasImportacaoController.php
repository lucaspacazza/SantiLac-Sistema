<?php

namespace App\Http\Controllers\Api\Coletas;

use App\Http\Controllers\Controller;
use App\Services\Coletas\ColetasImportacaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ColetasImportacaoController extends Controller
{
    public function __construct(
        private readonly ColetasImportacaoService $importacoes
    ) {}

    public function importar(Request $request): JsonResponse
    {
        $maxBytes = max(1, (int) config('services.coletas_importacao.max_bytes', 100 * 1024 * 1024));
        $maxKilobytes = (int) ceil($maxBytes / 1024);
        $maxMegabytes = round($maxBytes / 1024 / 1024, 1);

        $request->validate([
            'arquivo' => ['required', 'file', 'mimes:pdf', 'extensions:pdf', 'max:'.$maxKilobytes],
        ], [
            'arquivo.required' => 'Selecione um arquivo PDF.',
            'arquivo.mimes' => 'O arquivo precisa estar em formato PDF.',
            'arquivo.extensions' => 'O arquivo precisa ter extensao .pdf.',
            'arquivo.max' => "O PDF pode ter no maximo {$maxMegabytes} MB.",
        ]);

        $resultado = $this->importacoes->importar($request->file('arquivo'));
        if (! $resultado['success']) {
            $primeiroErro = $resultado['errors'][0] ?? [];

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => $primeiroErro['code'] ?? 'MILK_IMPORT_400',
                    'message' => $primeiroErro['message'] ?? 'Nao foi possivel importar o PDF.',
                    'details' => $primeiroErro['details'] ?? [],
                ],
                'data' => $resultado,
            ], 422);
        }

        return response()->json(['success' => true, 'data' => $resultado]);
    }
}
