<?php

namespace SantiLac\Admin\Modules\Infrastructure;

use PDO;
use SantiLac\Admin\ProxmoxClient;

final class InfrastructureService
{
    public function __construct(private PDO $db, private ProxmoxClient $proxmox, private ?HealthTargetClient $health=null) {}

    public function get(): array
    {
        $started=microtime(true); $database=['status'=>'offline','latencia_ms'=>null];
        try { $this->db->query('SELECT 1')->fetchColumn(); $database=['status'=>'online','latencia_ms'=>(int)round((microtime(true)-$started)*1000)]; } catch (\Throwable) {}
        return ['database'=>$database,'proxmox'=>$this->proxmox->status(),'services'=>($this->health??new HealthTargetClient())->checkAll()];
    }
}
