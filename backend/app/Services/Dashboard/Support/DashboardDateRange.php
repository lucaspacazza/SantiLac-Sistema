<?php

namespace App\Services\Dashboard\Support;

use Carbon\CarbonImmutable;
use Illuminate\Container\Container;

final class DashboardDateRange
{
    private function __construct(
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
    ) {}

    public static function from(?string $start = null, ?string $end = null): self
    {
        $timezone = Container::getInstance()->bound('config')
            ? (string) config('app.timezone')
            : date_default_timezone_get();
        $endDate = $end
            ? CarbonImmutable::createFromFormat('!Y-m-d', $end, $timezone)
            : CarbonImmutable::now($timezone)->startOfDay();
        $startDate = $start
            ? CarbonImmutable::createFromFormat('!Y-m-d', $start, $timezone)
            : $endDate->subDays(29);

        if ($startDate->greaterThan($endDate)) {
            throw new \InvalidArgumentException('A data inicial deve ser anterior ou igual à data final.');
        }

        return new self($startDate, $endDate);
    }

    public function startDate(): string
    {
        return $this->start->toDateString();
    }

    public function endDate(): string
    {
        return $this->end->toDateString();
    }

    public function days(): int
    {
        return $this->start->diffInDays($this->end) + 1;
    }

    public function previousStartDate(): string
    {
        return $this->start->subDays($this->days())->toDateString();
    }

    public function previousEndDate(): string
    {
        return $this->start->subDay()->toDateString();
    }
}
