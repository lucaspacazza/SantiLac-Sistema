<?php

namespace App\Http\Requests\Dashboard;

use App\Services\Dashboard\Support\DashboardDateRange;
use Illuminate\Foundation\Http\FormRequest;

class DashboardDateRangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data_inicio' => ['nullable', 'required_with:data_fim', 'date_format:Y-m-d', 'before_or_equal:data_fim'],
            'data_fim' => ['nullable', 'required_with:data_inicio', 'date_format:Y-m-d', 'after_or_equal:data_inicio', 'before_or_equal:today'],
        ];
    }

    public function range(): DashboardDateRange
    {
        $validated = $this->validated();

        return DashboardDateRange::from($validated['data_inicio'] ?? null, $validated['data_fim'] ?? null);
    }
}
