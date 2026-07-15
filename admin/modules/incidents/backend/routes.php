<?php
use SantiLac\Admin\JsonResponse;
use SantiLac\Admin\Security;
use SantiLac\Admin\Modules\Incidents\IncidentService;
$router->get('/api/incidents',function()use($db):array{ Security::requireAdmin(); return ['items'=>(new IncidentService($db))->list($_GET)]; });
$router->patch('/api/incidents/{id}',function(array $params)use($db):array{ $user=Security::requireAdmin(); Security::requireCsrf(); $body=Security::body(); $ok=(new IncidentService($db))->changeStatus((int)$params['id'],(string)($body['status']??''),(int)$user['id']); if(!$ok)JsonResponse::error('Estado inválido.',422); return ['updated'=>true]; });
