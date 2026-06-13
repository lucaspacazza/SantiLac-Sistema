<?php

namespace App\Services\Coletas;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ColetasGestaoService
{
    public function rotas(Request $request): array
    {
        $where = ['r.uuid IS NOT NULL', "TRIM(r.uuid) != ''"];
        $bindings = [];

        if ($request->filled('inicio')) {
            $where[] = 'DATE(r.inicio) >= :inicio';
            $bindings['inicio'] = (string) $request->query('inicio');
        }

        if ($request->filled('fim')) {
            $where[] = 'DATE(r.inicio) <= :fim';
            $bindings['fim'] = (string) $request->query('fim');
        }

        if ($request->filled('q')) {
            $where[] = '(r.rota_nome LIKE :search_rota OR r.motorista_nome LIKE :search_motorista OR r.caminhao_nome LIKE :search_caminhao OR r.placa LIKE :search_placa)';
            $search = '%' . trim((string) $request->query('q')) . '%';
            $bindings['search_rota'] = $search;
            $bindings['search_motorista'] = $search;
            $bindings['search_caminhao'] = $search;
            $bindings['search_placa'] = $search;
        }

        $status = trim((string) $request->query('status'));
        $statusHaving = match ($status) {
            'aberta' => 'HAVING status_codigo = 1',
            'finalizada' => 'HAVING status_codigo = 0',
            'cancelada' => 'HAVING status_codigo = 2',
            default => 'HAVING status_codigo <> 2',
        };

        $sql = $this->rotasResumoSql(implode(' AND ', $where), $statusHaving);

        return collect(DB::connection('raw')->select($sql, $bindings))
            ->map(fn ($row): array => $this->rotaParaApi((array) $row))
            ->all();
    }

    public function rotaDetalhe(string $uuid): ?array
    {
        if ($uuid === '') {
            return null;
        }

        $rota = $this->buscarRotaResumo($uuid);
        if ($rota === null) {
            return null;
        }

        $gps = $this->gps($uuid);
        $paradas = $this->paradas($uuid);
        $movimento = $this->resumoMovimento($gps, $paradas, (float) ($rota['distancia_gps_km'] ?? 0));

        return [
            'rota' => [...$rota, ...$movimento],
            'gps' => $gps,
            'paradas' => $paradas,
        ];
    }

    public function rotaColetas(string $uuid): ?array
    {
        $rota = $this->buscarRotaResumo($uuid);
        if ($rota === null) {
            return null;
        }

        return [
            'rota' => $rota,
            'coletas' => $this->coletasDaRota($uuid),
        ];
    }

    public function coletaDetalhe(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $coleta = $this->buscarColeta($id);
        if ($coleta === null) {
            return null;
        }

        return [
            'coleta' => $coleta,
            'ultimas_coletas' => $this->ultimasColetasProdutor($coleta['produtor_codigo']),
        ];
    }

    private function buscarRotaResumo(string $uuid): ?array
    {
        $latest = $this->latestColetasSql('rota_uuid = :uuid_latest_coletas');
        $gps = $this->gpsResumoSql('r.uuid = :uuid_gps_summary');
        $sql = "
            SELECT
                base.*,
                COALESCE(coletas.total_litros, 0) AS total_litros,
                COALESCE(coletas.total_coletas, 0) AS total_coletas,
                COALESCE(gps.total_pontos_gps, 0) AS total_pontos_gps,
                ROUND(COALESCE(gps.distancia_gps_km, 0), 3) AS distancia_gps_km
            FROM (
                SELECT
                    r.uuid,
                    MAX(r.id) AS id_referencia,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.rota_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS rota_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.motorista_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS motorista_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.caminhao_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS caminhao_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.placa ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS placa,
                    MIN(r.inicio) AS inicio,
                    MAX(r.fim) AS fim,
                    MIN(r.km_ini) AS km_ini,
                    MAX(r.km_fim) AS km_fim,
                    CASE
                        WHEN SUM(CASE WHEN r.status = 1 THEN 1 ELSE 0 END) > 0 THEN 1
                        WHEN SUM(CASE WHEN r.status = 0 THEN 1 ELSE 0 END) > 0 THEN 0
                        WHEN SUM(CASE WHEN r.status = 2 THEN 1 ELSE 0 END) > 0 THEN 2
                        ELSE MAX(r.status)
                    END AS status_codigo
                FROM rotas r
                WHERE r.uuid = :uuid
                GROUP BY r.uuid
            ) base
            LEFT JOIN (
                SELECT rota_uuid, COALESCE(SUM(litros), 0) AS total_litros, COUNT(*) AS total_coletas
                FROM ({$latest}) latest_coletas
                GROUP BY rota_uuid
            ) coletas ON coletas.rota_uuid COLLATE utf8mb4_general_ci = base.uuid
            LEFT JOIN ({$gps}) gps ON gps.uuid = base.uuid
            LIMIT 1
        ";

        $row = DB::connection('raw')->selectOne($sql, [
            'uuid' => $uuid,
            'uuid_latest_coletas' => $uuid,
            'uuid_gps_summary' => $uuid,
        ]);

        return $row ? $this->rotaParaApi((array) $row) : null;
    }

