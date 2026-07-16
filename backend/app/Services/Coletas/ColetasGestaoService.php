<?php

namespace App\Services\Coletas;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ColetasGestaoService
{
    private const MIN_SECONDS_BETWEEN_GPS_POINTS = 10;
    private const MIN_DISTANCE_KM_BETWEEN_GPS_POINTS = 0.025;
    private const MAX_GPS_ACCURACY_M = 30;
    private const MAX_TRUCK_SPEED_KMH = 120;
    private const GPS_JITTER_KM = 0.03;
    private const MAX_SEGMENT_GAP_SECONDS = 300;
    private const MAX_SEGMENT_GAP_KM = 3.0;

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
            default => 'HAVING status_codigo <> 2',
        };

        $sql = $this->rotasResumoSql(implode(' AND ', $where), $statusHaving);

        return collect(DB::connection('raw')->select($sql, $bindings))
            ->map(fn ($row): array => $this->rotaParaApi((array) $row))
            ->all();
    }

    public function resumoMensal(): array
    {
        $rows = DB::connection('raw')->select("
            SELECT
                DATE_FORMAT(datahora, '%Y-%m') AS mes,
                COALESCE(SUM(litros), 0) AS litros,
                COUNT(*) AS coletas,
                COUNT(DISTINCT DATE(datahora)) AS dias_coleta,
                COUNT(DISTINCT NULLIF(TRIM(produtor_codigo), '')) AS produtores
            FROM coletas
            WHERE datahora IS NOT NULL
            GROUP BY DATE_FORMAT(datahora, '%Y-%m')
            ORDER BY mes ASC
        ");

        $serie = collect($rows)
            ->map(fn ($row): array => [
                'mes' => (string) $row->mes,
                'litros' => (float) $row->litros,
                'coletas' => (int) $row->coletas,
                'dias_coleta' => (int) $row->dias_coleta,
                'produtores' => (int) $row->produtores,
            ])
            ->values()
            ->all();

        $porMes = collect($serie)->keyBy('mes');
        $mesAtual = now()->format('Y-m');
        $mesAnterior = now()->subMonthNoOverflow()->format('Y-m');

        return [
            'mes_atual' => $porMes->get($mesAtual, $this->mesVazio($mesAtual)),
            'mes_anterior' => $porMes->get($mesAnterior, $this->mesVazio($mesAnterior)),
            'serie' => $serie,
        ];
    }

    public function resumoMensalProdutor(string $produtorCodigo, int $meses = 12): array
    {
        $meses = min(max($meses, 2), 24);

        if (! Schema::connection('raw')->hasTable('coletas')) {
            return [
                'periodo_atual' => null,
                'periodo_anterior' => null,
                'periodo_parcial' => false,
                'dia_comparacao' => null,
                'anterior_comparavel_litros' => null,
                'anterior_comparavel_coletas' => 0,
                'ultima_coleta' => null,
                'serie_mensal' => [],
            ];
        }

        $connection = DB::connection('raw');
        $latestRouteCollectionIds = $connection->table('coletas')
            ->where('produtor_codigo', $produtorCodigo)
            ->whereNotNull('rota_uuid')
            ->whereNotNull('datahora')
            ->whereRaw("TRIM(rota_uuid) <> ''")
            ->selectRaw('MAX(id) AS id')
            ->groupBy('produtor_codigo', 'rota_uuid')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
        $canonicalCollections = $connection->table('coletas')
            ->where('produtor_codigo', $produtorCodigo)
            ->whereNotNull('datahora')
            ->where(function ($query) use ($latestRouteCollectionIds): void {
                $query->whereNull('rota_uuid')
                    ->orWhereRaw("TRIM(rota_uuid) = ''");

                if ($latestRouteCollectionIds !== []) {
                    $query->orWhereIn('id', $latestRouteCollectionIds);
                }
            });
        $latestDate = (clone $canonicalCollections)->max('datahora');

        if ($latestDate === null) {
            return [
                'periodo_atual' => null,
                'periodo_anterior' => null,
                'periodo_parcial' => false,
                'dia_comparacao' => null,
                'anterior_comparavel_litros' => null,
                'anterior_comparavel_coletas' => 0,
                'ultima_coleta' => null,
                'serie_mensal' => [],
            ];
        }

        $reference = CarbonImmutable::parse((string) $latestDate)->startOfMonth();
        $start = $reference->subMonths($meses - 1);
        $end = $reference->addMonth();

        $rows = (clone $canonicalCollections)
            ->select('id', 'litros', 'datahora')
            ->where('datahora', '>=', $start->format('Y-m-d H:i:s'))
            ->where('datahora', '<', $end->format('Y-m-d H:i:s'))
            ->orderBy('datahora')
            ->get();

        $rowsByMonth = $rows->groupBy(
            fn ($row): string => CarbonImmutable::parse((string) $row->datahora)->format('Y-m')
        );
        $previousPeriod = $reference->subMonth()->format('Y-m');
        $isPartial = $reference->format('Y-m') === CarbonImmutable::now(config('app.timezone'))->format('Y-m');
        $comparisonDay = $isPartial ? CarbonImmutable::parse((string) $latestDate)->day : null;
        $previousRows = $rowsByMonth->get($previousPeriod, collect());
        $comparablePreviousRows = $comparisonDay !== null
            ? $previousRows->filter(
                fn ($row): bool => CarbonImmutable::parse((string) $row->datahora)->day <= $comparisonDay
            )
            : $previousRows;
        $comparablePreviousCollections = $comparablePreviousRows->count();
        $comparablePreviousLiters = $comparablePreviousCollections > 0
            ? (float) $comparablePreviousRows->sum(fn ($row): float => (float) $row->litros)
            : null;
        $series = [];

        for ($index = 0; $index < $meses; $index++) {
            $month = $start->addMonths($index);
            $period = $month->format('Y-m');
            $monthRows = $rowsByMonth->get($period, collect());
            $total = (float) $monthRows->sum(fn ($row): float => (float) $row->litros);
            $collections = $monthRows->count();
            $days = $monthRows
                ->map(fn ($row): string => CarbonImmutable::parse((string) $row->datahora)->format('Y-m-d'))
                ->unique()
                ->count();

            $series[] = [
                'periodo' => $period,
                'litros' => round($total, 3),
                'coletas' => $collections,
                'dias_coleta' => $days,
                'media_por_coleta' => $collections > 0 ? round($total / $collections, 3) : null,
            ];
        }

        return [
            'periodo_atual' => $reference->format('Y-m'),
            'periodo_anterior' => $previousPeriod,
            'periodo_parcial' => $isPartial,
            'dia_comparacao' => $comparisonDay,
            'anterior_comparavel_litros' => $comparablePreviousLiters !== null ? round($comparablePreviousLiters, 3) : null,
            'anterior_comparavel_coletas' => $comparablePreviousCollections,
            'ultima_coleta' => (string) $latestDate,
            'serie_mensal' => $series,
        ];
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
                HAVING status_codigo <> 2
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

    private function mesVazio(string $mes): array
    {
        return [
            'mes' => $mes,
            'litros' => 0.0,
            'coletas' => 0,
            'dias_coleta' => 0,
            'produtores' => 0,
        ];
    }

    private function gpsResumoSql(?string $routeFilter = null): string
    {
        $where = [
            'gp.lat BETWEEN -31.0 AND -25.0',
            'gp.lng BETWEEN -55.5 AND -49.0',
            'gp.accuracy_m IS NOT NULL',
            'gp.accuracy_m <= ' . self::MAX_GPS_ACCURACY_M,
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
                        WHEN gps_ordered.seconds_between < " . self::MIN_SECONDS_BETWEEN_GPS_POINTS . " THEN 0
                        WHEN gps_ordered.seconds_between > " . self::MAX_SEGMENT_GAP_SECONDS . " THEN 0
                        WHEN (
                            6371 * 2 * ASIN(SQRT(
                                POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                + COS(RADIANS(gps_ordered.prev_lat))
                                * COS(RADIANS(gps_ordered.lat))
                                * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                            ))
                        ) < " . self::MIN_DISTANCE_KM_BETWEEN_GPS_POINTS . " THEN 0
                        WHEN (
                            6371 * 2 * ASIN(SQRT(
                                POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                + COS(RADIANS(gps_ordered.prev_lat))
                                * COS(RADIANS(gps_ordered.lat))
                                * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                            ))
                        ) > " . self::MAX_SEGMENT_GAP_KM . " THEN 0
                        WHEN (
                            6371 * 2 * ASIN(SQRT(
                                POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                + COS(RADIANS(gps_ordered.prev_lat))
                                * COS(RADIANS(gps_ordered.lat))
                                * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                            ))
                        ) > " . self::GPS_JITTER_KM . "
                        AND (
                            (
                                6371 * 2 * ASIN(SQRT(
                                    POWER(SIN(RADIANS(gps_ordered.lat - gps_ordered.prev_lat) / 2), 2)
                                    + COS(RADIANS(gps_ordered.prev_lat))
                                    * COS(RADIANS(gps_ordered.lat))
                                    * POWER(SIN(RADIANS(gps_ordered.lng - gps_ordered.prev_lng) / 2), 2)
                                ))
                            ) / gps_ordered.seconds_between * 3600
                        ) > " . self::MAX_TRUCK_SPEED_KMH . " THEN 0
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
               AND (gp.accuracy_m IS NOT NULL AND gp.accuracy_m <= ' . self::MAX_GPS_ACCURACY_M . ')
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
        $segment = 0;

        foreach ($points as $point) {
            $key = $point['ts'] . ':' . round((float) $point['lat'], 7) . ':' . round((float) $point['lng'], 7);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $decision = $this->gpsTransitionDecision($previous, $point);
            if ($decision === 'drop') {
                continue;
            }
            if ($decision === 'split') {
                $segment++;
            }

            $point['segment'] = $segment;
            $filtered[] = $point;
            $previous = $point;
        }

        return $filtered;
    }

    private function isPlausibleGpsTransition(?array $previous, array $current): bool
    {
        return $this->gpsTransitionDecision($previous, $current) !== 'drop';
    }

    private function gpsTransitionDecision(?array $previous, array $current): string
    {
        if ($previous === null) {
            return 'keep';
        }

        $previousTs = strtotime((string) ($previous['ts'] ?? ''));
        $currentTs = strtotime((string) ($current['ts'] ?? ''));
        if ($previousTs === false || $currentTs === false || $currentTs <= $previousTs) {
            return 'drop';
        }

        $distanceKm = $this->haversineKm(
            (float) $previous['lat'],
            (float) $previous['lng'],
            (float) $current['lat'],
            (float) $current['lng']
        );

        $seconds = $currentTs - $previousTs;
        if ($seconds < self::MIN_SECONDS_BETWEEN_GPS_POINTS || $distanceKm < self::MIN_DISTANCE_KM_BETWEEN_GPS_POINTS) {
            return 'drop';
        }

        if ($distanceKm > self::GPS_JITTER_KM && ($distanceKm / $seconds) * 3600 > self::MAX_TRUCK_SPEED_KMH) {
            return 'drop';
        }

        if ($seconds > self::MAX_SEGMENT_GAP_SECONDS || $distanceKm > self::MAX_SEGMENT_GAP_KM) {
            return 'split';
        }

        return 'keep';
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
            cp.lat AS ponto_lat,
            cp.lng AS ponto_lng,
            cp.accuracy_m AS ponto_accuracy_m,
            cp.captured_at AS ponto_captured_at";
    }

    private function coletaPontoJoinSql(string $alias): string
    {
        return "
            LEFT JOIN coleta_pontos cp
                ON cp.coleta_id_server = {$alias}.id";
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
            'ponto_lat' => $row['ponto_lat'] !== null ? (float) $row['ponto_lat'] : null,
            'ponto_lng' => $row['ponto_lng'] !== null ? (float) $row['ponto_lng'] : null,
            'ponto_accuracy_m' => $row['ponto_accuracy_m'] !== null ? (float) $row['ponto_accuracy_m'] : null,
            'ponto_captured_at' => $row['ponto_captured_at'] !== null ? (string) $row['ponto_captured_at'] : null,
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
