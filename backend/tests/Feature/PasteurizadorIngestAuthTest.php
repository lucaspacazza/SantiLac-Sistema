<?php

namespace Tests\Feature;

use Illuminate\Support\Carbon;
use Tests\TestCase;

class PasteurizadorIngestAuthTest extends TestCase
{
    public function test_ingest_rejects_request_without_api_key(): void
    {
        config(['services.santilac.api_key' => 'pasteurizador-test-key']);

        $response = $this->postJson('/api/pasteurizador/coletas', []);

        $response->assertUnauthorized();
    }

    public function test_ingest_accepts_configured_bearer_key_before_validation(): void
    {
        config(['services.santilac.api_key' => 'pasteurizador-test-key']);

        $response = $this
            ->withToken('pasteurizador-test-key')
            ->postJson('/api/pasteurizador/coletas', []);

        $response->assertUnprocessable();
    }

    public function test_ingest_rejects_invalid_reliability_metadata(): void
    {
        config(['services.santilac.api_key' => 'pasteurizador-test-key']);

        $response = $this
            ->withToken('pasteurizador-test-key')
            ->postJson('/api/pasteurizador/coletas', [
                'ingestion_key' => 'not-a-sha256',
                'downloaded_at' => '2026-07-17 00:00:00',
                'bytes_downloaded' => 1,
                'period_start' => '2026-07-17 00:00:00',
                'period_end' => '2026-07-16 00:00:00',
                'raw_sha256' => 'invalid',
                'status' => 'desconhecido',
                'samples' => [],
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors([
                'ingestion_key',
                'period_end',
                'raw_sha256',
                'status',
            ]);
    }

    public function test_ingest_rejects_an_open_period_and_download_before_period_end(): void
    {
        config(['services.santilac.api_key' => 'pasteurizador-test-key']);
        Carbon::setTestNow(Carbon::parse('2026-07-29 10:00:00', 'America/Sao_Paulo'));

        try {
            $openPeriod = $this
                ->withToken('pasteurizador-test-key')
                ->postJson('/api/pasteurizador/coletas', [
                    'downloaded_at' => '2026-07-30 00:00:00',
                    'bytes_downloaded' => 1,
                    'period_start' => '2026-07-29 00:00:00',
                    'period_end' => '2026-07-29 23:59:59',
                    'samples' => [],
                ]);
            $openPeriod->assertUnprocessable()
                ->assertJsonValidationErrors(['period_end']);

            $downloadBeforeEnd = $this
                ->withToken('pasteurizador-test-key')
                ->postJson('/api/pasteurizador/coletas', [
                    'downloaded_at' => '2026-07-27 20:00:00',
                    'bytes_downloaded' => 1,
                    'period_start' => '2026-07-27 00:00:00',
                    'period_end' => '2026-07-27 23:59:59',
                    'samples' => [],
                ]);
            $downloadBeforeEnd->assertUnprocessable()
                ->assertJsonValidationErrors(['downloaded_at']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_ingest_rejects_malformed_samples_instead_of_persisting_defaults(): void
    {
        config(['services.santilac.api_key' => 'pasteurizador-test-key']);
        Carbon::setTestNow(Carbon::parse('2026-07-29 10:00:00', 'America/Sao_Paulo'));

        try {
            $response = $this
                ->withToken('pasteurizador-test-key')
                ->postJson('/api/pasteurizador/coletas', [
                    'downloaded_at' => '2026-07-28 04:00:00',
                    'bytes_downloaded' => 1,
                    'period_start' => '2026-07-27 00:00:00',
                    'period_end' => '2026-07-27 23:59:59',
                    'samples' => [
                        [
                            'channel' => '',
                            'sample_index' => -1,
                            'timestamp_record' => null,
                            'value' => 'not-a-number',
                        ],
                    ],
                ]);

            $response->assertUnprocessable()
                ->assertJsonValidationErrors([
                    'samples.0.channel',
                    'samples.0.sample_index',
                    'samples.0.timestamp_record',
                    'samples.0.value',
                ]);
        } finally {
            Carbon::setTestNow();
        }
    }
}
