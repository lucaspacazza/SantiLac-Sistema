<?php

namespace Tests\Unit\Coletas;

use App\Services\Coletas\ColetasImportacaoService;
use PHPUnit\Framework\TestCase;

class ColetasImportacaoServiceUnitTest extends TestCase
{
    public function test_normalizes_a_processor_record_for_collection_storage(): void
    {
        $record = ColetasImportacaoService::normalizarRegistro([
            'source' => ['page' => 7],
            'data' => [
                'produtor_codigo' => ' 1403 ',
                'produtor_nome' => '  MARINICE ANA SMANIOTTO  ',
                'data' => '2026-09-09',
                'litros' => 476,
            ],
        ]);

        $this->assertSame([
            'produtor_codigo' => '1403',
            'produtor_nome' => 'MARINICE ANA SMANIOTTO',
            'data' => '2026-09-09',
            'litros' => 476.0,
            'pagina' => 7,
        ], $record);
    }

    public function test_rejects_invalid_processor_record(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        ColetasImportacaoService::normalizarRegistro([
            'source' => ['page' => 1],
            'data' => [
                'produtor_codigo' => '',
                'produtor_nome' => 'SEM CODIGO',
                'data' => '09/09/2026',
                'litros' => -1,
            ],
        ]);
    }
}
