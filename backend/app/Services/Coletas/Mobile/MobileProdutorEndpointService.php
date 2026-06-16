<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Throwable;

class MobileProdutorEndpointService
{
    public function __construct(
        private readonly MobileRotasService $rotas,
        private readonly MobileColetasService $coletas,
        private readonly MobileIdempotencyService $idempotency
    ) {
    }

    public function store(array $payload): array
    {
        foreach (['device_id', 'id_local'] as $field) {
            if (! is_string($payload[$field] ?? null) || trim((string) $payload[$field]) === '') {
                return MobileResponse::fail("Campo obrigatório inválido: {$field}");
            }
        }

        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $endpoint = '/api/produtores/endpoint';
        $existing = $this->idempotency->get($endpoint, $deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($deviceId, $idLocal, $endpoint): array {
                $response = MobileResponse::ok([
                    'ignored' => true,
                    'motivo' => 'Cadastro automático da casa do produtor desativado. A coleta grava apenas o ponto exato da coleta.',
                ], [['id_local' => $idLocal, 'id_server' => 0]]);
                $this->idempotency->save($endpoint, $deviceId, $idLocal, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar endpoint do produtor: ' . $e->getMessage());
        }
    }

}
