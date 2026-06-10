<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;

class MobileIdempotencyService
{
    public function get(string $endpoint, string $deviceId, string $idLocal): ?array
    {
        $row = DB::connection('raw')
            ->table('idempotency_log')
            ->where('endpoint', $endpoint)
            ->where('device_id', $deviceId)
            ->where('id_local', $idLocal)
            ->first();

        if (! $row || ! isset($row->response_json)) {
            return null;
        }

        $decoded = json_decode((string) $row->response_json, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function save(string $endpoint, string $deviceId, string $idLocal, array $response): void
    {
        DB::connection('raw')->statement(
            'INSERT INTO idempotency_log (endpoint, device_id, id_local, response_json, created_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE response_json = response_json',
            [
                $endpoint,
                $deviceId,
                $idLocal,
                json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]
        );
    }
}
