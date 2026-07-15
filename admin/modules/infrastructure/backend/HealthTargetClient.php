<?php

namespace SantiLac\Admin\Modules\Infrastructure;

use SantiLac\Admin\Config;

final class HealthTargetClient
{
    public function checkAll(): array
    {
        $targets=json_decode((string)Config::get('HEALTH_TARGETS_JSON','[]'),true);
        if(!is_array($targets))return [];
        return array_values(array_map(fn(array $target):array=>$this->check((string)($target['name']??'Serviço'),(string)($target['url']??'')),array_filter($targets,'is_array')));
    }

    private function check(string $name,string $url): array
    {
        if(!preg_match('#^https?://#i',$url))return ['name'=>$name,'status'=>'invalid','latency_ms'=>null];
        $started=microtime(true);$handle=curl_init($url);curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>4,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true]);curl_exec($handle);$code=(int)curl_getinfo($handle,CURLINFO_RESPONSE_CODE);curl_close($handle);
        return ['name'=>$name,'status'=>$code>=200&&$code<400?'online':'offline','latency_ms'=>(int)round((microtime(true)-$started)*1000),'http_status'=>$code];
    }
}
