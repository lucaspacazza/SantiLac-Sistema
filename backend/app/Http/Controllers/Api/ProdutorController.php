<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produtor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProdutorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Produtor::query()
            ->select([
                'id',
                'codigo',
                'nome',
                'cidade',
                'rota',
                'diario',
                'endereco',
                'cep',
                'cpf_cnpj',
                'celular',
                'ativo',
                'novo',
                'data_cadastro',
                'data_inativacao',
                'projeto',
            ])
            ->orderBy('nome');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));

            $query->where(function ($query) use ($search): void {
                $query
                    ->where('codigo', 'like', "%{$search}%")
                    ->orWhere('nome', 'like', "%{$search}%")
                    ->orWhere('cidade', 'like', "%{$search}%");
            });
        }

        if ($request->has('ativo')) {
            $query->where('ativo', $request->boolean('ativo'));
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        return response()->json([
            'success' => true,
            'data' => $query->paginate($perPage),
        ]);
    }

    public function show(string $codigo): JsonResponse
    {
        $produtor = Produtor::query()
            ->where('codigo', $codigo)
            ->first();

        if (! $produtor) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PRODUCER_410',
                    'message' => 'Produtor não encontrado.',
                    'details' => [
                        'codigo' => $codigo,
                    ],
                ],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $produtor,
        ]);
    }
}
