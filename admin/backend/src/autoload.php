<?php

spl_autoload_register(function (string $class): void {
    $prefix = 'SantiLac\\Admin\\';
    if (! str_starts_with($class, $prefix)) return;
    $relative = str_replace('\\', '/', substr($class, strlen($prefix))).'.php';
    $core = __DIR__.'/'.$relative;
    if (is_file($core)) { require $core; return; }
    if (preg_match('#^Modules/([^/]+)/(.+)$#', $relative, $match)) {
        $module = strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $match[1]));
        $file = dirname(__DIR__, 2).'/modules/'.$module.'/backend/'.$match[2];
        if (is_file($file)) require $file;
    }
});
