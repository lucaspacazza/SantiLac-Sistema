<?php

namespace SantiLac\Admin;

final class JsonResponse
{
    public static function send(array $data, int $status=200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['success'=>$status<400,'data'=>$data], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status): never
    {
        http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
        echo json_encode(['success'=>false,'error'=>['message'=>$message]], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
