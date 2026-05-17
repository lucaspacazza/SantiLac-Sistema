<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__, 2);
$dbDriver = getenv('PRODUCAO_DB_DRIVER') ?: 'mysql';

if ($dbDriver !== 'mysql') {
    throw new RuntimeException('SQLite nao e permitido. Use MySQL.');
}

$database = getenv('PRODUCAO_DB_DATABASE') ?: 'santilac_producao_lab';
$dsn = getenv('PRODUCAO_DB_DSN') ?: 'mysql:host=127.0.0.1;port=3306;dbname=' . $database . ';charset=utf8mb4';
$user = getenv('PRODUCAO_DB_USER') ?: 'santilac_producao';
$password = getenv('PRODUCAO_DB_PASSWORD') ?: 'santilac_producao';
$sqlFiles = [
    $baseDir . '/database/001_create_industrial_core_mysql.sql',
    $baseDir . '/database/002_seed_industrial_products_mysql.sql',
];

$pdo = new PDO($dsn, $user, $password);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

foreach ($sqlFiles as $file) {
    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException("Nao foi possivel ler {$file}");
    }

    $pdo->exec($sql);
}

$count = (int) $pdo->query('SELECT COUNT(*) FROM industrial_products')->fetchColumn();
echo json_encode([
    'success' => true,
    'database' => $database,
    'industrial_products' => $count,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
