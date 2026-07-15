<?php

namespace SantiLac\Admin;

final class Security
{
    public static function requireAdmin(): array
    {
        $user=Auth::user();
        if (!$user) JsonResponse::error('Não autenticado.',401);
        return $user;
    }
    public static function requireCsrf(): void
    {
        $token=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');
        if ($token==='' || !hash_equals(Auth::csrf(),$token)) JsonResponse::error('Sessão inválida.',419);
    }
    public static function body(): array
    {
        $data=json_decode((string)file_get_contents('php://input'),true);
        return is_array($data)?$data:[];
    }
}
