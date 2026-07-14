<?php

namespace SantiLac\Admin;

use PDO;

final class Auth
{
    public function __construct(private PDO $db) {}

    public function login(string $login, string $password, string $ip): ?array
    {
        $login=trim($login);$identityHash=hash('sha256',strtolower($login));$ipHash=hash('sha256',$ip);
        $this->db->exec("DELETE FROM admin_login_tentativas WHERE created_at < NOW() - INTERVAL 1 HOUR");
        $attempts=$this->db->prepare('SELECT COUNT(*) FROM admin_login_tentativas WHERE (identidade_hash=:identity OR ip_hash=:ip) AND created_at >= NOW() - INTERVAL 1 MINUTE');
        $attempts->execute(['identity'=>$identityHash,'ip'=>$ipHash]);
        if((int)$attempts->fetchColumn()>=10)return null;
        $statement = $this->db->prepare('SELECT id, nome, usuario, senha, admin, ativo FROM usuarios WHERE (usuario = :login OR email = :login) LIMIT 1');
        $statement->execute(['login' => $login]);
        $user = $statement->fetch();
        if (! $user || ! (bool) $user['ativo'] || ! (bool) $user['admin'] || ! $this->passwordMatches($password, (string) $user['senha'])) {
            $failed=$this->db->prepare('INSERT INTO admin_login_tentativas (identidade_hash,ip_hash) VALUES (:identity,:ip)');$failed->execute(['identity'=>$identityHash,'ip'=>$ipHash]);return null;
        }
        $clear=$this->db->prepare('DELETE FROM admin_login_tentativas WHERE identidade_hash=:identity OR ip_hash=:ip');$clear->execute(['identity'=>$identityHash,'ip'=>$ipHash]);
        session_regenerate_id(true);
        $_SESSION['admin_user'] = ['id' => (int) $user['id'], 'nome' => (string) $user['nome'], 'usuario' => (string) $user['usuario']];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        return $_SESSION['admin_user'];
    }

    public static function user(): ?array { return $_SESSION['admin_user'] ?? null; }
    public static function csrf(): string { return (string) ($_SESSION['csrf'] ??= bin2hex(random_bytes(24))); }
    public static function logout(): void { $_SESSION = []; session_destroy(); }

    private function passwordMatches(string $plain, string $stored): bool
    {
        if ($plain === '' || $stored === '') return false;
        if (strlen($stored) === 32 && ctype_xdigit($stored)) return hash_equals(strtolower($stored), md5($plain));
        return password_verify($plain, $stored);
    }
}
