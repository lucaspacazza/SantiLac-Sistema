<?php
use SantiLac\Admin\Security;
use SantiLac\Admin\Modules\Records\RecordService;
$router->get('/api/records',function()use($db):array{ Security::requireAdmin(); return ['items'=>(new RecordService($db))->list((string)($_GET['tipo']??'auditoria'),(int)($_GET['limite']??100))]; });
