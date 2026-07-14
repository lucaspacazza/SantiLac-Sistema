<?php
use SantiLac\Admin\Security;
use SantiLac\Admin\JsonResponse;
use SantiLac\Admin\Modules\Settings\SettingService;
$router->get('/api/settings',function()use($db):array{ Security::requireAdmin(); return ['items'=>(new SettingService($db))->list()]; });
$router->patch('/api/settings/{key}',function(array $params)use($db):array{ Security::requireAdmin();Security::requireCsrf();$body=Security::body();$ok=(new SettingService($db))->update((string)$params['key'],(string)($body['value']??''));if(!$ok)JsonResponse::error('Configuração ou valor inválido.',422);return ['updated'=>true];});
