<?php

declare(strict_types=1);

use App\Services\IndustrialProductionService;

require_once __DIR__ . '/../app/Services/IndustrialProductionService.php';

$baseDir = dirname(__DIR__, 2);
$dbDriver = getenv('PRODUCAO_DB_DRIVER') ?: 'mysql';
$processorScript = getenv('PRODUCAO_PROCESSOR_SCRIPT') ?: $baseDir . '/processor/modules/producao/calculations.py';

if ($dbDriver !== 'mysql') {
    respond(503, errorPayload('INDUSTRIAL_503', 'SQLite nao e permitido neste laboratorio. Configure MySQL.'));
}

$dsn = getenv('PRODUCAO_DB_DSN') ?: 'mysql:host=127.0.0.1;port=3306;dbname=santilac_producao_lab;charset=utf8mb4';
$user = getenv('PRODUCAO_DB_USER') ?: 'santilac_producao';
$password = getenv('PRODUCAO_DB_PASSWORD') ?: 'santilac_producao';
$pdo = new PDO($dsn, $user, $password);
$service = new IndustrialProductionService($pdo, $processorScript);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

try {
    $data = route($service, $method, $path, readJson());
    respond(statusFor($method, $path), successPayload($data));
} catch (RuntimeException $exception) {
    $decoded = json_decode($exception->getMessage(), true);
    if (is_array($decoded) && isset($decoded['code'], $decoded['message'])) {
        $status = match ($decoded['code']) {
            'INDUSTRIAL_404' => 404,
            'INDUSTRIAL_409' => 409,
            'INDUSTRIAL_422' => 422,
            'INDUSTRIAL_502' => 502,
            default => 400,
        };
        respond($status, errorPayload($decoded['code'], $decoded['message'], $decoded['fields'] ?? []));
    }
    respond(500, errorPayload('INDUSTRIAL_500', $exception->getMessage()));
} catch (Throwable $exception) {
    respond(500, errorPayload('INDUSTRIAL_500', $exception->getMessage()));
}

function route(IndustrialProductionService $service, string $method, string $path, array $payload): array
{
    if ($method === 'GET' && $path === '/health') {
        return ['service' => 'producao-industrial', 'status' => 'ok'];
    }

    if ($path === '/api/industrial/products') {
        return match ($method) {
            'GET' => ['items' => $service->products($_GET)],
            'POST' => $service->createProduct($payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/products/(\d+)$#', $path, $m) === 1) {
        return match ($method) {
            'PUT' => $service->updateProduct((int) $m[1], $payload),
            default => methodNotAllowed(),
        };
    }

    if ($path === '/api/industrial/milk-entries') {
        return match ($method) {
            'GET' => ['items' => $service->milkEntries($_GET)],
            'POST' => $service->createMilkEntry($payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/milk-entries/(\d+)$#', $path, $m) === 1) {
        return match ($method) {
            'GET' => $service->milkEntry((int) $m[1]),
            'PUT' => $service->updateMilkEntry((int) $m[1], $payload),
            default => methodNotAllowed(),
        };
    }

    if ($path === '/api/industrial/production-batches') {
        return match ($method) {
            'GET' => ['items' => $service->batches($_GET)],
            'POST' => $service->createBatch($payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/production-batches/(\d+)$#', $path, $m) === 1) {
        return match ($method) {
            'GET' => $service->batch((int) $m[1]),
            'PUT' => $service->updateBatch((int) $m[1], $payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/production-batches/(\d+)/items$#', $path, $m) === 1) {
        return match ($method) {
            'POST' => $service->addBatchItem((int) $m[1], $payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/production-batches/(\d+)/(recalculate|close|reopen)$#', $path, $m) === 1) {
        return match ($method . ':' . $m[2]) {
            'POST:recalculate' => $service->recalculateBatch((int) $m[1]),
            'POST:close' => $service->closeBatch((int) $m[1]),
            'POST:reopen' => $service->reopenBatch((int) $m[1], $payload),
            default => methodNotAllowed(),
        };
    }
    if (preg_match('#^/api/industrial/production-items/(\d+)$#', $path, $m) === 1) {
        return match ($method) {
            'PUT' => $service->updateBatchItem((int) $m[1], $payload),
            'DELETE' => $service->deleteBatchItem((int) $m[1]),
            default => methodNotAllowed(),
        };
    }

    if ($method === 'GET' && $path === '/api/industrial/stock') {
        return $service->stock();
    }
    if ($method === 'GET' && $path === '/api/industrial/stock/movements') {
        return ['items' => $service->stockMovements($_GET)];
    }
    if ($method === 'GET' && $path === '/api/industrial/reports/daily-production') {
        return $service->dailyProductionReport($_GET);
    }

    throw new RuntimeException(json_encode([
        'code' => 'INDUSTRIAL_404',
        'message' => 'Rota nao encontrada.',
        'fields' => [],
    ], JSON_UNESCAPED_UNICODE));
}

function readJson(): array
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['GET', 'DELETE'], true)) {
        return [];
    }

    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (! is_array($decoded)) {
        throw new RuntimeException(json_encode([
            'code' => 'INDUSTRIAL_400',
            'message' => 'JSON invalido.',
            'fields' => [],
        ], JSON_UNESCAPED_UNICODE));
    }

    return $decoded;
}

function successPayload(array $data): array
{
    return [
        'success' => true,
        'data' => $data,
        'error' => null,
        'meta' => new stdClass(),
    ];
}

function errorPayload(string $code, string $message, array $fields = []): array
{
    return [
        'success' => false,
        'data' => null,
        'error' => [
            'code' => $code,
            'message' => $message,
            'fields' => (object) $fields,
        ],
        'meta' => new stdClass(),
    ];
}

function respond(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit;
}

function statusFor(string $method, string $path): int
{
    if ($method === 'POST' && ! str_ends_with($path, '/recalculate') && ! str_ends_with($path, '/close') && ! str_ends_with($path, '/reopen')) {
        return 201;
    }
    return 200;
}

function methodNotAllowed(): never
{
    throw new RuntimeException(json_encode([
        'code' => 'INDUSTRIAL_405',
        'message' => 'Metodo nao permitido para esta rota.',
        'fields' => [],
    ], JSON_UNESCAPED_UNICODE));
}
