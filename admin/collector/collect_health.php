<?php

declare(strict_types=1);

use SantiLac\Admin\Config;
use SantiLac\Admin\Database;
use SantiLac\Admin\ProxmoxClient;
use SantiLac\Admin\Modules\Incidents\IncidentService;
use SantiLac\Admin\Modules\Infrastructure\HealthCollector;
use SantiLac\Admin\Modules\Infrastructure\HealthTargetClient;

require dirname(__DIR__).'/backend/src/autoload.php';
Config::load(dirname(__DIR__).'/.env');
$db=Database::connection();
$failures=(new HealthCollector(new HealthTargetClient(),new ProxmoxClient(),new IncidentService($db)))->run();
fwrite(STDOUT,"{$failures} falha(s) de saúde detectada(s).\n");
