<?php

namespace SantiLac\Admin\Modules\Records;

use PDO;

final class RecordService
{
    public function __construct(private PDO $db) {}

    public function list(string $type, int $limit=100): array
    {
        $limit=min(200,max(20,$limit));
        if ($type==='mobile') return $this->db->query("SELECT id, area modulo, level acao, message descricao, received_at created_at FROM app_mobile_logs ORDER BY received_at DESC, id DESC LIMIT {$limit}")->fetchAll();
        return $this->db->query("SELECT id, modulo, acao, descricao, usuario_nome, rota, status_code, created_at FROM logs ORDER BY created_at DESC, id DESC LIMIT {$limit}")->fetchAll();
    }
}
