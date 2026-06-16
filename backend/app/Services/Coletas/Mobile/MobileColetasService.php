<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class MobileColetasService
{
    public function __construct(
        private readonly MobileRotasService $rotas,
        private readonly MobileIdempotencyService $idempotency
    ) {
    }

    public function storeBatch(array $payload): array
    {
        $deviceId = trim((string) ($payload['device_id'] ?? ''));
        $requestId = trim((string) ($payload['id_local'] ?? ''));
        if ($deviceId === '' || $requestId === '') {
            return MobileResponse::fail('Campo obrigatório inválido: device_id/id_local');
        }

        $coletas = $payload['coletas'] ?? null;
        if (! is_array($coletas)) {
            if (isset($payload['rota_id_local'], $payload['litros'], $payload['ts']) && (isset($payload['produtor_id']) || isset($payload['produtor_codigo']))) {
                $coletas = [[
                    'id_local' => $payload['id_local'],
                    'rota_id_local' => $payload['rota_id_local'],
                    'produtor_id' => $payload['produtor_id'] ?? null,
                    'produtor_codigo' => $payload['produtor_codigo'] ?? null,
                    'produtor_nome' => $payload['produtor_nome'] ?? null,
                    'litros' => $payload['litros'],
                    'temperatura' => $payload['temperatura'] ?? null,
                    'tanque' => $payload['tanque'] ?? null,
                    'ts' => $payload['ts'],
                    'coleta_lat' => $payload['coleta_lat'] ?? null,
                    'coleta_lng' => $payload['coleta_lng'] ?? null,
                    'coleta_accuracy_m' => $payload['coleta_accuracy_m'] ?? null,
                    'coleta_location_source' => $payload['coleta_location_source'] ?? null,
                    'usuario' => $payload['usuario'] ?? null,
                    'observacoes' => $payload['observacoes'] ?? null,
                ]];
            } else {
                return MobileResponse::fail('Campo coletas deve ser array ou payload único de coleta');
            }
        }

        $endpoint = '/api/rotas/coletas-batch';
        $existing = $this->idempotency->get($endpoint, $deviceId, $requestId);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($coletas, $deviceId, $requestId, $endpoint): array {
                $mappings = [];
                foreach ($coletas as $coleta) {
                    if (! is_array($coleta)) {
                        continue;
                    }
                    foreach (['id_local', 'rota_id_local', 'litros', 'ts'] as $field) {
                        if (! array_key_exists($field, $coleta)) {
                            throw new RuntimeException("Campo {$field} ausente em coleta");
                        }
                    }

                    $routeId = $this->rotas->getRotaServerId($deviceId, (string) $coleta['rota_id_local']);
                    if ($routeId === null) {
                        throw new RuntimeException('Rota não encontrada para coleta: ' . $coleta['rota_id_local']);
                    }

                    $coletaId = $this->upsertColeta($routeId, $deviceId, $coleta);
                    $mappings[] = ['id_local' => (string) $coleta['id_local'], 'id_server' => $coletaId];
                }

                $response = MobileResponse::ok(['coletas_processadas' => count($mappings)], $mappings);
                $this->idempotency->save($endpoint, $deviceId, $requestId, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar coletas: ' . $e->getMessage());
        }
    }

    public function getColetaServerId(string $deviceId, string $idLocal): ?int
    {
        $row = DB::connection('raw')
            ->table('app_sync_coletas_map')
            ->select('coleta_id_server')
            ->where('device_id', $deviceId)
            ->where('id_local', $idLocal)
            ->first();

        return $row ? (int) $row->coleta_id_server : null;
    }

    private function upsertColeta(int $routeId, string $deviceId, array $coleta): int
    {
        $idLocal = (string) $coleta['id_local'];
        $existingMapped = $this->getColetaServerId($deviceId, $idLocal);
        if ($existingMapped !== null) {
            $this->updateColeta($existingMapped, $routeId, $deviceId, $coleta);
            $this->rotas->recalculateTotalLitros($routeId);
            return $existingMapped;
        }

        $route = $this->rotas->getRotaById($routeId);
        if (! $route) {
            throw new RuntimeException('Rota não encontrada para coleta');
        }

        $produtorCodigo = trim((string) ($coleta['produtor_codigo'] ?? $coleta['produtor_id'] ?? ''));
        if ($produtorCodigo === '') {
            throw new RuntimeException('produtor_id/produtor_codigo obrigatório');
        }

        $existingProducer = DB::connection('raw')
            ->table('coletas')
            ->select('id')
            ->where('rota_uuid', (string) $route->uuid)
            ->where('produtor_codigo', $produtorCodigo)
            ->orderByDesc('id')
            ->first();
        if ($existingProducer) {
            $existingId = (int) $existingProducer->id;
            $this->linkColetaLocal($deviceId, $idLocal, $existingId);
            $this->updateColeta($existingId, $routeId, $deviceId, $coleta);
            $this->rotas->recalculateTotalLitros($routeId);
            return $existingId;
        }

        $data = $this->coletaData($route, $deviceId, $coleta);
        $coletaId = (int) DB::connection('raw')->table('coletas')->insertGetId($data);
        $this->linkColetaLocal($deviceId, $idLocal, $coletaId);
        $this->upsertMeta($coletaId, $coleta['observacoes'] ?? null);
        $this->upsertColetaPonto($deviceId, $idLocal, $routeId, $coletaId, $coleta);
        $this->rotas->recalculateTotalLitros($routeId);

        return $coletaId;
    }

    private function updateColeta(int $coletaId, int $routeId, string $deviceId, array $coleta): void
    {
        $route = $this->rotas->getRotaById($routeId);
        if (! $route) {
            throw new RuntimeException('Rota não encontrada para atualizar coleta');
        }

        DB::connection('raw')->table('coletas')->where('id', $coletaId)->update($this->coletaData($route, $deviceId, $coleta));
        $this->upsertMeta($coletaId, $coleta['observacoes'] ?? null);
        $this->upsertColetaPonto($deviceId, (string) $coleta['id_local'], $routeId, $coletaId, $coleta);
    }

    private function coletaData(object $route, string $deviceId, array $coleta): array
    {
        $produtorCodigo = trim((string) ($coleta['produtor_codigo'] ?? $coleta['produtor_id'] ?? ''));
        $produtorNome = trim((string) ($coleta['produtor_nome'] ?? '')) ?: $this->produtorNome($produtorCodigo) ?: 'NAO IDENTIFICADO';

        return [
            'produtor_codigo' => $produtorCodigo,
            'produtor_nome' => $produtorNome,
            'litros' => (float) $coleta['litros'],
            'temperatura' => isset($coleta['temperatura']) && is_numeric($coleta['temperatura']) ? (float) $coleta['temperatura'] : null,
            'tanque' => $this->tanque($coleta['tanque'] ?? null),
            'rota_uuid' => (string) $route->uuid,
            'rota_nome' => (string) $route->rota_nome,
            'motorista_nome' => (string) $route->motorista_nome,
            'caminhao_nome' => (string) $route->caminhao_nome,
            'placa' => (string) $route->placa,
            'km_ini' => $route->km_ini !== null ? (int) $route->km_ini : null,
            'km_fim' => $route->km_fim !== null ? (int) $route->km_fim : null,
            'inicio_rota' => (string) $route->inicio,
            'fim_rota' => $route->fim,
            'usuario' => trim((string) ($coleta['usuario'] ?? 'app_mobile')) ?: 'app_mobile',
            'device_id' => $deviceId,
            'datahora' => MobileTime::toMysql((string) $coleta['ts']),
        ];
    }

    private function linkColetaLocal(string $deviceId, string $idLocal, int $coletaId): void
    {
        DB::connection('raw')->statement(
            'INSERT INTO app_sync_coletas_map (device_id, id_local, coleta_id_server, created_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE coleta_id_server = VALUES(coleta_id_server)',
            [$deviceId, $idLocal, $coletaId]
        );
    }

    private function upsertMeta(int $coletaId, mixed $observacoes): void
    {
        $observacoes = trim((string) ($observacoes ?? ''));
        if ($observacoes === '') {
            return;
        }

        DB::connection('raw')->statement(
            'INSERT INTO app_coletas_meta (coleta_id_server, observacoes, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE observacoes = VALUES(observacoes), updated_at = NOW()',
            [$coletaId, $observacoes]
        );
    }

    private function upsertColetaPonto(string $deviceId, string $coletaIdLocal, int $routeId, int $coletaId, array $coleta): void
    {
        if (! is_numeric($coleta['coleta_lat'] ?? null) || ! is_numeric($coleta['coleta_lng'] ?? null)) {
            return;
        }

        $lat = (float) $coleta['coleta_lat'];
        $lng = (float) $coleta['coleta_lng'];
        $accuracy = isset($coleta['coleta_accuracy_m']) && is_numeric($coleta['coleta_accuracy_m'])
            ? (float) $coleta['coleta_accuracy_m']
            : null;

        if (! $this->isValidColetaPoint($lat, $lng, $accuracy)) {
            return;
        }

        $produtorCodigo = trim((string) ($coleta['produtor_codigo'] ?? $coleta['produtor_id'] ?? ''));
        $produtorNome = trim((string) ($coleta['produtor_nome'] ?? '')) ?: $this->produtorNome($produtorCodigo);
        $capturedAt = MobileTime::toMysql((string) ($coleta['ts'] ?? now('America/Sao_Paulo')->format('Y-m-d H:i:s')));

        DB::connection('raw')->statement(
            'INSERT INTO coleta_pontos (
                device_id, id_local, rota_id_local, rota_id_server,
                coleta_id_local, coleta_id_server, produtor_codigo, produtor_nome,
                lat, lng, accuracy_m, source, captured_at, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                rota_id_local = VALUES(rota_id_local),
                rota_id_server = VALUES(rota_id_server),
                coleta_id_server = VALUES(coleta_id_server),
                produtor_codigo = VALUES(produtor_codigo),
                produtor_nome = VALUES(produtor_nome),
                lat = VALUES(lat),
                lng = VALUES(lng),
                accuracy_m = VALUES(accuracy_m),
                source = VALUES(source),
                captured_at = VALUES(captured_at),
                updated_at = NOW()',
            [
                $deviceId,
                $coletaIdLocal,
                trim((string) ($coleta['rota_id_local'] ?? '')) ?: null,
                $routeId,
                $coletaIdLocal,
                $coletaId,
                $produtorCodigo,
                $produtorNome ?: null,
                $lat,
                $lng,
                $accuracy,
                trim((string) ($coleta['coleta_location_source'] ?? 'COLETA')) ?: 'COLETA',
                $capturedAt,
            ]
        );
    }

    private function isValidColetaPoint(float $lat, float $lng, ?float $accuracy): bool
    {
        if (! is_finite($lat) || ! is_finite($lng)) {
            return false;
        }
        if ($lat < -31.0 || $lat > -25.0 || $lng < -55.5 || $lng > -49.0) {
            return false;
        }
        return $accuracy !== null && $accuracy <= 30.0;
    }

    private function produtorNome(string $codigo): ?string
    {
        $row = DB::connection('raw')->table('produtores')->select('nome')->where('codigo', $codigo)->first();
        return $row ? (string) $row->nome : null;
    }

    private function tanque(mixed $value): ?int
    {
        if (! is_numeric($value)) {
            return null;
        }

        $tanque = (int) $value;
        return $tanque >= 1 && $tanque <= 3 ? $tanque : null;
    }
}
