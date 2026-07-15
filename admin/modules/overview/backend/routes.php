<?php
use SantiLac\Admin\Security;
use SantiLac\Admin\Modules\Overview\OverviewService;
$router->get('/api/overview',function()use($db):array{ Security::requireAdmin(); return (new OverviewService($db))->get(); });
