<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Throwable;

class MobileStopsService
{
    public function __construct(
        private readonly MobileRotasService $rotas,
        private readonly MobileIdempotencyService $idempotency
    ) {
    }

    public function storeBatch(array $payload): array
    {
        foreach (['device_id', 'id_local', 'rota_id_local'] as $field) {
            if (! is_string($payload[$field] ?? null) || trim((string) $payload[$field]) === '') {
                return MobileResponse::fail("Campo obrigatório inválido: {$field}");
            }
        }
        if (! is_array($payload['stops'] ?? null) || count($payload['stops']) === 0) {
            return MobileResponse::fail('Campo stops deve ser um array não vazio');
        }

        $deviceId = trim((string) $payload['device_id']);
        $batchId = trim((string) $payload['id_local']);
        $rotaLocal = trim((string) $payload['rota_id_local']);
        $endpoint = '/api/rotas/stops-batch';
        $existing = $this->idempotency->get($endpoint, $deviceId, $batchId);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($payload, $deviceId, $batchId, $rotaLocal, $endpoint): array {
                $routeId = $this->rotas->getRotaServerId($deviceId, $rotaLocal);
                if ($routeId === null) {
                    return MobileResponse::fail('Rota não encontrada para paradas');
                }

                $mappings = [];
                foreach ($payload['stops'] as $stop) {
                    if (! is_array($stop)) {
                        continue;
                    }
                    $id = $this->upsertStop($routeId, $deviceId, $stop);
                    $mappings[] = ['id_local' => (string) $stop['id_local'], 'id_server' => $id];
                }

                $response = MobileResponse::ok(['stops_processados' => count($mappings)], $mappings);
                $this->idempotency->save($endpoint, $deviceId, $batchId, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar paradas: ' . $e->getMessage());
        }
    }

    private function upsertStop(int $routeId, string $deviceId, array $stop): int
    {
        foreach (['id_local', 'inicio_ts', 'fim_ts', 'duracao_seg', 'lat', 'lng'] as $field) {
            if (! array_key_exists($field, $stop)) {
                throw new \RuntimeException("Campo {$field} ausente em parada");
            }
        }

        $existing = DB::connection('raw')
            ->table('gps_paradas')
            ->select('id')
            ->where('device_id', $deviceId)
            ->where('id_local', (string) $stop['id_local'])
            ->first();
        if ($existing) {
            return (int) $existing->id;
        }

        return (int) DB::connection('raw')->table('gps_paradas')->insertGetId([
            'rota_id_server' => $routeId,
            'device_id' => $deviceId,
            'id_local' => (string) $stop['id_local'],
            'inicio_ts' => MobileTime::toMysql((string) $stop['inicio_ts']),
            'fim_ts' => MobileTime::toMysql((string) $stop['fim_ts']),
            'duracao_seg' => (int) $stop['duracao_seg'],
            'lat' => (float) $stop['lat'],
            'lng' => (float) $stop['lng'],
            'created_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
        ]);
    }
}
