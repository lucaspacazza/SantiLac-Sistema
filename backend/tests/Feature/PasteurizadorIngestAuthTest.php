<?php

namespace Tests\Feature;

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
}
