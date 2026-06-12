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
        $this->linkCasaPonto($deviceId, $idLocal, $coletaId);
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
        $this->linkCasaPonto($deviceId, (string) $coleta['id_local'], $coletaId);
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

    private function linkCasaPonto(string $deviceId, string $coletaIdLocal, int $coletaId): void
    {
        DB::connection('raw')
            ->table('produtor_casa_pontos')
            ->where('device_id', $deviceId)
            ->where('coleta_id_local', $coletaIdLocal)
            ->where(function ($query): void {
                $query->whereNull('coleta_id_server')->orWhere('coleta_id_server', 0);
            })
            ->update([
                'coleta_id_server' => $coletaId,
                'confirmed_by_coleta' => 1,
                'updated_at' => now('America/Sao_Paulo')->format('Y-m-d H:i:s'),
            ]);
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
