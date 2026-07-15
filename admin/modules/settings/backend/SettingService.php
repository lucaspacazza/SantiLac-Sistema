<?php

namespace SantiLac\Admin\Modules\Settings;

use PDO;

final class SettingService
{
    private const ALLOWED=['incident_retention_days'=>[1,3650],'cpu_warning_percent'=>[1,100],'memory_warning_percent'=>[1,100],'disk_warning_percent'=>[1,100]];
    public function __construct(private PDO $db) {}
    public function list(): array { return $this->db->query('SELECT chave, valor, descricao FROM admin_configuracoes ORDER BY chave')->fetchAll(); }
    public function update(string $key,string $value): bool
    {
        if(!isset(self::ALLOWED[$key])||!ctype_digit($value))return false;
        $number=(int)$value;[$min,$max]=self::ALLOWED[$key];if($number<$min||$number>$max)return false;
        $statement=$this->db->prepare('UPDATE admin_configuracoes SET valor=:value WHERE chave=:key');
        return $statement->execute(['value'=>(string)$number,'key'=>$key]);
    }
}