    private function rotasResumoSql(string $where, string $statusHaving): string
    {
        $latest = $this->latestColetasSql();
        $gps = $this->gpsResumoSql();

        return "
            SELECT
                base.*,
                COALESCE(coletas.total_litros, 0) AS total_litros,
                COALESCE(coletas.total_coletas, 0) AS total_coletas,
                COALESCE(gps.total_pontos_gps, 0) AS total_pontos_gps,
                ROUND(COALESCE(gps.distancia_gps_km, 0), 3) AS distancia_gps_km
            FROM (
                SELECT
                    r.uuid,
                    MAX(r.id) AS id_referencia,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.rota_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS rota_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.motorista_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS motorista_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.caminhao_nome ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS caminhao_nome,
                    SUBSTRING_INDEX(GROUP_CONCAT(r.placa ORDER BY r.id DESC SEPARATOR '||'), '||', 1) AS placa,
                    MIN(r.inicio) AS inicio,
                    MAX(r.fim) AS fim,
                    MIN(r.km_ini) AS km_ini,
                    MAX(r.km_fim) AS km_fim,
                    CASE
                        WHEN SUM(CASE WHEN r.status = 1 THEN 1 ELSE 0 END) > 0 THEN 1
                        WHEN SUM(CASE WHEN r.status = 0 THEN 1 ELSE 0 END) > 0 THEN 0
                        WHEN SUM(CASE WHEN r.status = 2 THEN 1 ELSE 0 END) > 0 THEN 2
                        ELSE MAX(r.status)
                    END AS status_codigo
                FROM rotas r
                WHERE {$where}
                GROUP BY r.uuid
                {$statusHaving}
            ) base
            LEFT JOIN (
                SELECT rota_uuid, COALESCE(SUM(litros), 0) AS total_litros, COUNT(*) AS total_coletas
                FROM ({$latest}) latest_coletas
                GROUP BY rota_uuid
            ) coletas ON coletas.rota_uuid COLLATE utf8mb4_general_ci = base.uuid
            LEFT JOIN ({$gps}) gps ON gps.uuid = base.uuid
            ORDER BY base.inicio DESC
            LIMIT 300
        ";
    }

    private function latestColetasSql(?string $routeFilter = null): string
    {
        $where = $routeFilter !== null ? "WHERE {$routeFilter}" : '';

        return "
            SELECT c.*
            FROM coletas c
            INNER JOIN (
                SELECT rota_uuid, produtor_codigo, MAX(id) AS id
                FROM coletas
                {$where}
                GROUP BY rota_uuid, produtor_codigo
            ) latest ON latest.id = c.id
        ";
    }

