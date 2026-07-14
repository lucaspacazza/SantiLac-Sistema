<?php

namespace SantiLac\Admin\Modules\Incidents;

use PDO;
use SantiLac\Admin\IncidentFingerprint;
use SantiLac\Admin\Redactor;

final class IncidentService
{
    public function __construct(private PDO $db) {}

    public function list(array $filters): array
    {
        $where=[]; $params=[];
        foreach (['status','severidade','modulo'] as $field) {
            if (($filters[$field]??'') !== '') { $where[]="{$field} = :{$field}"; $params[$field]=$filters[$field]; }
        }
        $sql='SELECT * FROM admin_incidentes'.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY ultima_ocorrencia DESC, id DESC LIMIT 200';
        $statement=$this->db->prepare($sql); $statement->execute($params); return $statement->fetchAll();
    }

    public function changeStatus(int $id, string $status, int $userId): bool
    {
        if (!in_array($status,['aberto','reconhecido','resolvido'],true)) return false;
        $fields=['status=:status','updated_at=NOW()'];
        if($status==='reconhecido')$fields[]='reconhecido_por=:user';
        if($status==='resolvido'){$fields[]='resolvido_por=:user';$fields[]='resolvido_em=NOW()';}
        if($status==='aberto'){$fields[]='resolvido_por=NULL';$fields[]='resolvido_em=NULL';}
        $statement=$this->db->prepare('UPDATE admin_incidentes SET '.implode(',',$fields).' WHERE id=:id');
        $params=['status'=>$status,'id'=>$id]; if($status!=='aberto')$params['user']=$userId;
        return $statement->execute($params);
    }

    public function record(string $type,string $message,string $route,int $statusCode,string $origin='admin'): void
    {
        $message=Redactor::text($message);
        $signature=IncidentFingerprint::make($type,$message,$route,$statusCode);
        $statement=$this->db->prepare("INSERT INTO admin_incidentes (assinatura,titulo,mensagem,tipo,modulo,origem,severidade,rota,status_code) VALUES (:signature,:title,:message,:type,'admin',:origin,'critico',:route,:status) ON DUPLICATE KEY UPDATE ocorrencias=ocorrencias+1,ultima_ocorrencia=NOW(),status=IF(status='resolvido','aberto',status),updated_at=NOW()");
        $statement->execute(['signature'=>$signature,'title'=>mb_substr($message,0,190),'message'=>mb_substr($message,0,8000),'type'=>$type,'origin'=>$origin,'route'=>$route?:null,'status'=>$statusCode]);
    }
}
