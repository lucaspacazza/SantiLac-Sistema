<?php

namespace Tests\Feature\Coletas;

use App\Services\Coletas\ColetasImportacaoService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ColetasImportacaoServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.connections.raw', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        config()->set('services.processor.url', 'http://processor.test');
        DB::purge('raw');
        Storage::fake('local');

        Schema::connection('raw')->create('produtores', function (Blueprint $table): void {
            $table->id();
            $table->string('codigo')->unique();
            $table->string('nome');
            $table->string('cidade')->nullable();
            $table->string('rota')->nullable();
            $table->boolean('diario')->default(false);
            $table->boolean('ativo')->default(true);
            $table->boolean('novo')->default(false);
            $table->boolean('projeto')->default(false);
        });

        Schema::connection('raw')->create('coletas', function (Blueprint $table): void {
            $table->id();
            $table->string('produtor_codigo');
            $table->string('produtor_nome')->nullable();
            $table->decimal('litros', 12, 3);
            $table->decimal('temperatura', 8, 2)->nullable();
            $table->string('usuario')->nullable();
            $table->string('device_id')->nullable();
            $table->dateTime('datahora');
            $table->timestamp('created_at')->nullable();
        });

        Schema::connection('raw')->create('coletas_importacoes', function (Blueprint $table): void {
            $table->id();
            $table->string('arquivo_nome');
            $table->char('arquivo_hash', 64)->unique();
            $table->unsignedInteger('registros_lidos')->default(0);
            $table->unsignedInteger('registros_criados')->default(0);
            $table->unsignedInteger('registros_ignorados')->default(0);
            $table->decimal('litros_lidos', 15, 3)->default(0);
            $table->json('resumo')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function test_imports_processor_records_and_creates_missing_producer(): void
    {
        Http::fake([
            'http://processor.test/coletas/importar-tickets' => Http::response($this->processorResult(), 200),
        ]);

        $result = app(ColetasImportacaoService::class)->importar(
            UploadedFile::fake()->createWithContent('tickets.pdf', '%PDF-1.4 test')
        );

        $this->assertSame(2, $result['summary']['registros_criados']);
        $this->assertSame(0, $result['summary']['registros_ignorados']);
        $this->assertSame(2055.0, $result['summary']['litros_importados']);
        $this->assertDatabaseHas('produtores', ['codigo' => '1403', 'nome' => 'MARINICE ANA SMANIOTTO'], 'raw');
        $this->assertDatabaseHas('coletas', [
            'produtor_codigo' => '1412',
            'produtor_nome' => 'DIRCEU SMANIOTTO',
            'litros' => 1579,
            'usuario' => 'importacao_pdf',
            'datahora' => '2026-09-02 06:00:00',
        ], 'raw');
    }

    public function test_reimport_only_ignores_collections_already_saved(): void
    {
        Http::fake([
            'http://processor.test/coletas/importar-tickets' => Http::response($this->processorResult(), 200),
        ]);
        $service = app(ColetasImportacaoService::class);

        $service->importar(UploadedFile::fake()->createWithContent('tickets.pdf', '%PDF-1.4 same'));
        $result = $service->importar(UploadedFile::fake()->createWithContent('tickets.pdf', '%PDF-1.4 same'));

        $this->assertTrue($result['summary']['ja_importado']);
        $this->assertSame(0, $result['summary']['registros_criados']);
        $this->assertSame(2, $result['summary']['registros_ignorados']);
        $this->assertSame(2, DB::connection('raw')->table('coletas')->count());
        Http::assertSentCount(2);
    }

    public function test_existing_collection_for_same_producer_and_day_is_not_overwritten(): void
    {
        DB::connection('raw')->table('coletas')->insert([
            'produtor_codigo' => '1403',
            'produtor_nome' => 'MARINICE ANA SMANIOTTO',
            'litros' => 999,
            'usuario' => 'app_mobile',
            'device_id' => 'tablet-1',
            'datahora' => '2026-09-01 07:30:00',
        ]);
        Http::fake([
            'http://processor.test/coletas/importar-tickets' => Http::response($this->processorResult(), 200),
        ]);

        $result = app(ColetasImportacaoService::class)->importar(
            UploadedFile::fake()->createWithContent('tickets.pdf', '%PDF-1.4 conflict')
        );

        $this->assertSame(1, $result['summary']['registros_criados']);
        $this->assertSame(1, $result['summary']['registros_ignorados']);
        $this->assertSame(999.0, (float) DB::connection('raw')->table('coletas')->where('produtor_codigo', '1403')->value('litros'));
    }

    private function processorResult(): array
    {
        return [
            'success' => true,
            'summary' => [
                'pages' => 2,
                'total' => 2,
                'valid' => 2,
                'errors' => 0,
                'warnings' => 0,
                'liters' => 2055,
                'declared_liters' => 2055,
                'date_start' => '2026-09-01',
                'date_end' => '2026-09-02',
            ],
            'records' => [
                ['source' => ['page' => 1], 'data' => ['produtor_codigo' => '1403', 'produtor_nome' => 'MARINICE ANA SMANIOTTO', 'data' => '2026-09-01', 'litros' => 476]],
                ['source' => ['page' => 2], 'data' => ['produtor_codigo' => '1412', 'produtor_nome' => 'DIRCEU SMANIOTTO', 'data' => '2026-09-02', 'litros' => 1579]],
            ],
            'errors' => [],
            'warnings' => [],
        ];
    }
}
