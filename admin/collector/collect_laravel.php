<?php

declare(strict_types=1);

use SantiLac\Admin\Config;
use SantiLac\Admin\Database;
use SantiLac\Admin\IncidentFingerprint;
use SantiLac\Admin\Redactor;

require dirname(__DIR__).'/backend/src/autoload.php';
Config::load(dirname(__DIR__).'/.env');
$path=(string)Config::get('LARAVEL_LOG_PATH','');
if($path===''||!is_readable($path)){fwrite(STDERR,"Laravel log indisponível.\n");exit(1);}
$db=Database::connection();$identity=$path.':'.(string)fileinode($path);$size=(int)filesize($path);
$state=$db->prepare("SELECT arquivo,posicao FROM admin_coletor_estado WHERE fonte='laravel' LIMIT 1");$state->execute();$saved=$state->fetch();
$position=($saved&&$saved['arquivo']===$identity&&$size>=(int)$saved['posicao'])?(int)$saved['posicao']:0;
$handle=fopen($path,'rb');if(!$handle)exit(1);fseek($handle,$position);
$insert=$db->prepare("INSERT INTO admin_incidentes (assinatura,titulo,mensagem,tipo,modulo,origem,severidade,rota,status_code,primeira_ocorrencia,ultima_ocorrencia) VALUES (:assinatura,:titulo,:mensagem,:tipo,'sistema','laravel','critico',:rota,500,:occurred_first,:occurred_last) ON DUPLICATE KEY UPDATE ocorrencias=ocorrencias+1,ultima_ocorrencia=VALUES(ultima_ocorrencia),status=IF(status='resolvido','aberto',status),updated_at=NOW()");
$count=0;
while(($line=fgets($handle))!==false){
    if(!preg_match('/^\[([^]]+)]\s+\w+\.ERROR:\s+(.+)$/',trim($line),$match))continue;
    $message=Redactor::text(substr($match[2],0,4000));$route='';if(preg_match('#/api/[A-Za-z0-9_./{}-]+#',$message,$routeMatch))$route=$routeMatch[0];
    $type=preg_match('/\(([A-Za-z\\\\]+Exception)/',$message,$typeMatch)?$typeMatch[1]:'ApplicationError';
    $occurred=['occurred_first'=>$match[1],'occurred_last'=>$match[1]];
    $insert->execute(['assinatura'=>IncidentFingerprint::make($type,$message,$route,500),'titulo'=>mb_substr(strtok($message,"{")?:'Erro da aplicação',0,190),'mensagem'=>$message,'tipo'=>$type,'rota'=>$route?:null]+$occurred);$count++;
}
$newPosition=ftell($handle);fclose($handle);
$save=$db->prepare("INSERT INTO admin_coletor_estado (fonte,arquivo,posicao) VALUES ('laravel',:arquivo,:posicao) ON DUPLICATE KEY UPDATE arquivo=VALUES(arquivo),posicao=VALUES(posicao),updated_at=NOW()");$save->execute(['arquivo'=>$identity,'posicao'=>$newPosition]);
fwrite(STDOUT,"{$count} ocorrência(s) nova(s).\n");
