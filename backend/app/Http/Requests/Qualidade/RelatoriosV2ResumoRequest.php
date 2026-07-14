<?php

namespace App\Http\Requests\Qualidade;

use App\Models\Qualidade\ProdutorQualidade;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RelatoriosV2ResumoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data_inicio' => ['required', 'date_format:Y-m-d'],
            'data_fim' => ['required', 'date_format:Y-m-d', 'after_or_equal:data_inicio', 'before_or_equal:today'],
            'rota' => ['nullable', 'string', 'max:255'],
            'cidade' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['data_inicio', 'data_fim'])) {
                return;
            }

            $inicio = CarbonImmutable::createFromFormat('Y-m-d', (string) $this->input('data_inicio'));
            $fim = CarbonImmutable::createFromFormat('Y-m-d', (string) $this->input('data_fim'));

            if ($inicio->diffInDays($fim) > 365) {
                $validator->errors()->add('data_fim', 'O período máximo para relatórios é de 366 dias.');
            }

            $rota = trim((string) $this->input('rota', ''));
            $cidade = trim((string) $this->input('cidade', ''));
            $ativos = ProdutorQualidade::query()->where('ativo', 1);

            if ($rota !== '' && ! (clone $ativos)->where('rota', $rota)->exists()) {
                $validator->errors()->add('rota', 'A rota selecionada não existe.');
            }

            if ($cidade !== '') {
                $cidadeValida = (clone $ativos)
                    ->when($rota !== '', fn ($query) => $query->where('rota', $rota))
                    ->where('cidade', $cidade)
                    ->exists();

                if (! $cidadeValida) {
                    $validator->errors()->add('cidade', 'A cidade não pertence ao contexto selecionado.');
                }
            }
        }];
    }
}
