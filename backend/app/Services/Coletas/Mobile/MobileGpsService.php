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

                $result = $this->insertPoints($routeId, $payload['points']);
                $response = MobileResponse::ok(
                    $result,
                    [['id_local' => $rotaLocal, 'id_server' => $routeId]]
                );
                $this->idempotency->save($endpoint, $deviceId, $chunkId, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar gps chunk: ' . $e->getMessage());
        }
    }

    private function insertPoints(int $routeId, array $points): array
    {
        $route = $this->rotas->getRotaById($routeId);
        if (! $route) {
            throw new \RuntimeException('Rota não encontrada para GPS');
        }

        $inserted = 0;
        $ignored = 0;
        $seen = [];
        foreach ($points as $point) {
            if (! is_array($point) || ! isset($point['ts'], $point['lat'], $point['lng'])) {
                $ignored++;
                continue;
            }

            $ts = MobileTime::toMysql((string) $point['ts']);
            if ($route->fim !== null && $ts > (string) $route->fim) {
                $ignored++;
                continue;
            }

            $lat = round((float) $point['lat'], 7);
            $lng = round((float) $point['lng'], 7);
            if (! $this->isUsablePoint($lat, $lng, $point)) {
                $ignored++;
                continue;
            }

            $key = $ts . '|' . number_format($lat, 7, '.', '') . '|' . number_format($lng, 7, '.', '');
            if (isset($seen[$key]) || $this->pointExists($routeId, $ts, $lat, $lng)) {
                $ignored++;
                continue;
            }
            $seen[$key] = true;

            DB::connection('raw')->table('gps_pontos')->insert([
                'rota_id_server' => $routeId,
                'ts' => $ts,
                'lat' => $lat,
                'lng' => $lng,
                'speed_mps' => isset($point['speed_mps']) && is_numeric($point['speed_mps']) ? (float) $point['speed_mps'] : null,
                'accuracy_m' => isset($point['accuracy_m']) && is_numeric($point['accuracy_m']) ? (float) $point['accuracy_m'] : null,
                'bearing' => isset($point['bearing']) && is_numeric($point['bearing']) ? (float) $point['bearing'] : null,
                'low_accuracy' => ! empty($point['low_accuracy']) ? 1 : 0,
                'created_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
            ]);
            $inserted++;
        }

        return [
            'pontos_inseridos' => $inserted,
            'pontos_ignorados' => $ignored,
        ];
    }

    private function isUsablePoint(float $lat, float $lng, array $point): bool
    {
        if ($lat < -31.0 || $lat > -25.0 || $lng < -55.5 || $lng > -49.0) {
            return false;
        }

        if (isset($point['accuracy_m']) && is_numeric($point['accuracy_m']) && (float) $point['accuracy_m'] > 30.0) {
            return false;
        }

        return true;
    }

    private function pointExists(int $routeId, string $ts, float $lat, float $lng): bool
    {
        return DB::connection('raw')->table('gps_pontos')
            ->where('rota_id_server', $routeId)
            ->where('ts', $ts)
            ->where('lat', number_format($lat, 7, '.', ''))
            ->where('lng', number_format($lng, 7, '.', ''))
            ->exists();
    }
}
