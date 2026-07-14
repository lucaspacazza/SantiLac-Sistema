<?php

declare(strict_types=1);

use SantiLac\Admin\Auth;
use SantiLac\Admin\Config;
use SantiLac\Admin\Database;
use SantiLac\Admin\JsonResponse;
use SantiLac\Admin\Router;
use SantiLac\Admin\Security;
use SantiLac\Admin\Modules\Incidents\IncidentService;

require dirname(__DIR__).'/src/autoload.php';
Config::load(dirname(__DIR__,2).'/.env');

session_name('santilac_admin');
$secureCookie=filter_var(Config::get('COOKIE_SECURE','true'),FILTER_VALIDATE_BOOLEAN);
session_set_cookie_params(['httponly'=>true,'secure'=>$secureCookie,'samesite'=>'Strict','path'=>'/']);
session_start();

$router=new Router();
$db=Database::connection();
$auth=new Auth($db);

$router->post('/api/auth/login',function()use($auth):array{
    $body=Security::body();
    $user=$auth->login((string)($body['login']??''),(string)($body['password']??''),(string)($_SERVER['REMOTE_ADDR']??''));
    if(!$user) JsonResponse::error('Usuário sem acesso administrativo ou senha inválida.',403);
    return ['user'=>$user,'csrf'=>Auth::csrf()];
});
$router->get('/api/auth/me',fn():array=>['user'=>Security::requireAdmin(),'csrf'=>Auth::csrf()]);
$router->post('/api/auth/logout',function():array{ Security::requireAdmin(); Security::requireCsrf(); Auth::logout(); return ['message'=>'Sessão encerrada.']; });

foreach (glob(dirname(__DIR__,2).'/modules/*/backend/routes.php')?:[] as $routes) require $routes;

$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';
try { $router->dispatch($_SERVER['REQUEST_METHOD']??'GET',$path); }
catch(Throwable $error) {
    error_log($error->__toString());
    try { (new IncidentService($db))->record($error::class,$error->getMessage(),$path,500); } catch(Throwable) {}
    JsonResponse::error('Erro interno no subsistema administrativo.',500);
}
