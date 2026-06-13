<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Throwable;

class MobileGpsService
{
    private const MIN_LAT = -31.0;
    private const MAX_LAT = -25.0;
    private const MIN_LNG = -55.5;
    private const MAX_LNG = -49.0;
    private const MAX_ACCURACY_M = 30.0;
    private const MAX_TRUCK_SPEED_KMH = 120.0;
    private const GPS_JITTER_KM = 0.03;
    private const MIN_SECONDS_BETWEEN_POINTS = 10;
    private const MIN_DISTANCE_KM_BETWEEN_POINTS = 0.025;
    private const MAX_POINTS_PER_ROUTE = 10000;

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
        $orderedPoints = $points;
        usort($orderedPoints, function ($a, $b): int {
            $aTs = is_array($a) ? (string) ($a['ts'] ?? '') : '';
            $bTs = is_array($b) ? (string) ($b['ts'] ?? '') : '';

            return strcmp($aTs, $bTs);
        });

        $lastAccepted = $this->lastAcceptedPoint($routeId);
        $storedCount = DB::connection('raw')->table('gps_pontos')
            ->where('rota_id_server', $routeId)
            ->count();

        foreach ($orderedPoints as $point) {
            if ($storedCount >= self::MAX_POINTS_PER_ROUTE) {
                break;
            }

            if (! is_array($point) || ! isset($point['ts'], $point['lat'], $point['lng'])) {
                continue;
            }

            $ts = MobileTime::toMysql((string) $point['ts']);
            $lat = (float) $point['lat'];
            $lng = (float) $point['lng'];
            $accuracy = isset($point['accuracy_m']) && is_numeric($point['accuracy_m']) ? (float) $point['accuracy_m'] : null;

            if ($route->fim !== null && $ts > (string) $route->fim) {
                continue;
            }
            if (! $this->isValidPoint($lat, $lng, $accuracy)) {
                continue;
            }
            if (! $this->isPlausibleTransition($lastAccepted, $ts, $lat, $lng)) {
                continue;
            }
            if ($this->alreadyExists($routeId, $ts, $lat, $lng)) {
                continue;
            }

            DB::connection('raw')->table('gps_pontos')->insert([
                'rota_id_server' => $routeId,
                'ts' => $ts,
                'lat' => $lat,
                'lng' => $lng,
                'speed_mps' => isset($point['speed_mps']) && is_numeric($point['speed_mps']) ? (float) $point['speed_mps'] : null,
                'accuracy_m' => $accuracy,
                'bearing' => isset($point['bearing']) && is_numeric($point['bearing']) ? (float) $point['bearing'] : null,
                'low_accuracy' => ! empty($point['low_accuracy']) ? 1 : 0,
                'created_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
            ]);

            $lastAccepted = [
                'ts' => $ts,
                'lat' => $lat,
                'lng' => $lng,
            ];
            $inserted++;
            $storedCount++;
        }

        return $inserted;
    }

    private function lastAcceptedPoint(int $routeId): ?array
    {
        $row = DB::connection('raw')->table('gps_pontos')
            ->select('ts', 'lat', 'lng')
            ->where('rota_id_server', $routeId)
            ->orderByDesc('ts')
            ->orderByDesc('id')
            ->first();

        return $row ? [
            'ts' => (string) $row->ts,
            'lat' => (float) $row->lat,
            'lng' => (float) $row->lng,
        ] : null;
    }

    private function isValidPoint(float $lat, float $lng, ?float $accuracy): bool
    {
        if (! is_finite($lat) || ! is_finite($lng)) {
            return false;
        }
        if ($lat < self::MIN_LAT || $lat > self::MAX_LAT || $lng < self::MIN_LNG || $lng > self::MAX_LNG) {
            return false;
        }
        return $accuracy !== null && $accuracy <= self::MAX_ACCURACY_M;
    }

    private function isPlausibleTransition(?array $last, string $ts, float $lat, float $lng): bool
    {
        if ($last === null) {
            return true;
        }

        $seconds = strtotime($ts) - strtotime((string) $last['ts']);
        if ($seconds < self::MIN_SECONDS_BETWEEN_POINTS) {
            return false;
        }

        $distanceKm = $this->haversineKm((float) $last['lat'], (float) $last['lng'], $lat, $lng);
        if ($distanceKm < self::MIN_DISTANCE_KM_BETWEEN_POINTS) {
            return false;
        }

        if ($distanceKm <= self::GPS_JITTER_KM) {
            return true;
        }

        return ($distanceKm / $seconds) * 3600 <= self::MAX_TRUCK_SPEED_KMH;
    }

    private function alreadyExists(int $routeId, string $ts, float $lat, float $lng): bool
    {
        return DB::connection('raw')->table('gps_pontos')
            ->where('rota_id_server', $routeId)
            ->where('ts', $ts)
            ->whereRaw('ABS(lat - ?) < 0.0000001', [$lat])
            ->whereRaw('ABS(lng - ?) < 0.0000001', [$lng])
            ->exists();
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $latDistance = deg2rad($lat2 - $lat1);
        $lngDistance = deg2rad($lng2 - $lng1);
        $a = sin($latDistance / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDistance / 2) ** 2;

        return 6371 * 2 * asin(min(1, sqrt($a)));
    }
}
