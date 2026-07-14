<?php

namespace SantiLac\Admin\Modules\Overview;

use PDO;

final class OverviewService
{
    public function __construct(private PDO $db) {}

    public function get(): array
    {
        $counts = $this->db->query("SELECT COUNT(*) total, SUM(status='aberto') abertos, SUM(severidade='critico' AND status='aberto') criticos FROM admin_incidentes")->fetch();
        $recent = $this->db->query("SELECT id, titulo, modulo, severidade, ocorrencias, ultima_ocorrencia FROM admin_incidentes WHERE status='aberto' ORDER BY FIELD(severidade,'critico','erro','aviso'), ultima_ocorrencia DESC LIMIT 6")->fetchAll();
        return [
            'incidentes' => ['total'=>(int)($counts['total']??0),'abertos'=>(int)($counts['abertos']??0),'criticos'=>(int)($counts['criticos']??0)],
            'prioritarios' => $recent,
        ];
    }
}
