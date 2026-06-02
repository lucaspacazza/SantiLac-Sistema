<?php

namespace App\Services\Combustivel;

use RuntimeException;

class CombustivelException extends RuntimeException
{
    public function __construct(
        private readonly string $errorCode,
        string $message,
        private readonly array $details = []
    ) {
        parent::__construct($message);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function details(): array
    {
        return $this->details;
    }
}