    private function gpsResumoSql(?string $routeFilter = null): string
    {
        $where = [
            'gp.lat BETWEEN -31.0 AND -25.0',
            'gp.lng BETWEEN -55.5 AND -49.0',
            'gp.accuracy_m IS NOT NULL',
            'gp.accuracy_m <= 30',
        ];

        if ($routeFilter !== null) {
            $where[] = $routeFilter;
        }

        return "
            SELECT
                gps_calc.uuid,
                COALESCE(SUM(CASE WHEN gps_calc.accepted = 1 THEN 1 ELSE 0 END), 0) AS total_pontos_gps,
                COALESCE(SUM(CASE WHEN gps_calc.accepted = 1 THEN gps_calc.distance_km ELSE 0 END), 0) AS distancia_gps_km
            FROM (
                SELECT
                    gps_ordered.uuid,
                    gps_ordered.ts,
                    gps_ordered.lat,
                    gps_ordered.lng,
                    CASE
                        WHEN gps_ordered.prev_lat IS NULL THEN 0
                        ELSE 6371 * 2 * ASIN(SQRT(
                            POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                            + COS(RADIANS(gps_ordered.prev_lat))
                            * COS(RADIANS(gps_ordered.lat))
                            * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                        ))
                    END AS distance_km,
                    CASE
                        WHEN gps_ordered.prev_lat IS NULL THEN 1
                        WHEN gps_ordered.seconds_between <= 0 THEN 0
                        WHEN gps_ordered.seconds_between < 10 THEN 0
                        WHEN (
                            6371 * 2 * ASIN(SQRT(
                                POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                + COS(RADIANS(gps_ordered.prev_lat))
                                * COS(RADIANS(gps_ordered.lat))
                                * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                            ))
                        ) < 0.025 THEN 0
                        WHEN (
                            6371 * 2 * ASIN(SQRT(
                                POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                + COS(RADIANS(gps_ordered.prev_lat))
                                * COS(RADIANS(gps_ordered.lat))
                                * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                            ))
                        ) > 0.03
                        AND (
                            (
                                6371 * 2 * ASIN(SQRT(
                                    POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                    + COS(RADIANS(gps_ordered.prev_lat))
                                    * COS(RADIANS(gps_ordered.lat))
                                    * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                                ))
                            ) / gps_ordered.seconds_between * 3600
                        ) > 120.0 THEN 0
                        ELSE 1
                    END AS accepted
                FROM (
                    SELECT
                        r.uuid,
                        gp.id,
                        gp.ts,
                        gp.lat,
                        gp.lng,
                        LAG(gp.lat) OVER (PARTITION BY r.uuid ORDER BY gp.ts ASC, gp.id ASC) AS prev_lat,
                        LAG(gp.lng) OVER (PARTITION BY r.uuid ORDER BY gp.ts ASC, gp.id ASC) AS prev_lng,
                        TIMESTAMPDIFF(
                            SECOND,
                            LAG(gp.ts) OVER (PARTITION BY r.uuid ORDER BY gp.ts ASC, gp.id ASC),
                            gp.ts
                        ) AS seconds_between
                    FROM gps_pontos gp
                    INNER JOIN rotas r ON r.id = gp.rota_id_server
                    WHERE " . implode(' AND ', $where) . "
                ) gps_ordered
            ) gps_calc
            GROUP BY gps_calc.uuid
        ";
    }

    private function gps(string $uuid): array
    {
        $rows = DB::connection('raw')->select(
            'SELECT gp.ts, gp.lat, gp.lng, gp.speed_mps, gp.accuracy_m, gp.low_accuracy
             FROM gps_pontos gp
             INNER JOIN rotas r ON r.id = gp.rota_id_server
             WHERE r.uuid = :uuid
               AND gp.lat BETWEEN -31.0 AND -25.0
               AND gp.lng BETWEEN -55.5 AND -49.0
               AND (gp.accuracy_m IS NOT NULL AND gp.accuracy_m <= 30)
             ORDER BY gp.ts ASC, gp.id ASC
             LIMIT 100000',
            ['uuid' => $uuid]
        );

        $points = collect($rows)
            ->map(fn ($row): array => [
                'ts' => (string) $row->ts,
                'lat' => (float) $row->lat,
                'lng' => (float) $row->lng,
                'speed_mps' => $row->speed_mps !== null ? (float) $row->speed_mps : null,
                'accuracy_m' => $row->accuracy_m !== null ? (float) $row->accuracy_m : null,
                'low_accuracy' => (int) ($row->low_accuracy ?? 0) === 1,
            ])
            ->all();

        return $this->filterGpsPoints($points);
    }

