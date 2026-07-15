<?php

namespace SantiLac\Admin;

final class Router
{
    private array $routes=[];
    public function get(string $path, callable $handler): void { $this->add('GET',$path,$handler); }
    public function post(string $path, callable $handler): void { $this->add('POST',$path,$handler); }
    public function patch(string $path, callable $handler): void { $this->add('PATCH',$path,$handler); }
    private function add(string $method,string $path,callable $handler): void { $this->routes[]=[$method,$path,$handler]; }

    public function dispatch(string $method,string $path): never
    {
        foreach ($this->routes as [$routeMethod,$pattern,$handler]) {
            if ($method!==$routeMethod) continue;
            $regex='#^'.preg_replace('#\{([a-zA-Z_]+)\}#','(?P<$1>[^/]+)',$pattern).'$#';
            if (!preg_match($regex,$path,$matches)) continue;
            $params=array_filter($matches,'is_string',ARRAY_FILTER_USE_KEY);
            $result=$handler($params);
            JsonResponse::send(is_array($result)?$result:[]);
        }
        JsonResponse::error('Endpoint não encontrado.',404);
    }
}
