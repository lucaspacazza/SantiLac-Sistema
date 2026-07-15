<?php

namespace SantiLac\Admin\Modules\Infrastructure;

use SantiLac\Admin\Modules\Incidents\IncidentService;
use SantiLac\Admin\ProxmoxClient;

final class HealthCollector
{
    public function __construct(private HealthTargetClient $targets,private ProxmoxClient $proxmox,private IncidentService $incidents) {}

    public function run(): int
    {
        $failures=0;
        foreach($this->targets->checkAll() as $service){
            if($service['status']==='online')continue;
            $this->incidents->record('ServiceUnavailable',"Serviço {$service['name']} indisponível",'/health',503,'health');$failures++;
        }
        $proxmox=$this->proxmox->status();
        if($proxmox['configured'])foreach($proxmox['containers'] as $container){
            if(($container['status']['status']??null)==='running')continue;
            $this->incidents->record('ContainerUnavailable',"CT {$container['id']} {$container['name']} indisponível",'/proxmox/lxc/'.$container['id'],503,'proxmox');$failures++;
        }
        return $failures;
    }
}