    private function filterGpsPoints(array $points): array
    {
        $filtered = [];
        $previous = null;
        $seen = [];

        foreach ($points as $point) {
            $key = $point['ts'] . ':' . round((float) $point['lat'], 7) . ':' . round((float) $point['lng'], 7);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            if (! $this->isPlausibleGpsTransition($previous, $point)) {
                continue;
            }

            $filtered[] = $point;
            $previous = $point;
        }

        return $filtered;
    }

    private function isPlausibleGpsTransition(?array $previous, array $current): bool
    {
        if ($previous === null) {
            return true;
        }

        $previousTs = strtotime((string) ($previous['ts'] ?? ''));
        $currentTs = strtotime((string) ($current['ts'] ?? ''));
        if ($previousTs === false || $currentTs === false || $currentTs <= $previousTs) {
            return false;
        }

        $distanceKm = $this->haversineKm(
            (float) $previous['lat'],
            (float) $previous['lng'],
            (float) $current['lat'],
            (float) $current['lng']
        );

        if (($currentTs - $previousTs) < 10 || $distanceKm < 0.025) {
            return false;
        }

        if ($distanceKm <= 0.03) {
            return true;
        }

        return ($distanceKm / ($currentTs - $previousTs)) * 3600 <= 120;
    }

    private function paradas(string $uuid): array
    {
        $rows = DB::connection('raw')->select(
            'SELECT gs.inicio_ts, gs.fim_ts, gs.duracao_seg, gs.lat, gs.lng
             FROM gps_paradas gs
             INNER JOIN rotas r ON r.id = gs.rota_id_server
             WHERE r.uuid = :uuid
             ORDER BY gs.inicio_ts ASC, gs.id ASC
             LIMIT 2000',
            ['uuid' => $uuid]
        );

        return collect($rows)
            ->map(fn ($row): array => [
                'inicio_ts' => (string) $row->inicio_ts,
                'fim_ts' => (string) $row->fim_ts,
                'duracao_seg' => (int) $row->duracao_seg,
                'lat' => (float) $row->lat,
                'lng' => (float) $row->lng,
            ])
            ->all();
    }

    private function coletasDaRota(string $uuid): array
    {
        $latest = $this->latestColetasSql('rota_uuid = :uuid_latest');
        $sql = "
            SELECT
                c.id,
                c.produtor_codigo,
                c.produtor_nome,
                c.litros,
                c.temperatura,
                c.tanque,
                c.usuario,
                c.device_id,
                c.datahora,
                {$this->coletaPontoSelectSql()},
                meta.observacoes
            FROM ({$latest}) c
            {$this->coletaPontoJoinSql('c')}
            LEFT JOIN app_coletas_meta meta ON meta.coleta_id_server = c.id
            WHERE c.rota_uuid = :uuid
            ORDER BY c.datahora ASC, c.id ASC
        ";

        return collect(DB::connection('raw')->select($sql, ['uuid' => $uuid, 'uuid_latest' => $uuid]))
            ->map(fn ($row): array => $this->coletaParaApi((array) $row))
            ->all();
    }

    private function buscarColeta(int $id): ?array
    {
        $sql = "
            SELECT
                c.id,
                c.produtor_codigo,
                c.produtor_nome,
                c.litros,
                c.temperatura,
                c.tanque,
                c.usuario,
                c.device_id,
                c.datahora,
                c.rota_uuid,
                c.rota_nome,
                {$this->coletaPontoSelectSql()},
                meta.observacoes
            FROM coletas c
            {$this->coletaPontoJoinSql('c')}
            LEFT JOIN app_coletas_meta meta ON meta.coleta_id_server = c.id
            WHERE c.id = :id
            LIMIT 1
        ";

        $row = DB::connection('raw')->selectOne($sql, ['id' => $id]);
        return $row ? $this->coletaParaApi((array) $row) : null;
    }

