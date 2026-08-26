<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Http\Controllers\Api\Embalagem\EmbalagemController;
use App\Services\Coletas\Mobile\MobileIdempotencyService;
use App\Services\Embalagem\EmbalagemService;
use DomainException;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use Tests\TestCase as LaravelTestCase;

class EmbalagemOfflineIdempotencyTest extends TestCase
{
    public const DEVICE_ID = 'ef1d0d52-099d-4e0c-ac8e-7aecdfa00da6';

    public const LOCAL_ID = '0597a7df-962e-4438-b759-0239dc71ab4d';

    public function test_returns_the_original_operation_for_a_retried_offline_scan_before_parsing_it_again(): void
    {
        $expected = ['ordem' => ['id' => 10], 'lote' => ['id' => 194]];
        $idempotency = $this->createMock(MobileIdempotencyService::class);
        $idempotency->expects(self::once())
            ->method('get')
            ->with('/api/embalagem/lotes/194/caixas', self::DEVICE_ID, self::LOCAL_ID)
            ->willReturn($expected);

        $service = new EmbalagemService($idempotency);

        self::assertSame($expected, $service->registrarCaixa(194, 'invalid-on-purpose', self::DEVICE_ID, self::LOCAL_ID));
    }

    public function test_rejects_an_incomplete_idempotency_pair(): void
    {
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('identificação da leitura offline');

        (new EmbalagemService)->registrarCaixa(194, '2000100004586', self::DEVICE_ID, null);
    }
}

class EmbalagemOfflineControllerTest extends LaravelTestCase
{
    public function test_forwards_the_stable_offline_ids_to_the_service(): void
    {
        $service = $this->createMock(EmbalagemService::class);
        $service->expects(self::once())
            ->method('registrarCaixa')
            ->with(194, '2000100004586', EmbalagemOfflineIdempotencyTest::DEVICE_ID, EmbalagemOfflineIdempotencyTest::LOCAL_ID)
            ->willReturn(['lote' => ['id' => 194]]);
        $request = Request::create('/api/embalagem/lotes/194/caixas', 'POST', [
            'codigo_barra' => '2000100004586',
            'device_id' => EmbalagemOfflineIdempotencyTest::DEVICE_ID,
            'id_local' => EmbalagemOfflineIdempotencyTest::LOCAL_ID,
        ]);

        $response = (new EmbalagemController($service))->registrarCaixa($request, 194);

        self::assertSame(200, $response->status());
        self::assertSame(194, $response->getData(true)['data']['lote']['id']);
    }
}
