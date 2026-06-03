<?php

namespace App\Services\Producao;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class BaseFormularioService
{
    protected function paginarFormulario(Request $request, string $modelClass, array $searchColumns, string $dateColumn, Closure $formatter): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = $modelClass::query()->orderByDesc($dateColumn)->orderByDesc('id');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($searchColumns, $search): void {
                foreach ($searchColumns as $index => $column) {
                    $index === 0
                        ? $query->where($column, 'like', "%{$search}%")
                        : $query->orWhere($column, 'like', "%{$search}%");
                }
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())->map($formatter)->values()->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    protected function criarFormulario(string $modelClass, array $payload): int
    {
        return DB::connection('raw')->transaction(function () use ($modelClass, $payload): int {
            $registro = $modelClass::query()->create([
                ...$payload,
                'status' => 'rascunho',
            ]);

            return (int) $registro->id;
        });
    }

    protected function atualizarFormulario(string $modelClass, int $id, array $payload, Closure $finder): array|bool|null
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status !== 'rascunho') {
            return false;
        }

        DB::connection('raw')->transaction(function () use ($registro, $payload): void {
            $registro->fill([
                ...$payload,
                'status' => 'rascunho',
            ]);
            $registro->save();
        });

        return $finder($id);
    }

    protected function finalizarFormulario(string $modelClass, int $id, Closure $finder): ?array
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status === 'rascunho') {
            $registro->status = 'finalizada';
            $registro->save();
        }

        return $finder($id);
    }

    protected function cancelarFormulario(string $modelClass, int $id, Closure $finder): ?array
    {
        $registro = $modelClass::query()->where('id', $id)->first();

        if ($registro === null) {
            return null;
        }

        if ($registro->status === 'rascunho') {
            $registro->status = 'cancelada';
            $registro->save();
        }

        return $finder($id);
    }

    protected function status(Model $registro): string
    {
        return (string) $registro->status;
    }
}