    private function ultimasColetasProdutor(string $produtorCodigo): array
    {
        $sql = "
            SELECT
                c.id,
                c.produtor_codigo,
                c.produtor_nome,
                c.litros,
                c.temperatura,
                c.tanque,
                c.usuario,
                c.device_id,
                c.datahora,
                c.rota_uuid,
                c.rota_nome,
                {$this->coletaPontoSelectSql()},
                meta.observacoes
            FROM coletas c
            {$this->coletaPontoJoinSql('c')}
            LEFT JOIN app_coletas_meta meta ON meta.coleta_id_server = c.id
            WHERE c.produtor_codigo = :produtor_codigo
              AND (
                    c.rota_uuid IS NULL
                    OR c.id = (
                        SELECT MAX(c2.id)
                        FROM coletas c2
                        WHERE c2.produtor_codigo COLLATE utf8mb4_unicode_ci = c.produtor_codigo COLLATE utf8mb4_unicode_ci
                          AND c2.rota_uuid = c.rota_uuid
                    )
              )
            ORDER BY c.datahora DESC, c.id DESC
            LIMIT 8
        ";

        return collect(DB::connection('raw')->select($sql, ['produtor_codigo' => $produtorCodigo]))
            ->map(fn ($row): array => $this->coletaParaApi((array) $row))
            ->all();
    }

    private function coletaPontoSelectSql(): string
    {
        return "
            COALESCE(pcm_exact.lat, pcm_same.lat) AS casa_lat,
            COALESCE(pcm_exact.lng, pcm_same.lng) AS casa_lng,
            COALESCE(pcm_exact.accuracy_m, pcm_same.accuracy_m) AS casa_accuracy_m,
            COALESCE(pcm_exact.captured_at, pcm_same.captured_at) AS casa_captured_at";
    }

    private function coletaPontoJoinSql(string $alias): string
    {
        return "
            LEFT JOIN produtor_casa_pontos pcm_exact
                ON pcm_exact.coleta_id_server = {$alias}.id
            LEFT JOIN (
                SELECT
                    c2.produtor_codigo,
                    c2.rota_uuid,
                    c2.datahora,
                    MAX(pcp.lat) AS lat,
                    MAX(pcp.lng) AS lng,
                    MAX(pcp.accuracy_m) AS accuracy_m,
                    MAX(pcp.captured_at) AS captured_at
                FROM produtor_casa_pontos pcp
                INNER JOIN coletas c2 ON c2.id = pcp.coleta_id_server
                WHERE c2.rota_uuid IS NOT NULL
                GROUP BY c2.produtor_codigo, c2.rota_uuid, c2.datahora
            ) pcm_same
                ON pcm_exact.id IS NULL
               AND pcm_same.produtor_codigo COLLATE utf8mb4_unicode_ci = {$alias}.produtor_codigo COLLATE utf8mb4_unicode_ci
               AND pcm_same.rota_uuid = {$alias}.rota_uuid
               AND pcm_same.datahora = {$alias}.datahora";
    }

    private function rotaParaApi(array $row): array
    {
        $statusCodigo = (int) ($row['status_codigo'] ?? -1);
        $statusLabel = match ($statusCodigo) {
            1 => 'Aberta',
            0 => 'Finalizada',
            2 => 'Cancelada',
            default => 'Indefinida',
        };
        $gpsKm = isset($row['distancia_gps_km']) ? round((float) $row['distancia_gps_km'], 3) : null;

        return [
            'uuid' => (string) $row['uuid'],
            'id_referencia' => (int) $row['id_referencia'],
            'rota_nome' => (string) ($row['rota_nome'] ?? ''),
            'motorista_nome' => (string) ($row['motorista_nome'] ?? ''),
            'caminhao_nome' => (string) ($row['caminhao_nome'] ?? ''),
            'placa' => (string) ($row['placa'] ?? ''),
            'inicio' => (string) ($row['inicio'] ?? ''),
            'fim' => $row['fim'] !== null ? (string) $row['fim'] : null,
            'km_ini' => $row['km_ini'] !== null ? (int) $row['km_ini'] : null,
            'km_fim' => $row['km_fim'] !== null ? (int) $row['km_fim'] : null,
            'status_codigo' => $statusCodigo,
            'status_label' => $statusLabel,
            'total_litros' => (float) ($row['total_litros'] ?? 0),
            'total_coletas' => (int) ($row['total_coletas'] ?? 0),
            'total_pontos_gps' => (int) ($row['total_pontos_gps'] ?? 0),
            'distancia_gps_km' => $gpsKm,
            'km_rodado' => $gpsKm,
            'total_paradas' => 0,
            'tempo_parado_seg' => 0,
            'tempo_movimento_seg' => 0,
            'velocidade_media_kmh' => 0,
            'velocidade_maxima_kmh' => 0,
        ];
    }

