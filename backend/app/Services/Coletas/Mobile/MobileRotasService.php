<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class MobileRotasService
{
    public function __construct(
        private readonly MobileIdempotencyService $idempotency
    ) {
    }

    public function start(array $payload): array
    {
        $errors = $this->required($payload, ['device_id', 'id_local', 'caminhao_id', 'motorista_id', 'inicio_ts']);
        if ($errors !== []) {
            return MobileResponse::fail($errors);
        }

        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $endpoint = '/api/rotas/start';
        $existing = $this->idempotency->get($endpoint, $deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        $lockName = 'app_rota_start_' . substr(hash('sha256', $deviceId . ':' . $payload['motorista_id']), 0, 48);
        $lock = false;

        try {
            $lock = $this->acquireLock($lockName);
            if (! $lock) {
                return MobileResponse::fail('Outra abertura de rota está em andamento. Tente novamente em alguns segundos.');
            }

            return DB::connection('raw')->transaction(function () use ($payload, $deviceId, $idLocal, $endpoint): array {
                $routeId = $this->findOrCreateRota($payload);
                $response = MobileResponse::ok([], [['id_local' => $idLocal, 'id_server' => $routeId]]);
                $this->idempotency->save($endpoint, $deviceId, $idLocal, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao iniciar rota: ' . $e->getMessage());
        } finally {
            if ($lock) {
                $this->releaseLock($lockName);
            }
        }
    }

    public function finish(array $payload): array
    {
        $errors = $this->required($payload, ['device_id', 'id_local', 'fim_ts']);
        if ($errors !== []) {
            return MobileResponse::fail($errors);
        }

        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $endpoint = '/api/rotas/finish';
        $existing = $this->idempotency->get($endpoint, $deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($payload, $deviceId, $idLocal, $endpoint): array {
                $routeId = $this->finishRota(
                    $deviceId,
                    $idLocal,
                    MobileTime::toMysql((string) $payload['fim_ts']),
                    isset($payload['km_fim']) && is_numeric($payload['km_fim']) ? (int) $payload['km_fim'] : null
                );
                if ($routeId === null) {
                    return MobileResponse::fail('Rota não encontrada para finalizar');
                }

                $response = MobileResponse::ok([], [['id_local' => $idLocal, 'id_server' => $routeId]]);
                $this->idempotency->save($endpoint, $deviceId, $idLocal, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao finalizar rota: ' . $e->getMessage());
        }
    }

    public function cancel(array $payload): array
    {
        $errors = $this->required($payload, ['device_id', 'id_local']);
        if ($errors !== []) {
            return MobileResponse::fail($errors);
        }

        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $endpoint = '/api/rotas/cancel';
        $existing = $this->idempotency->get($endpoint, $deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($deviceId, $idLocal, $endpoint): array {
                $routeId = $this->cancelRota($deviceId, $idLocal);
                if ($routeId === null) {
                    return MobileResponse::fail('Rota não encontrada para cancelar');
                }

                $response = MobileResponse::ok(['status' => 'CANCELADA'], [['id_local' => $idLocal, 'id_server' => $routeId]]);
                $this->idempotency->save($endpoint, $deviceId, $idLocal, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao cancelar rota: ' . $e->getMessage());
        }
    }

    public function openRoute(?string $motoristaId, ?string $motoristaNome): array
    {
        $route = $this->findOpenRouteForMotorista(trim((string) $motoristaNome), trim((string) $motoristaId));
        if ($route === null) {
            return MobileResponse::ok(['rota' => null]);
        }

        return MobileResponse::ok([
            'rota' => [
                'id_server' => (int) $route->id,
                'id_local' => (string) $route->uuid,
                'rota_nome' => (string) $route->rota_nome,
                'motorista_nome' => (string) $route->motorista_nome,
                'caminhao_nome' => (string) $route->caminhao_nome,
                'placa' => (string) $route->placa,
                'km_ini' => $route->km_ini !== null ? (int) $route->km_ini : null,
                'inicio_ts' => MobileTime::toAtom((string) $route->inicio),
            ],
        ]);
    }

    public function getRotaServerId(string $deviceId, string $idLocal): ?int
    {
        $row = DB::connection('raw')
            ->table('app_sync_rotas_map')
            ->where('device_id', $deviceId)
            ->where('id_local', $idLocal)
            ->first();

        if ($row && isset($row->rota_id_server)) {
            $routeId = (int) $row->rota_id_server;
            $route = $this->getRotaById($routeId);
            if ($route && (int) ($route->status ?? -1) !== 1) {
                $openRouteId = $this->findRotaIdByUuid((string) $route->uuid, true);
                if ($openRouteId !== null && $openRouteId !== $routeId) {
                    $this->linkRotaLocal($deviceId, $idLocal, $openRouteId);
                    return $openRouteId;
                }
            }
            return $routeId;
        }

        $routeId = $this->findRotaIdByUuid($idLocal);
        if ($routeId !== null) {
            $this->linkRotaLocal($deviceId, $idLocal, $routeId);
        }

        return $routeId;
    }

    public function getRotaById(int $routeId): ?object
    {
        return DB::connection('raw')->table('rotas')->where('id', $routeId)->first();
    }

    public function recalculateTotalLitros(int $routeId): void
    {
        $route = $this->getRotaById($routeId);
        if (! $route || trim((string) $route->uuid) === '') {
            return;
        }

        $total = DB::connection('raw')->selectOne(
            'SELECT COALESCE(SUM(c.litros), 0) AS total
             FROM coletas c
             INNER JOIN (
                SELECT produtor_codigo, MAX(id) AS id
                FROM coletas
                WHERE rota_uuid = ?
                GROUP BY produtor_codigo
             ) latest ON latest.id = c.id
             WHERE c.rota_uuid = ?',
            [(string) $route->uuid, (string) $route->uuid]
        );

        DB::connection('raw')
            ->table('rotas')
            ->where('uuid', (string) $route->uuid)
            ->update(['total_litros' => (float) ($total->total ?? 0)]);
    }

    public function linkRotaLocal(string $deviceId, string $idLocal, int $routeId): void
    {
        DB::connection('raw')->statement(
            'INSERT INTO app_sync_rotas_map (device_id, id_local, rota_id_server, created_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE rota_id_server = VALUES(rota_id_server)',
            [$deviceId, $idLocal, $routeId]
        );
    }

    private function findOrCreateRota(array $payload): int
    {
        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $existing = $this->getRotaServerId($deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        $existingByUuid = $this->findRotaIdByUuid($idLocal);
        if ($existingByUuid !== null) {
            $this->linkRotaLocal($deviceId, $idLocal, $existingByUuid);
            return $existingByUuid;
        }

        $motoristaNome = trim((string) ($payload['motorista_nome'] ?? ''));
        if ($motoristaNome === '') {
            $motoristaNome = trim((string) $payload['motorista_id']);
        }

        $openRoute = $this->findOpenRouteForMotorista($motoristaNome, (string) $payload['motorista_id']);
        if ($openRoute !== null) {
            $this->linkRotaLocal($deviceId, $idLocal, (int) $openRoute->id);
            return (int) $openRoute->id;
        }

        $truck = $this->truck((string) $payload['caminhao_id']);
        $rotaNome = trim((string) ($payload['rota_nome'] ?? ''));
        if ($rotaNome === '') {
            $rotaNome = 'Rota App ' . now('America/Sao_Paulo')->format('Y-m-d');
        }

        $routeId = (int) DB::connection('raw')->table('rotas')->insertGetId([
            'uuid' => $idLocal,
            'rota_nome' => $rotaNome,
            'motorista_nome' => $motoristaNome,
            'caminhao_nome' => $truck['caminhao_nome'],
            'placa' => trim((string) ($payload['placa'] ?? '')) ?: $truck['placa'],
            'km_ini' => isset($payload['km_ini']) && is_numeric($payload['km_ini']) ? (int) $payload['km_ini'] : 0,
            'inicio' => MobileTime::toMysql((string) $payload['inicio_ts']),
            'status' => 1,
            'conferido' => 0,
            'analisado' => 0,
            'total_litros' => 0,
            'created_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
        ]);

        $this->linkRotaLocal($deviceId, $idLocal, $routeId);
        return $routeId;
    }

    private function finishRota(string $deviceId, string $idLocal, string $fim, ?int $kmFim): ?int
    {
        $routeId = $this->getRotaServerId($deviceId, $idLocal);
        if ($routeId === null) {
            return null;
        }

        $route = $this->getRotaById($routeId);
        if (! $route) {
            return null;
        }

        DB::connection('raw')
            ->table('rotas')
            ->where('uuid', (string) $route->uuid)
            ->where('status', 1)
            ->update([
                'fim' => $fim,
                'status' => 0,
                'km_fim' => $kmFim,
            ]);

        $this->recalculateTotalLitros($routeId);
        return $routeId;
    }

    private function cancelRota(string $deviceId, string $idLocal): ?int
    {
        $routeId = $this->getRotaServerId($deviceId, $idLocal);
        if ($routeId === null) {
            return null;
        }

        $route = $this->getRotaById($routeId);
        if (! $route) {
            return null;
        }

        $uuid = trim((string) $route->uuid);
        if ($uuid !== '') {
            DB::connection('raw')->statement(
                'INSERT INTO coletas_canceladas (
                    coleta_id_original, rota_id_server, rota_id_local, cancelado_device_id, cancelado_at,
                    produtor_codigo, produtor_nome, litros, temperatura,
                    rota_uuid, rota_nome, motorista_nome, caminhao_nome, placa,
                    km_ini, km_fim, inicio_rota, fim_rota,
                    usuario, device_id, datahora, coleta_created_at
                 )
                 SELECT
                    c.id, ?, ?, ?, NOW(),
                    c.produtor_codigo, c.produtor_nome, c.litros, c.temperatura,
                    c.rota_uuid, c.rota_nome, c.motorista_nome, c.caminhao_nome, c.placa,
                    c.km_ini, c.km_fim, c.inicio_rota, c.fim_rota,
                    c.usuario, c.device_id, c.datahora, c.created_at
                 FROM coletas c
                 WHERE c.rota_uuid = ?
                 ON DUPLICATE KEY UPDATE cancelado_at = VALUES(cancelado_at)',
                [$routeId, $idLocal, $deviceId, $uuid]
            );

            DB::connection('raw')->statement(
                'DELETE c
                 FROM coletas c
                 INNER JOIN coletas_canceladas cc ON cc.coleta_id_original = c.id
                 WHERE c.rota_uuid = ?',
                [$uuid]
            );
        }

        $updated = DB::connection('raw')
            ->table('rotas')
            ->where('uuid', $uuid)
            ->where('status', 1)
            ->update([
                'status' => 2,
                'fim' => DB::raw('COALESCE(fim, NOW())'),
                'total_litros' => 0,
            ]);

        return $updated > 0 || (int) $route->status === 2 ? $routeId : null;
    }

    private function findRotaIdByUuid(string $uuid, bool $onlyOpen = false): ?int
    {
        $query = DB::connection('raw')->table('rotas')->select('id')->where('uuid', trim($uuid));
        if ($onlyOpen) {
            $query->where('status', 1);
        }

        $row = $query
            ->orderByRaw('CASE WHEN status = 1 THEN 0 WHEN status = 0 THEN 1 WHEN status = 2 THEN 2 ELSE 3 END')
            ->orderByDesc('id')
            ->first();

        return $row ? (int) $row->id : null;
    }

    private function findOpenRouteForMotorista(string $motoristaNome, ?string $motoristaId): ?object
    {
        $identifiers = array_values(array_unique(array_filter([
            trim($motoristaNome),
            trim((string) $motoristaId),
        ], fn (string $value): bool => $value !== '')));

        if ($identifiers === []) {
            return null;
        }

        return DB::connection('raw')
            ->table('rotas')
            ->select('id', 'uuid', 'rota_nome', 'motorista_nome', 'caminhao_nome', 'placa', 'km_ini', 'inicio')
            ->where('status', 1)
            ->whereIn('motorista_nome', $identifiers)
            ->orderByDesc('inicio')
            ->first();
    }

    private function truck(string $input): array
    {
        $input = trim($input);
        if ($input === '') {
            return ['caminhao_nome' => 'CAMINHAO APP', 'placa' => 'APP-0000'];
        }

        $query = DB::connection('raw')->table('caminhoes')->select('identificacao', 'placa');
        $row = ctype_digit($input)
            ? (clone $query)->where('id', (int) $input)->first()
            : (clone $query)->where('identificacao', $input)->first();

        if ($row) {
            return [
                'caminhao_nome' => (string) $row->identificacao,
                'placa' => (string) $row->placa,
            ];
        }

        return ['caminhao_nome' => $input, 'placa' => 'APP-0000'];
    }

    private function acquireLock(string $name): bool
    {
        $row = DB::connection('raw')->selectOne('SELECT GET_LOCK(?, 5) AS acquired', [$name]);
        return (int) ($row->acquired ?? 0) === 1;
    }

    private function releaseLock(string $name): void
    {
        DB::connection('raw')->select('SELECT RELEASE_LOCK(?)', [$name]);
    }

    private function required(array $payload, array $fields): array
    {
        $errors = [];
        foreach ($fields as $field) {
            if (! is_string($payload[$field] ?? null) || trim((string) $payload[$field]) === '') {
                $errors[] = "Campo obrigatório inválido: {$field}";
            }
        }
        return $errors;
    }
}
