<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__, 2);
$dbPath = getenv('PRODUCAO_DB_PATH') ?: $baseDir . '/database/producao_lab.sqlite';
$sqlFiles = [
    $baseDir . '/database/001_create_industrial_core.sql',
    $baseDir . '/database/002_seed_industrial_products.sql',
];

if (! is_dir(dirname($dbPath))) {
    mkdir(dirname($dbPath), 0775, true);
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = ON');

foreach ($sqlFiles as $file) {
    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException("Nao foi possivel ler {$file}");
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec($sql);
        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}

$count = (int) $pdo->query('SELECT COUNT(*) FROM industrial_products')->fetchColumn();
echo json_encode([
    'success' => true,
    'database' => $dbPath,
    'industrial_products' => $count,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
