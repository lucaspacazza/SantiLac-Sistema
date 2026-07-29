<?php

namespace Tests\Feature;

use App\Services\Dashboard\PasteurizadorResumoService;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class PasteurizadorHistoricoTest extends TestCase
{
    private const CHANNEL = 'Temp.Pasteuriza';

    protected function setUp(): void
    {
        parent::setUp();

        if (! app()->environment('testing')) {
            throw new RuntimeException('O teste do pasteurizador so pode executar em APP_ENV=testing.');
        }

        config()->set('database.connections.raw', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('raw');

        if (DB::connection('raw')->getDriverName() !== 'sqlite') {
            throw new RuntimeException('A conexao raw do teste deve ser SQLite em memoria.');
        }

        $this->createPasteurizerSchema();
    }

    protected function tearDown(): void
    {
        DB::purge('raw');

        parent::tearDown();
    }

    public function test_large_period_preserves_coverage_after_deduplicating_cross_collection_samples(): void
    {
        $primaryCollectionId = $this->createCollection('2026-07-16 14:00:00');
        $duplicateCollectionId = $this->createCollection('2026-07-16 14:05:00');
        $baseTimestamp = (new DateTimeImmutable(
            '2026-07-16 00:00:00',
            new DateTimeZone('UTC')
        ))->getTimestamp();
        $firstTimestamp = gmdate('Y-m-d H:i:s', $baseTimestamp);
        $lastTimestamp = gmdate('Y-m-d H:i:s', $baseTimestamp + 50_000);

        DB::connection('raw')->transaction(function () use (
            $primaryCollectionId,
            $duplicateCollectionId,
            $baseTimestamp
        ): void {
            $batch = [];
            for ($index = 0; $index <= 50_000; $index++) {
                $batch[] = $this->sample(
                    $primaryCollectionId,
                    $index,
                    gmdate('Y-m-d H:i:s', $baseTimestamp + $index),
                    ($index % 1000) / 10
                );

                if (count($batch) === 250) {
                    DB::connection('raw')->table('pasteurizador_amostras')->insert($batch);
                    $batch = [];
                }
            }
            if ($batch !== []) {
                DB::connection('raw')->table('pasteurizador_amostras')->insert($batch);
            }

            $batch = [];
            for ($index = 0; $index < 1000; $index++) {
                $batch[] = $this->sample(
                    $duplicateCollectionId,
                    $index,
                    gmdate('Y-m-d H:i:s', $baseTimestamp + $index),
                    5000 + $index
                );

                if (count($batch) === 250) {
                    DB::connection('raw')->table('pasteurizador_amostras')->insert($batch);
                    $batch = [];
                }
            }
            if ($batch !== []) {
                DB::connection('raw')->table('pasteurizador_amostras')->insert($batch);
            }
        });

        $this->assertSame(
            51_001,
            DB::connection('raw')->table('pasteurizador_amostras')->count()
        );

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/amostras'
            .'?inicio=2026-07-16'
            .'&fim=2026-07-16'
            .'&canal=Temp.Pasteuriza'
            .'&limit=1200'
            .'&with_meta=1'
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.source_total', 50_001)
            ->assertJsonPath('data.meta.max_points', 1200)
            ->assertJsonPath('data.meta.reduced', true)
            ->assertJsonPath('data.meta.truncated', false)
            ->assertJsonPath('data.meta.first_timestamp', $firstTimestamp)
            ->assertJsonPath('data.meta.last_timestamp', $lastTimestamp)
            ->assertJsonPath('data.meta.channels.0.canal', self::CHANNEL)
            ->assertJsonPath('data.meta.channels.0.total', 50_001);

        $items = $response->json('data.items');
        $this->assertIsArray($items);
        $this->assertNotEmpty($items);
        $this->assertLessThanOrEqual(1200, count($items));
        $this->assertSame($firstTimestamp, $items[0]['timestamp_registro']);
        $this->assertSame($lastTimestamp, $items[array_key_last($items)]['timestamp_registro']);
        $this->assertEquals(5000, $items[0]['valor']);

        $keys = array_map(
            fn (array $item): string => $item['canal'].'|'.$item['timestamp_registro'],
            $items
        );
        $this->assertSame(count($keys), count(array_unique($keys)));

        $csvResponse = $this->withoutMiddleware()->get(
            '/api/pasteurizador/amostras/exportar.csv'
            .'?inicio=2026-07-16'
            .'&fim=2026-07-16'
            .'&canal=Temp.Pasteuriza'
        );
        $csvResponse->assertOk();
        $csv = $csvResponse->streamedContent();
        $this->assertSame(50_002, substr_count($csv, "\n"));
        $this->assertStringContainsString($lastTimestamp, $csv);

        $dashboard = app(PasteurizadorResumoService::class)->dia(
            Carbon::parse('2026-07-16', 'America/Sao_Paulo')
        );
        $this->assertSame(50_001, $dashboard['total_pontos']);
        $this->assertLessThanOrEqual(900, count($dashboard['pontos']));
        $this->assertSame($firstTimestamp, $dashboard['pontos'][0]['timestamp']);
        $this->assertSame(
            $lastTimestamp,
            $dashboard['pontos'][array_key_last($dashboard['pontos'])]['timestamp']
        );
    }

    public function test_cross_collection_duplicates_keep_newest_row_without_merging_channels(): void
    {
        $firstCollectionId = $this->createCollection('2026-07-16 12:01:00');
        $secondCollectionId = $this->createCollection('2026-07-16 12:02:00');

        DB::connection('raw')->table('pasteurizador_amostras')->insert([
            $this->sample($firstCollectionId, 1, '2026-07-16 12:00:00', 10),
            $this->sample($secondCollectionId, 1, '2026-07-16 12:00:00', 20),
            $this->sample(
                $firstCollectionId,
                1,
                '2026-07-16 12:00:00',
                30,
                'Temp.Saida'
            ),
        ]);

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/amostras'
            .'?inicio=2026-07-16'
            .'&fim=2026-07-16'
            .'&limit=100'
            .'&with_meta=1'
        );

        $response->assertOk()
            ->assertJsonPath('data.meta.source_total', 2)
            ->assertJsonPath('data.meta.returned', 2)
            ->assertJsonPath('data.meta.truncated', false);

        $items = collect($response->json('data.items'))->keyBy('canal');
        $this->assertCount(2, $items);
        $this->assertEquals(20, $items->get(self::CHANNEL)['valor']);
        $this->assertEquals(30, $items->get('Temp.Saida')['valor']);
    }

    public function test_ingestion_key_makes_collection_retries_idempotent(): void
    {
        $payload = [
            'ingestion_key' => str_repeat('a', 64),
            'downloaded_at' => '2026-07-17 00:05:00',
            'bytes_downloaded' => 2048,
            'period_start' => '2026-07-16 00:00:00',
            'period_end' => '2026-07-16 23:59:59',
            'raw_sha256' => str_repeat('b', 64),
            'samples' => [[
                'channel' => self::CHANNEL,
                'unit' => 'C',
                'sample_index' => 1,
                'timestamp_record' => '2026-07-16 12:00:00',
                'value' => 72.5,
            ]],
        ];

        $first = $this->withoutMiddleware()->postJson('/api/pasteurizador/coletas', $payload);
        $second = $this->withoutMiddleware()->postJson('/api/pasteurizador/coletas', $payload);

        $first->assertCreated()->assertJsonPath('success', true);
        $second->assertCreated()->assertJsonPath('success', true);
        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(
            1,
            DB::connection('raw')->table('pasteurizador_coletas')->count()
        );
        $this->assertSame(
            1,
            DB::connection('raw')->table('pasteurizador_amostras')->count()
        );
    }

    public function test_ingestion_key_accepts_progress_without_allowing_regression(): void
    {
        $payload = [
            'ingestion_key' => str_repeat('c', 64),
            'downloaded_at' => '2026-07-17 00:05:00',
            'bytes_downloaded' => 1024,
            'period_start' => '2026-07-16 00:00:00',
            'period_end' => '2026-07-16 23:59:59',
            'raw_sha256' => str_repeat('d', 64),
            'samples' => [[
                'channel' => self::CHANNEL,
                'unit' => 'C',
                'sample_index' => 1,
                'timestamp_record' => '2026-07-16 12:00:00',
                'value' => 72.5,
            ]],
        ];

        $first = $this->withoutMiddleware()->postJson('/api/pasteurizador/coletas', $payload);

        $progress = $payload;
        $progress['downloaded_at'] = '2026-07-17 01:00:00';
        $progress['bytes_downloaded'] = 4096;
        $progress['raw_sha256'] = str_repeat('e', 64);
        $progress['samples'][] = [
            'channel' => self::CHANNEL,
            'unit' => 'C',
            'sample_index' => 2,
            'timestamp_record' => '2026-07-16 12:00:01',
            'value' => 73.5,
        ];
        $second = $this->withoutMiddleware()->postJson('/api/pasteurizador/coletas', $progress);

        $regression = $payload;
        $regression['downloaded_at'] = '2026-07-18 01:00:00';
        $regression['bytes_downloaded'] = 512;
        $regression['raw_sha256'] = str_repeat('f', 64);
        $regression['samples'][0]['value'] = 999;
        $third = $this->withoutMiddleware()->postJson('/api/pasteurizador/coletas', $regression);

        $first->assertCreated();
        $second->assertCreated();
        $third->assertCreated();
        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame($second->json('data.id'), $third->json('data.id'));

        $collection = DB::connection('raw')
            ->table('pasteurizador_coletas')
            ->where('id', $first->json('data.id'))
            ->first();
        $this->assertSame(2, (int) $collection->total_amostras);
        $this->assertSame(4096, (int) $collection->bytes_baixados);
        $this->assertSame(str_repeat('e', 64), $collection->raw_sha256);
        $this->assertSame(
            [72.5, 73.5],
            DB::connection('raw')
                ->table('pasteurizador_amostras')
                ->where('coleta_id', $first->json('data.id'))
                ->orderBy('sample_index')
                ->pluck('valor')
                ->map(fn (mixed $value): float => (float) $value)
                ->all()
        );
    }

    public function test_period_date_limits_are_inclusive_at_both_ends(): void
    {
        $collectionId = $this->createCollection('2026-07-17 00:01:00');
        $this->createCollection('2026-07-15 23:59:59');
        $firstDayCollectionId = $this->createCollection('2026-07-16 00:00:00');
        $lastDayCollectionId = $this->createCollection('2026-07-16 23:59:59');
        $this->createCollection('2026-07-17 00:00:00');

        DB::connection('raw')->table('pasteurizador_amostras')->insert([
            $this->sample($collectionId, 1, '2026-07-15 23:59:59', 1),
            $this->sample($collectionId, 2, '2026-07-16 00:00:00', 2),
            $this->sample($collectionId, 3, '2026-07-16 23:59:59', 3),
            $this->sample($collectionId, 4, '2026-07-17 00:00:00', 4),
        ]);

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/amostras'
            .'?inicio=2026-07-16'
            .'&fim=2026-07-16'
            .'&canal=Temp.Pasteuriza'
            .'&limit=100'
            .'&with_meta=1'
        );

        $response->assertOk()
            ->assertJsonPath('data.meta.source_total', 2)
            ->assertJsonPath('data.meta.returned', 2)
            ->assertJsonPath('data.meta.first_timestamp', '2026-07-16 00:00:00')
            ->assertJsonPath('data.meta.last_timestamp', '2026-07-16 23:59:59')
            ->assertJsonPath('data.meta.truncated', false);

        $this->assertSame(
            ['2026-07-16 00:00:00', '2026-07-16 23:59:59'],
            array_column($response->json('data.items'), 'timestamp_registro')
        );

        $collectionsResponse = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/coletas'
            .'?inicio=2026-07-16'
            .'&fim=2026-07-16'
            .'&hora_inicio=00:00:00'
            .'&hora_fim=23:59:59'
            .'&per_page=100'
        );
        $collectionsResponse->assertOk()
            ->assertJsonPath('data.pagination.total', 2);
        $this->assertEqualsCanonicalizing(
            [$firstDayCollectionId, $lastDayCollectionId],
            array_column($collectionsResponse->json('data.items'), 'id')
        );

        $syncResponse = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/sync-state?inicio=2026-07-16&fim=2026-07-16'
        );
        $syncResponse->assertOk()
            ->assertJsonPath('data.coverage_contract_version', 2)
            ->assertJsonPath('data.coverage_basis', 'processed_period_full_day')
            ->assertJsonPath('data.series_start_date', '2026-07-15')
            ->assertJsonPath('data.covered_dates', [])
            ->assertJsonPath('data.coverage_start', null)
            ->assertJsonPath('data.coverage_end', null)
            ->assertJsonPath('data.observed_dates', ['2026-07-16'])
            ->assertJsonPath('data.uncertified_observed_dates', ['2026-07-16']);
    }

    public function test_sync_state_passes_the_requested_period_to_the_coverage_query(): void
    {
        $collectionId = $this->createCollection('2026-07-17 00:01:00');

        DB::connection('raw')->table('pasteurizador_amostras')->insert([
            $this->sample($collectionId, 1, '2026-07-15 12:00:00', 1),
            $this->sample($collectionId, 2, '2026-07-16 12:00:00', 2),
            $this->sample($collectionId, 3, '2026-07-17 12:00:00', 3),
        ]);

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/sync-state?inicio=2026-07-16&fim=2026-07-16'
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.covered_dates', [])
            ->assertJsonPath('data.coverage_start', null)
            ->assertJsonPath('data.coverage_end', null)
            ->assertJsonPath('data.observed_dates', ['2026-07-16'])
            ->assertJsonPath('data.observed_start', '2026-07-16')
            ->assertJsonPath('data.observed_end', '2026-07-16')
            ->assertJsonPath('data.observed_first_timestamp', '2026-07-16 12:00:00')
            ->assertJsonPath('data.observed_last_timestamp', '2026-07-16 12:00:00')
            ->assertJsonPath('data.uncertified_observed_dates', ['2026-07-16']);
    }

    public function test_sync_state_treats_a_processed_empty_day_as_covered(): void
    {
        DB::connection('raw')->table('pasteurizador_coletas')->insert([
            'coletado_em' => '2026-07-20 04:00:00',
            'period_start' => '2026-07-18 00:00:00',
            'period_end' => '2026-07-18 23:59:59',
            'total_amostras' => 0,
            'status' => 'processada',
            'created_at' => '2026-07-20 04:00:00',
            'updated_at' => '2026-07-20 04:00:00',
        ]);

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/sync-state?inicio=2026-07-18&fim=2026-07-18'
        );

        $response->assertOk()
            ->assertJsonPath('data.covered_dates', ['2026-07-18'])
            ->assertJsonPath('data.coverage_start', '2026-07-18')
            ->assertJsonPath('data.coverage_end', '2026-07-18')
            ->assertJsonPath('data.observed_dates', [])
            ->assertJsonPath('data.uncertified_observed_dates', []);
    }

    public function test_sync_state_certifies_a_full_processed_day_with_samples(): void
    {
        $collectionId = (int) DB::connection('raw')
            ->table('pasteurizador_coletas')
            ->insertGetId([
                'coletado_em' => '2026-07-20 04:00:00',
                'period_start' => '2026-07-17 00:00:00',
                'period_end' => '2026-07-17 23:59:59',
                'total_amostras' => 1,
                'status' => 'processada',
                'created_at' => '2026-07-20 04:00:00',
                'updated_at' => '2026-07-20 04:00:00',
            ]);
        DB::connection('raw')->table('pasteurizador_amostras')->insert(
            $this->sample($collectionId, 1, '2026-07-17 12:00:00', 71.5)
        );

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/cobertura?inicio=2026-07-17&fim=2026-07-17'
        );

        $response->assertOk()
            ->assertJsonPath('data.covered_dates', ['2026-07-17'])
            ->assertJsonPath('data.observed_dates', ['2026-07-17'])
            ->assertJsonPath('data.uncertified_observed_dates', []);
    }

    public function test_sync_state_does_not_certify_a_partial_processed_day_even_with_samples(): void
    {
        $collectionId = (int) DB::connection('raw')
            ->table('pasteurizador_coletas')
            ->insertGetId([
                'coletado_em' => '2026-07-20 04:00:00',
                'period_start' => '2026-07-19 12:00:00',
                'period_end' => '2026-07-19 23:59:59',
                'total_amostras' => 1,
                'status' => 'processada',
                'created_at' => '2026-07-20 04:00:00',
                'updated_at' => '2026-07-20 04:00:00',
            ]);
        DB::connection('raw')->table('pasteurizador_amostras')->insert(
            $this->sample($collectionId, 1, '2026-07-19 23:59:59', 72.5)
        );

        $response = $this->withoutMiddleware()->getJson(
            '/api/pasteurizador/cobertura?inicio=2026-07-19&fim=2026-07-19'
        );

        $response->assertOk()
            ->assertJsonPath('data.covered_dates', [])
            ->assertJsonPath('data.observed_dates', ['2026-07-19'])
            ->assertJsonPath('data.uncertified_observed_dates', ['2026-07-19']);
    }

    public function test_sync_state_never_certifies_the_current_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-29 10:00:00', 'America/Sao_Paulo'));

        try {
            DB::connection('raw')->table('pasteurizador_coletas')->insert([
                'coletado_em' => '2026-07-29 10:00:00',
                'period_start' => '2026-07-29 00:00:00',
                'period_end' => '2026-07-29 23:59:59',
                'total_amostras' => 0,
                'status' => 'processada',
                'created_at' => '2026-07-29 10:00:00',
                'updated_at' => '2026-07-29 10:00:00',
            ]);

            $response = $this->withoutMiddleware()->getJson(
                '/api/pasteurizador/cobertura?inicio=2026-07-29&fim=2026-07-29'
            );

            $response->assertOk()
                ->assertJsonPath('data.covered_dates', [])
                ->assertJsonPath('data.coverage_end', null);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createPasteurizerSchema(): void
    {
        Schema::connection('raw')->create('pasteurizador_coletas', function (Blueprint $table): void {
            $table->id();
            $table->char('ingestion_key', 64)->nullable()->unique();
            $table->string('equipamento', 80)->default('pasteurizador');
            $table->string('origem', 40)->default('fieldlogger_modbus');
            $table->string('arquivo_remoto', 80)->default('2:/24085425/MemFlash.fl');
            $table->string('arquivo_bruto_path')->nullable();
            $table->dateTime('coletado_em');
            $table->dateTime('period_start')->nullable();
            $table->dateTime('period_end')->nullable();
            $table->char('raw_sha256', 64)->nullable();
            $table->unsignedInteger('bytes_baixados')->default(0);
            $table->unsignedInteger('total_amostras')->default(0);
            $table->string('status', 40)->default('processada');
            $table->text('mensagem_erro')->nullable();
            $table->timestamps();
        });

        Schema::connection('raw')->create('pasteurizador_amostras', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('coleta_id')
                ->constrained('pasteurizador_coletas')
                ->cascadeOnDelete();
            $table->string('equipamento', 80)->default('pasteurizador');
            $table->string('canal', 80);
            $table->string('unidade', 20)->nullable();
            $table->unsignedInteger('sample_index');
            $table->unsignedInteger('raw_offset')->nullable();
            $table->dateTime('timestamp_registro')->nullable();
            $table->decimal('valor', 12, 4);
            $table->decimal('qualidade', 12, 4)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(
                ['coleta_id', 'canal', 'sample_index'],
                'uq_pasteurizador_amostra_canal'
            );
            $table->index(
                ['timestamp_registro', 'canal', 'id'],
                'idx_pasteurizador_amostras_timestamp_canal_id'
            );
            $table->index(
                ['canal', 'timestamp_registro', 'id'],
                'idx_pasteurizador_amostras_canal_timestamp_id'
            );
        });
    }

    private function createCollection(string $collectedAt): int
    {
        return (int) DB::connection('raw')
            ->table('pasteurizador_coletas')
            ->insertGetId([
                'coletado_em' => $collectedAt,
                'created_at' => $collectedAt,
                'updated_at' => $collectedAt,
            ]);
    }

    private function sample(
        int $collectionId,
        int $sampleIndex,
        string $timestamp,
        float|int $value,
        string $channel = self::CHANNEL
    ): array {
        return [
            'coleta_id' => $collectionId,
            'equipamento' => 'pasteurizador',
            'canal' => $channel,
            'unidade' => 'C',
            'sample_index' => $sampleIndex,
            'raw_offset' => $sampleIndex,
            'timestamp_registro' => $timestamp,
            'valor' => $value,
            'qualidade' => null,
        ];
    }
}
