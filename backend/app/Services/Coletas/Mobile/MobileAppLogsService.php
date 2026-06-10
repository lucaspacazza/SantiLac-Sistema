<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Throwable;

class MobileAppLogsService
{
    public function store(array $payload): array
    {
        $deviceId = trim((string) ($payload['device_id'] ?? ''));
        $logs = $payload['logs'] ?? null;
        if ($deviceId === '' || ! is_array($logs) || count($logs) === 0) {
            return MobileResponse::fail('Campo logs deve ser um array não vazio');
        }

        try {
            $inserted = 0;
            foreach ($logs as $log) {
                if (! is_array($log)) {
                    continue;
                }
                $idLocal = trim((string) ($log['id_local'] ?? ''));
                if ($idLocal === '') {
                    continue;
                }

                $inserted += DB::connection('raw')->affectingStatement(
                    'INSERT IGNORE INTO app_mobile_logs
                     (device_id, id_local, area, mensagem, erro_tipo, erro_detalhe, dados_json, app_ts, received_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                    [
                        $deviceId,
                        $idLocal,
                        mb_substr(trim((string) ($log['area'] ?? 'app')), 0, 80),
                        mb_substr(trim((string) ($log['mensagem'] ?? '')), 0, 500),
                        isset($log['erro']) ? mb_substr((string) $log['erro'], 0, 120) : null,
                        isset($log['detalhe']) ? mb_substr((string) $log['detalhe'], 0, 1000) : null,
                        json_encode($log['dados'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        MobileTime::toMysql((string) ($log['ts'] ?? now('America/Sao_Paulo')->toIso8601String())),
                    ]
                );
            }

            return MobileResponse::ok(['logs_recebidos' => count($logs), 'logs_gravados' => $inserted]);
        } catch (Throwable $e) {
            return MobileResponse::fail('Erro ao salvar logs do app: ' . $e->getMessage());
        }
    }
}
