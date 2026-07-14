<?php
use SantiLac\Admin\ProxmoxClient;
use SantiLac\Admin\Security;
use SantiLac\Admin\Modules\Infrastructure\InfrastructureService;
$router->get('/api/infrastructure',function()use($db):array{ Security::requireAdmin(); return (new InfrastructureService($db,new ProxmoxClient()))->get(); });