    private function coletaParaApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'produtor_codigo' => (string) $row['produtor_codigo'],
            'produtor_nome' => (string) ($row['produtor_nome'] ?? ''),
            'litros' => (float) $row['litros'],
            'temperatura' => $row['temperatura'] !== null ? (float) $row['temperatura'] : null,
            'tanque' => $row['tanque'] !== null ? (int) $row['tanque'] : null,
            'usuario' => (string) ($row['usuario'] ?? ''),
            'device_id' => (string) ($row['device_id'] ?? ''),
            'datahora' => (string) $row['datahora'],
            'rota_uuid' => $row['rota_uuid'] ?? null,
            'rota_nome' => $row['rota_nome'] ?? null,
            'casa_lat' => $row['casa_lat'] !== null ? (float) $row['casa_lat'] : null,
            'casa_lng' => $row['casa_lng'] !== null ? (float) $row['casa_lng'] : null,
            'casa_accuracy_m' => $row['casa_accuracy_m'] !== null ? (float) $row['casa_accuracy_m'] : null,
            'casa_captured_at' => $row['casa_captured_at'] !== null ? (string) $row['casa_captured_at'] : null,
            'observacoes' => $row['observacoes'] !== null ? (string) $row['observacoes'] : null,
        ];
    }

    private function resumoMovimento(array $gps, array $paradas, float $distanciaKm): array
    {
        $span = $this->gpsSpanSeconds($gps);
        $parado = min($this->stoppedSeconds($paradas), max($span, 0));
        $movimento = $span > 0 ? max($span - $parado, 0) : 0;
        $media = $movimento > 0 && $distanciaKm > 0 ? round(($distanciaKm / $movimento) * 3600, 2) : 0.0;

        return [
            'total_paradas' => count($paradas),
            'tempo_parado_seg' => $parado,
            'tempo_movimento_seg' => $movimento,
            'velocidade_media_kmh' => $media,
            'velocidade_maxima_kmh' => $this->maxSpeedKmh($gps),
        ];
    }

    private function gpsSpanSeconds(array $gps): int
    {
        if (count($gps) < 2) {
            return 0;
        }

        $first = strtotime((string) ($gps[0]['ts'] ?? ''));
        $last = strtotime((string) ($gps[count($gps) - 1]['ts'] ?? ''));

        return $first !== false && $last !== false && $last > $first ? $last - $first : 0;
    }

    private function stoppedSeconds(array $paradas): int
    {
        return array_reduce($paradas, fn (int $total, array $parada): int => $total + max((int) ($parada['duracao_seg'] ?? 0), 0), 0);
    }

    private function maxSpeedKmh(array $gps): float
    {
        $max = 0.0;
        $previous = null;

        foreach ($gps as $point) {
            if (isset($point['speed_mps']) && is_numeric($point['speed_mps'])) {
                $speed = (float) $point['speed_mps'] * 3.6;
                if ($speed >= 0 && $speed <= 140) {
                    $max = max($max, $speed);
                }
            }

            if ($previous !== null) {
                $previousTs = strtotime((string) ($previous['ts'] ?? ''));
                $currentTs = strtotime((string) ($point['ts'] ?? ''));
                if ($previousTs !== false && $currentTs !== false && $currentTs > $previousTs) {
                    $speed = ($this->haversineKm((float) $previous['lat'], (float) $previous['lng'], (float) $point['lat'], (float) $point['lng']) / ($currentTs - $previousTs)) * 3600;
                    if ($speed >= 0 && $speed <= 140) {
                        $max = max($max, $speed);
                    }
                }
            }

            $previous = $point;
        }

        return round($max, 2);
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
