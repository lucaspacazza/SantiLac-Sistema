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
        foreach (['device_id', 'id_local', 'produtor_codigo'] as $field) {
            if (! is_string($payload[$field] ?? null) || trim((string) $payload[$field]) === '') {
                return MobileResponse::fail("Campo obrigatório inválido: {$field}");
            }
        }
        if (! is_numeric($payload['lat'] ?? null) || ! is_numeric($payload['lng'] ?? null)) {
            return MobileResponse::fail('lat/lng inválidos para endpoint');
        }

        $deviceId = trim((string) $payload['device_id']);
        $idLocal = trim((string) $payload['id_local']);
        $endpoint = '/api/produtores/endpoint';
        $existing = $this->idempotency->get($endpoint, $deviceId, $idLocal);
        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::connection('raw')->transaction(function () use ($payload, $deviceId, $idLocal, $endpoint): array {
                $casaId = $this->upsertCasaPonto($deviceId, $idLocal, $payload);
                $endpointId = $this->upsertEndpoint($payload);
                $response = MobileResponse::ok([
                    'produtor_codigo' => (string) $payload['produtor_codigo'],
                    'produtor_casa_ponto_id' => $casaId,
                    'produtor_endpoint_id' => $endpointId,
                ], [['id_local' => $idLocal, 'id_server' => $endpointId]]);
                $this->idempotency->save($endpoint, $deviceId, $idLocal, $response);
                return $response;
            });
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar endpoint do produtor: ' . $e->getMessage());
        }
    }

    private function upsertCasaPonto(string $deviceId, string $idLocal, array $payload): int
    {
        $produtorCodigo = trim((string) $payload['produtor_codigo']);
        $rotaLocal = trim((string) ($payload['rota_id_local'] ?? ''));
        $coletaLocal = trim((string) ($payload['coleta_id_local'] ?? ''));

        DB::connection('raw')->statement(
            'INSERT INTO produtor_casa_pontos (
                device_id, id_local, produtor_codigo, produtor_nome,
                rota_id_local, rota_id_server, coleta_id_local, coleta_id_server,
                lat, lng, accuracy_m, source, endereco_texto, captured_at,
                confirmed_by_coleta, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                produtor_nome = COALESCE(NULLIF(VALUES(produtor_nome), \'\'), produtor_casa_pontos.produtor_nome),
                rota_id_local = COALESCE(VALUES(rota_id_local), produtor_casa_pontos.rota_id_local),
                rota_id_server = COALESCE(VALUES(rota_id_server), produtor_casa_pontos.rota_id_server),
                coleta_id_local = COALESCE(VALUES(coleta_id_local), produtor_casa_pontos.coleta_id_local),
                coleta_id_server = COALESCE(VALUES(coleta_id_server), produtor_casa_pontos.coleta_id_server),
                lat = VALUES(lat),
                lng = VALUES(lng),
                accuracy_m = VALUES(accuracy_m),
                source = VALUES(source),
                endereco_texto = COALESCE(VALUES(endereco_texto), produtor_casa_pontos.endereco_texto),
                captured_at = COALESCE(VALUES(captured_at), produtor_casa_pontos.captured_at),
                confirmed_by_coleta = GREATEST(produtor_casa_pontos.confirmed_by_coleta, VALUES(confirmed_by_coleta)),
                updated_at = NOW()',
            [
                $deviceId,
                $idLocal,
                $produtorCodigo,
                trim((string) ($payload['produtor_nome'] ?? '')) ?: null,
                $rotaLocal ?: null,
                $rotaLocal !== '' ? $this->rotas->getRotaServerId($deviceId, $rotaLocal) : null,
                $coletaLocal ?: null,
                $coletaLocal !== '' ? $this->coletas->getColetaServerId($deviceId, $coletaLocal) : null,
                (float) $payload['lat'],
                (float) $payload['lng'],
                isset($payload['accuracy_m']) && is_numeric($payload['accuracy_m']) ? (float) $payload['accuracy_m'] : null,
                trim((string) ($payload['source'] ?? 'app_mobile')) ?: 'app_mobile',
                trim((string) ($payload['endereco_texto'] ?? '')) ?: null,
                trim((string) ($payload['ts'] ?? '')) !== '' ? MobileTime::toMysql((string) $payload['ts']) : null,
                $coletaLocal !== '' ? 1 : 0,
            ]
        );

        $row = DB::connection('raw')->table('produtor_casa_pontos')->select('id')->where('produtor_codigo', $produtorCodigo)->first();
        return $row ? (int) $row->id : 0;
    }

    private function upsertEndpoint(array $payload): int
    {
        $produtorCodigo = trim((string) $payload['produtor_codigo']);

        DB::connection('raw')->statement(
            'INSERT INTO produtor_endpoints
                (produtor_codigo, produtor_nome, lat, lng, samples, source, last_event_ts, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                produtor_nome = COALESCE(NULLIF(VALUES(produtor_nome), \'\'), produtor_endpoints.produtor_nome),
                lat = VALUES(lat),
                lng = VALUES(lng),
                samples = GREATEST(produtor_endpoints.samples, VALUES(samples)),
                source = VALUES(source),
                last_event_ts = COALESCE(VALUES(last_event_ts), produtor_endpoints.last_event_ts),
                updated_at = NOW()',
            [
                $produtorCodigo,
                trim((string) ($payload['produtor_nome'] ?? '')) ?: null,
                (float) $payload['lat'],
                (float) $payload['lng'],
                isset($payload['samples']) && is_numeric($payload['samples']) ? max(1, (int) $payload['samples']) : 1,
                trim((string) ($payload['source'] ?? 'app_mobile')) ?: 'app_mobile',
                trim((string) ($payload['ts'] ?? '')) !== '' ? MobileTime::toMysql((string) $payload['ts']) : null,
            ]
        );

        $row = DB::connection('raw')->table('produtor_endpoints')->select('id')->where('produtor_codigo', $produtorCodigo)->first();
        return $row ? (int) $row->id : 0;
    }
}
