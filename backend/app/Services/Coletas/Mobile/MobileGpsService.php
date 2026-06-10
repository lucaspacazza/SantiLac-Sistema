<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Throwable;

class MobileGpsService
{
    public function __construct(
        private readonly MobileRotasService $rotas,
        private readonly MobileIdempotencyService $idempotency
    ) {
    }

    public function storeChunk(array $payload): array
    {
        foreach (['device_id', 'id_local', 'rota_id_local'] as $field) {
            if (! is_string($payload[$field] ?? null) || trim((string) $payload[$field]) === '') {
                return MobileResponse::fail("Campo obrigatório inválido: {$field}");
            }
        }
        if (! is_array($payload['points'] ?? null) || count($payload['points']) === 0) {
            return MobileResponse::fail('Campo points deve ser um array não vazio');
        }

        $deviceId = trim((string) $payload['device_id']);
        $chunkId = trim((string) $payload['id_local']);
        $rotaLocal = trim((string) $payload['rota_id_local']);
        $endpoint = '/api/rotas/gps-chunk';
        $existing = $this->idempotency->get($endpoint, $deviceId, $chunkId);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($payload, $deviceId, $chunkId, $rotaLocal, $endpoint): array {
                $routeId = $this->rotas->getRotaServerId($deviceId, $rotaLocal);
                if ($routeId === null) {
                    return MobileResponse::fail('Rota não encontrada para chunk de GPS');
                }

                $inserted = $this->insertPoints($routeId, $payload['points']);
                $response = MobileResponse::ok(
                    ['pontos_inseridos' => $inserted],
                    [['id_local' => $rotaLocal, 'id_server' => $routeId]]
                );
                $this->idempotency->save($endpoint, $deviceId, $chunkId, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar gps chunk: ' . $e->getMessage());
        }
    }

    private function insertPoints(int $routeId, array $points): int
    {
        $route = $this->rotas->getRotaById($routeId);
        if (! $route) {
            throw new \RuntimeException('Rota não encontrada para GPS');
        }

        $inserted = 0;
        foreach ($points as $point) {
            if (! is_array($point) || ! isset($point['ts'], $point['lat'], $point['lng'])) {
                continue;
            }

            $ts = MobileTime::toMysql((string) $point['ts']);
            if ($route->fim !== null && $ts > (string) $route->fim) {
                continue;
            }

            DB::connection('raw')->table('gps_pontos')->insert([
                'rota_id_server' => $routeId,
                'ts' => $ts,
                'lat' => (float) $point['lat'],
                'lng' => (float) $point['lng'],
                'speed_mps' => isset($point['speed_mps']) && is_numeric($point['speed_mps']) ? (float) $point['speed_mps'] : null,
                'accuracy_m' => isset($point['accuracy_m']) && is_numeric($point['accuracy_m']) ? (float) $point['accuracy_m'] : null,
                'bearing' => isset($point['bearing']) && is_numeric($point['bearing']) ? (float) $point['bearing'] : null,
                'low_accuracy' => ! empty($point['low_accuracy']) ? 1 : 0,
                'created_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
            ]);
            $inserted++;
        }

        return $inserted;
    }
}
