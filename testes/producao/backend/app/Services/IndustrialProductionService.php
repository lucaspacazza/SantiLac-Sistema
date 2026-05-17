<?php

declare(strict_types=1);

namespace App\Services;

use PDO;
use RuntimeException;
use Throwable;

final class IndustrialProductionService
{
    private const BATCH_STATUSES = ['draft', 'closed', 'reopened', 'cancelled'];
    private const PRODUCTION_TYPES = ['produced', 'packed', 'fractioned', 'returned', 'loss', 'point', 'adjustment'];

    public function __construct(
        private readonly PDO $pdo,
        private readonly string $processorScript
    ) {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    }

    public function products(array $query = []): array
    {
        $sql = 'SELECT * FROM industrial_products WHERE 1 = 1';
        $params = [];

        if (isset($query['active'])) {
            $sql .= ' AND active = :active';
            $params['active'] = $this->boolInt($query['active']);
        }

        if (! empty($query['q'])) {
            $sql .= ' AND (name LIKE :q OR code LIKE :q OR category LIKE :q)';
            $params['q'] = '%' . trim((string) $query['q']) . '%';
        }

        $sql .= ' ORDER BY category, name';

        return array_map([$this, 'formatProduct'], $this->fetchAll($sql, $params));
    }

    public function createProduct(array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));
        if ($name === '' || $category === '') {
            $this->fail('INDUSTRIAL_422', 'Nome e categoria do produto sao obrigatorios.', [
                'name' => $name === '' ? 'obrigatorio' : null,
                'category' => $category === '' ? 'obrigatorio' : null,
            ]);
        }

        $code = trim((string) ($payload['code'] ?? $this->slugCode($name)));
        $stmt = $this->pdo->prepare(
            'INSERT INTO industrial_products (code, name, category, unit, active, updated_at)
             VALUES (:code, :name, :category, :unit, :active, CURRENT_TIMESTAMP)'
        );
        $stmt->execute([
            'code' => $code,
            'name' => $name,
            'category' => $category,
            'unit' => trim((string) ($payload['unit'] ?? 'kg')) ?: 'kg',
            'active' => $this->boolInt($payload['active'] ?? true),
        ]);

        return $this->product((int) $this->pdo->lastInsertId());
    }

    public function updateProduct(int $id, array $payload): array
    {
        $current = $this->product($id);
        $stmt = $this->pdo->prepare(
            'UPDATE industrial_products
             SET code = :code, name = :name, category = :category, unit = :unit, active = :active, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'code' => trim((string) ($payload['code'] ?? $current['code'])),
            'name' => trim((string) ($payload['name'] ?? $current['name'])),
            'category' => trim((string) ($payload['category'] ?? $current['category'])),
            'unit' => trim((string) ($payload['unit'] ?? $current['unit'])),
            'active' => $this->boolInt($payload['active'] ?? $current['active']),
        ]);

        return $this->product($id);
    }

    public function product(int $id): array
    {
        $row = $this->fetchOne('SELECT * FROM industrial_products WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            $this->fail('INDUSTRIAL_404', 'Produto industrial nao encontrado.');
        }

        return $this->formatProduct($row);
    }

    public function milkEntries(array $query = []): array
    {
        $sql = 'SELECT * FROM milk_entries WHERE 1 = 1';
        $params = [];
        $this->dateRangeSql($sql, $params, 'entry_date', $query);
        $sql .= ' ORDER BY entry_date DESC, id DESC';

        return array_map([$this, 'formatMilkEntry'], $this->fetchAll($sql, $params));
    }

    public function createMilkEntry(array $payload): array
    {
        $data = $this->milkEntryPayload($payload);
        $stmt = $this->pdo->prepare(
            'INSERT INTO milk_entries
             (entry_date, liters_received, liters_processed, liters_to_cream, liters_surplus, difference_liters, milk_balance, notes, updated_at)
             VALUES (:entry_date, :liters_received, :liters_processed, :liters_to_cream, :liters_surplus, :difference_liters, :milk_balance, :notes, CURRENT_TIMESTAMP)'
        );
        $stmt->execute($data);

        return $this->milkEntry((int) $this->pdo->lastInsertId());
    }

    public function updateMilkEntry(int $id, array $payload): array
    {
        $this->milkEntry($id);
        $data = $this->milkEntryPayload($payload);
        $data['id'] = $id;
        $stmt = $this->pdo->prepare(
            'UPDATE milk_entries
             SET entry_date = :entry_date, liters_received = :liters_received, liters_processed = :liters_processed,
                 liters_to_cream = :liters_to_cream, liters_surplus = :liters_surplus, difference_liters = :difference_liters,
                 milk_balance = :milk_balance, notes = :notes, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute($data);

        return $this->milkEntry($id);
    }

    public function milkEntry(int $id): array
    {
        $row = $this->fetchOne('SELECT * FROM milk_entries WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            $this->fail('INDUSTRIAL_404', 'Entrada de leite nao encontrada.');
        }

        return $this->formatMilkEntry($row);
    }

    public function batches(array $query = []): array
    {
        $sql = 'SELECT * FROM production_batches WHERE 1 = 1';
        $params = [];
        $this->dateRangeSql($sql, $params, 'batch_date', $query);

        if (! empty($query['status'])) {
            $sql .= ' AND status = :status';
            $params['status'] = (string) $query['status'];
        }

        $sql .= ' ORDER BY batch_date DESC, id DESC';

        return array_map(fn (array $row): array => $this->formatBatch($row, false), $this->fetchAll($sql, $params));
    }

    public function createBatch(array $payload): array
    {
        $data = $this->batchPayload($payload);
        $stmt = $this->pdo->prepare(
            'INSERT INTO production_batches (batch_date, milk_entry_id, liters_processed, status, notes, updated_at)
             VALUES (:batch_date, :milk_entry_id, :liters_processed, :status, :notes, CURRENT_TIMESTAMP)'
        );
        $stmt->execute($data);

        return $this->batch((int) $this->pdo->lastInsertId());
    }

    public function updateBatch(int $id, array $payload): array
    {
        $batch = $this->batch($id);
        $this->ensureBatchEditable($batch);

        $data = $this->batchPayload($payload + $batch);
        $data['id'] = $id;
        $stmt = $this->pdo->prepare(
            'UPDATE production_batches
             SET batch_date = :batch_date, milk_entry_id = :milk_entry_id, liters_processed = :liters_processed,
                 status = :status, notes = :notes, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute($data);

        return $this->batch($id);
    }

    public function batch(int $id): array
    {
        $row = $this->fetchOne('SELECT * FROM production_batches WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            $this->fail('INDUSTRIAL_404', 'Lote de producao nao encontrado.');
        }

        return $this->formatBatch($row, true);
    }

    public function addBatchItem(int $batchId, array $payload): array
    {
        $batch = $this->batch($batchId);
        $this->ensureBatchEditable($batch);
        $data = $this->itemPayload($payload);
        $data['batch_id'] = $batchId;

        $stmt = $this->pdo->prepare(
            'INSERT INTO production_batch_items
             (batch_id, product_id, production_type, pieces_count, weight_kg, notes, updated_at)
             VALUES (:batch_id, :product_id, :production_type, :pieces_count, :weight_kg, :notes, CURRENT_TIMESTAMP)'
        );
        $stmt->execute($data);

        return $this->batchItem((int) $this->pdo->lastInsertId());
    }

    public function updateBatchItem(int $id, array $payload): array
    {
        $current = $this->batchItem($id);
        $batch = $this->batch((int) $current['batch_id']);
        $this->ensureBatchEditable($batch);

        $data = $this->itemPayload($payload + $current);
        $data['id'] = $id;
        $stmt = $this->pdo->prepare(
            'UPDATE production_batch_items
             SET product_id = :product_id, production_type = :production_type, pieces_count = :pieces_count,
                 weight_kg = :weight_kg, notes = :notes, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute($data);

        return $this->batchItem($id);
    }

    public function deleteBatchItem(int $id): array
    {
        $current = $this->batchItem($id);
        $batch = $this->batch((int) $current['batch_id']);
        $this->ensureBatchEditable($batch);
        $stmt = $this->pdo->prepare('DELETE FROM production_batch_items WHERE id = :id');
        $stmt->execute(['id' => $id]);

        return ['deleted' => true, 'id' => $id];
    }

    public function recalculateBatch(int $id): array
    {
        $batchRow = $this->fetchOne('SELECT * FROM production_batches WHERE id = :id', ['id' => $id]);
        if ($batchRow === null) {
            $this->fail('INDUSTRIAL_404', 'Lote de producao nao encontrado.');
        }

        $payload = [
            'batch_id' => $id,
            'liters_processed' => (float) $batchRow['liters_processed'],
            'items' => $this->itemsForProcessor($id),
        ];
        $result = $this->runProcessor('daily-production', $payload);
        $data = $result['data'];

        $stmt = $this->pdo->prepare(
            'INSERT INTO production_calculation_results
             (batch_id, liters_processed, total_produced_kg, yield_liters_per_kg, yield_kg_per_liter,
              average_piece_weight, result_payload, calculated_at, updated_at)
             VALUES (:batch_id, :liters_processed, :total_produced_kg, :yield_liters_per_kg, :yield_kg_per_liter,
              :average_piece_weight, :result_payload, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
              liters_processed = VALUES(liters_processed),
              total_produced_kg = VALUES(total_produced_kg),
              yield_liters_per_kg = VALUES(yield_liters_per_kg),
              yield_kg_per_liter = VALUES(yield_kg_per_liter),
              average_piece_weight = VALUES(average_piece_weight),
              result_payload = VALUES(result_payload),
              calculated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            'batch_id' => $id,
            'liters_processed' => $data['liters_processed'],
            'total_produced_kg' => $data['total_produced_kg'],
            'yield_liters_per_kg' => $data['yield_liters_per_kg'],
            'yield_kg_per_liter' => $data['yield_kg_per_liter'],
            'average_piece_weight' => $data['average_piece_weight'],
            'result_payload' => json_encode($data, JSON_UNESCAPED_UNICODE),
        ]);

        return $this->batch($id);
    }

    public function closeBatch(int $id): array
    {
        return $this->transaction(function () use ($id): array {
            $batch = $this->batch($id);
            if (! in_array($batch['status'], ['draft', 'reopened'], true)) {
                $this->fail('INDUSTRIAL_409', 'Somente lote em rascunho ou reaberto pode ser fechado.');
            }

            $batch = $this->recalculateBatch($id);
            $calculation = $batch['calculation'];
            $movements = $calculation['stock_movements'] ?? [];

            $delete = $this->pdo->prepare("DELETE FROM stock_movements WHERE origin_type = 'production' AND origin_id = :id");
            $delete->execute(['id' => $id]);

            $insert = $this->pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, movement_type, origin_type, origin_id, movement_date, quantity_kg, quantity_pieces, notes, updated_at)
                 VALUES (:product_id, :movement_type, :origin_type, :origin_id, :movement_date, :quantity_kg, :quantity_pieces, :notes, CURRENT_TIMESTAMP)'
            );
            foreach ($movements as $movement) {
                $insert->execute([
                    'product_id' => (int) $movement['product_id'],
                    'movement_type' => $movement['movement_type'],
                    'origin_type' => $movement['origin_type'],
                    'origin_id' => $id,
                    'movement_date' => $batch['batch_date'],
                    'quantity_kg' => (float) $movement['quantity_kg'],
                    'quantity_pieces' => (float) $movement['quantity_pieces'],
                    'notes' => 'Entrada teorica por fechamento de lote de producao.',
                ]);
            }

            $stmt = $this->pdo->prepare(
                "UPDATE production_batches
                 SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id"
            );
            $stmt->execute(['id' => $id]);

            return $this->batch($id);
        });
    }

    public function reopenBatch(int $id, array $payload): array
    {
        $reason = trim((string) ($payload['reason'] ?? ''));
        if ($reason === '') {
            $this->fail('INDUSTRIAL_422', 'Motivo de reabertura e obrigatorio.', ['reason' => 'obrigatorio']);
        }

        return $this->transaction(function () use ($id, $reason): array {
            $batch = $this->batch($id);
            if ($batch['status'] !== 'closed') {
                $this->fail('INDUSTRIAL_409', 'Somente lote fechado pode ser reaberto.');
            }

            $delete = $this->pdo->prepare("DELETE FROM stock_movements WHERE origin_type = 'production' AND origin_id = :id");
            $delete->execute(['id' => $id]);

            $stmt = $this->pdo->prepare(
                "UPDATE production_batches
                 SET status = 'reopened', reopened_at = CURRENT_TIMESTAMP, reopen_reason = :reason, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id"
            );
            $stmt->execute(['id' => $id, 'reason' => $reason]);

            $audit = $this->pdo->prepare(
                'INSERT INTO production_batch_audit_logs (batch_id, action, reason) VALUES (:batch_id, :action, :reason)'
            );
            $audit->execute(['batch_id' => $id, 'action' => 'reopen', 'reason' => $reason]);

            return $this->batch($id);
        });
    }

    public function stock(): array
    {
        $movements = $this->fetchAll('SELECT * FROM stock_movements ORDER BY movement_date, id');
        $result = $this->runProcessor('stock-balance', ['movements' => $movements]);
        $items = [];

        foreach ($result['data']['items'] as $item) {
            $product = $this->product((int) $item['product_id']);
            $items[] = [
                ...$item,
                'product' => $product,
            ];
        }

        return ['items' => $items];
    }

    public function stockMovements(array $query = []): array
    {
        $sql = 'SELECT sm.*, p.code AS product_code, p.name AS product_name, p.category AS product_category
                FROM stock_movements sm
                JOIN industrial_products p ON p.id = sm.product_id
                WHERE 1 = 1';
        $params = [];
        $this->dateRangeSql($sql, $params, 'sm.movement_date', $query);

        if (! empty($query['product_id'])) {
            $sql .= ' AND sm.product_id = :product_id';
            $params['product_id'] = (int) $query['product_id'];
        }

        $sql .= ' ORDER BY sm.movement_date DESC, sm.id DESC';

        return array_map([$this, 'formatStockMovement'], $this->fetchAll($sql, $params));
    }

    public function dailyProductionReport(array $query = []): array
    {
        $sql = 'SELECT b.*, c.total_produced_kg, c.yield_liters_per_kg, c.yield_kg_per_liter, c.average_piece_weight
                FROM production_batches b
                LEFT JOIN production_calculation_results c ON c.batch_id = b.id
                WHERE 1 = 1';
        $params = [];
        $this->dateRangeSql($sql, $params, 'b.batch_date', $query);
        $sql .= ' ORDER BY b.batch_date DESC, b.id DESC';

        $items = [];
        foreach ($this->fetchAll($sql, $params) as $row) {
            $items[] = [
                'batch' => $this->formatBatch($row, false),
                'totals' => [
                    'total_produced_kg' => $this->floatOrNull($row['total_produced_kg']),
                    'yield_liters_per_kg' => $this->floatOrNull($row['yield_liters_per_kg']),
                    'yield_kg_per_liter' => $this->floatOrNull($row['yield_kg_per_liter']),
                    'average_piece_weight' => $this->floatOrNull($row['average_piece_weight']),
                ],
                'items' => $this->batchItems((int) $row['id']),
            ];
        }

        return ['items' => $items];
    }

    private function milkEntryPayload(array $payload): array
    {
        $date = trim((string) ($payload['entry_date'] ?? $payload['date'] ?? ''));
        if (! $this->validDate($date)) {
            $this->fail('INDUSTRIAL_422', 'Data de entrada de leite invalida.', ['entry_date' => 'YYYY-MM-DD']);
        }

        $received = $this->nonNegative($payload['liters_received'] ?? 0, 'liters_received');
        $processed = $this->nonNegative($payload['liters_processed'] ?? 0, 'liters_processed');
        $cream = $this->nonNegative($payload['liters_to_cream'] ?? 0, 'liters_to_cream');
        $surplus = $this->nonNegative($payload['liters_surplus'] ?? 0, 'liters_surplus');
        $difference = $this->numeric($payload['difference_liters'] ?? ($received - $processed - $cream - $surplus), 'difference_liters');
        $balance = $this->numeric($payload['milk_balance'] ?? $difference, 'milk_balance');

        return [
            'entry_date' => $date,
            'liters_received' => $received,
            'liters_processed' => $processed,
            'liters_to_cream' => $cream,
            'liters_surplus' => $surplus,
            'difference_liters' => $difference,
            'milk_balance' => $balance,
            'notes' => $payload['notes'] ?? null,
        ];
    }

    private function batchPayload(array $payload): array
    {
        $date = trim((string) ($payload['batch_date'] ?? $payload['date'] ?? ''));
        if (! $this->validDate($date)) {
            $this->fail('INDUSTRIAL_422', 'Data do lote invalida.', ['batch_date' => 'YYYY-MM-DD']);
        }

        $status = (string) ($payload['status'] ?? 'draft');
        if (! in_array($status, self::BATCH_STATUSES, true)) {
            $this->fail('INDUSTRIAL_422', 'Status do lote invalido.', ['status' => implode(',', self::BATCH_STATUSES)]);
        }

        return [
            'batch_date' => $date,
            'milk_entry_id' => isset($payload['milk_entry_id']) && $payload['milk_entry_id'] !== '' ? (int) $payload['milk_entry_id'] : null,
            'liters_processed' => $this->nonNegative($payload['liters_processed'] ?? 0, 'liters_processed'),
            'status' => $status,
            'notes' => $payload['notes'] ?? null,
        ];
    }

    private function itemPayload(array $payload): array
    {
        $productId = (int) ($payload['product_id'] ?? 0);
        $this->product($productId);
        $productionType = (string) ($payload['production_type'] ?? 'produced');
        if (! in_array($productionType, self::PRODUCTION_TYPES, true)) {
            $this->fail('INDUSTRIAL_422', 'Tipo de producao invalido.', ['production_type' => implode(',', self::PRODUCTION_TYPES)]);
        }

        return [
            'product_id' => $productId,
            'production_type' => $productionType,
            'pieces_count' => $this->nonNegative($payload['pieces_count'] ?? 0, 'pieces_count'),
            'weight_kg' => $this->nonNegative($payload['weight_kg'] ?? 0, 'weight_kg'),
            'notes' => $payload['notes'] ?? null,
        ];
    }

    private function ensureBatchEditable(array $batch): void
    {
        if ($batch['status'] === 'closed') {
            $this->fail('INDUSTRIAL_409', 'Lote fechado nao pode ser editado sem reabertura.');
        }
        if ($batch['status'] === 'cancelled') {
            $this->fail('INDUSTRIAL_409', 'Lote cancelado nao pode ser editado.');
        }
    }

    private function itemsForProcessor(int $batchId): array
    {
        return $this->fetchAll(
            'SELECT id, product_id, production_type, pieces_count, weight_kg
             FROM production_batch_items
             WHERE batch_id = :batch_id
             ORDER BY id',
            ['batch_id' => $batchId]
        );
    }

    private function batchItems(int $batchId): array
    {
        $rows = $this->fetchAll(
            'SELECT i.*, p.code AS product_code, p.name AS product_name, p.category AS product_category
             FROM production_batch_items i
             JOIN industrial_products p ON p.id = i.product_id
             WHERE i.batch_id = :batch_id
             ORDER BY i.id',
            ['batch_id' => $batchId]
        );

        return array_map([$this, 'formatBatchItem'], $rows);
    }

    private function batchItem(int $id): array
    {
        $row = $this->fetchOne(
            'SELECT i.*, p.code AS product_code, p.name AS product_name, p.category AS product_category
             FROM production_batch_items i
             JOIN industrial_products p ON p.id = i.product_id
             WHERE i.id = :id',
            ['id' => $id]
        );
        if ($row === null) {
            $this->fail('INDUSTRIAL_404', 'Item de producao nao encontrado.');
        }

        return $this->formatBatchItem($row);
    }

    private function formatBatch(array $row, bool $withDetails): array
    {
        $batch = [
            'id' => (int) $row['id'],
            'batch_date' => $row['batch_date'],
            'milk_entry_id' => $row['milk_entry_id'] !== null ? (int) $row['milk_entry_id'] : null,
            'liters_processed' => (float) $row['liters_processed'],
            'status' => $row['status'],
            'notes' => $row['notes'],
            'closed_at' => $row['closed_at'] ?? null,
            'reopened_at' => $row['reopened_at'] ?? null,
            'reopen_reason' => $row['reopen_reason'] ?? null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];

        if ($withDetails) {
            $batch['items'] = $this->batchItems((int) $row['id']);
            $batch['calculation'] = $this->calculationForBatch((int) $row['id']);
            $batch['audit_logs'] = $this->fetchAll(
                'SELECT id, action, reason, created_at FROM production_batch_audit_logs WHERE batch_id = :batch_id ORDER BY id',
                ['batch_id' => (int) $row['id']]
            );
        }

        return $batch;
    }

    private function calculationForBatch(int $batchId): ?array
    {
        $row = $this->fetchOne('SELECT * FROM production_calculation_results WHERE batch_id = :batch_id', ['batch_id' => $batchId]);
        if ($row === null) {
            return null;
        }

        $payload = json_decode((string) $row['result_payload'], true);
        return is_array($payload) ? $payload : null;
    }

    private function formatProduct(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'category' => $row['category'],
            'unit' => $row['unit'],
            'active' => (bool) $row['active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function formatMilkEntry(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'entry_date' => $row['entry_date'],
            'liters_received' => (float) $row['liters_received'],
            'liters_processed' => (float) $row['liters_processed'],
            'liters_to_cream' => (float) $row['liters_to_cream'],
            'liters_surplus' => (float) $row['liters_surplus'],
            'difference_liters' => (float) $row['difference_liters'],
            'milk_balance' => (float) $row['milk_balance'],
            'notes' => $row['notes'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function formatBatchItem(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'batch_id' => (int) $row['batch_id'],
            'product_id' => (int) $row['product_id'],
            'production_type' => $row['production_type'],
            'pieces_count' => (float) $row['pieces_count'],
            'weight_kg' => (float) $row['weight_kg'],
            'notes' => $row['notes'],
            'product' => [
                'id' => (int) $row['product_id'],
                'code' => $row['product_code'],
                'name' => $row['product_name'],
                'category' => $row['product_category'],
            ],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function formatStockMovement(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'product_id' => (int) $row['product_id'],
            'movement_type' => $row['movement_type'],
            'origin_type' => $row['origin_type'],
            'origin_id' => $row['origin_id'] !== null ? (int) $row['origin_id'] : null,
            'movement_date' => $row['movement_date'],
            'quantity_kg' => (float) $row['quantity_kg'],
            'quantity_pieces' => (float) $row['quantity_pieces'],
            'notes' => $row['notes'],
            'product' => [
                'id' => (int) $row['product_id'],
                'code' => $row['product_code'],
                'name' => $row['product_name'],
                'category' => $row['product_category'],
            ],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function runProcessor(string $function, array $payload): array
    {
        $command = ['python3', $this->processorScript, '--function', $function, '--input', '-'];
        $process = proc_open(
            $command,
            [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ],
            $pipes
        );

        if (! is_resource($process)) {
            $this->fail('INDUSTRIAL_500', 'Nao foi possivel iniciar o processor.');
        }

        fwrite($pipes[0], json_encode($payload, JSON_UNESCAPED_UNICODE));
        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        $decoded = json_decode($stdout, true);
        if ($code !== 0 || ! is_array($decoded) || empty($decoded['success'])) {
            $this->fail('INDUSTRIAL_502', 'Processor retornou erro.', [
                'stdout' => $stdout,
                'stderr' => $stderr,
                'exit_code' => $code,
            ]);
        }

        return $decoded;
    }

    private function transaction(callable $callback): array
    {
        $this->pdo->beginTransaction();
        try {
            $result = $callback();
            $this->pdo->commit();
            return $result;
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    private function fetchAll(string $sql, array $params = []): array
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    private function dateRangeSql(string &$sql, array &$params, string $field, array $query): void
    {
        if (! empty($query['date_from'])) {
            $sql .= " AND {$field} >= :date_from";
            $params['date_from'] = (string) $query['date_from'];
        }
        if (! empty($query['date_to'])) {
            $sql .= " AND {$field} <= :date_to";
            $params['date_to'] = (string) $query['date_to'];
        }
    }

    private function nonNegative(mixed $value, string $field): float
    {
        $number = $this->numeric($value, $field);
        if ($number < 0) {
            $this->fail('INDUSTRIAL_422', 'Valor nao pode ser negativo.', [$field => 'nao_negativo']);
        }
        return $number;
    }

    private function numeric(mixed $value, string $field): float
    {
        if (! is_numeric($value)) {
            $this->fail('INDUSTRIAL_422', 'Valor numerico invalido.', [$field => 'numerico']);
        }
        return round((float) $value, 3);
    }

    private function validDate(string $date): bool
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1;
    }

    private function boolInt(mixed $value): int
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === false ? 0 : 1;
    }

    private function floatOrNull(mixed $value): ?float
    {
        return $value === null ? null : (float) $value;
    }

    private function slugCode(string $name): string
    {
        $code = iconv('UTF-8', 'ASCII//TRANSLIT', $name) ?: $name;
        $code = preg_replace('/[^A-Za-z0-9]+/', '-', strtoupper($code)) ?: 'PRODUTO';
        return trim($code, '-');
    }

    private function fail(string $code, string $message, array $fields = []): never
    {
        throw new RuntimeException(json_encode([
            'code' => $code,
            'message' => $message,
            'fields' => array_filter($fields, fn ($value): bool => $value !== null),
        ], JSON_UNESCAPED_UNICODE));
    }
}
