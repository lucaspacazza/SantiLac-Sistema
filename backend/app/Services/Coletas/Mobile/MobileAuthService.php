<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class MobileAuthService
{
    public function login(string $login, string $senha): array
    {
        $login = trim($login);
        $senha = (string) $senha;
        if ($login === '' || $senha === '') {
            return MobileResponse::fail('Usuário ou senha inválidos');
        }

        $usuario = DB::connection('raw')
            ->table('usuarios')
            ->select('id', 'codigo', 'nome', 'usuario', 'senha', 'ativo', 'app_coletas')
            ->where('ativo', 1)
            ->where('usuario', $login)
            ->first();

        if (! $usuario || ! $this->senhaConfere($senha, (string) ($usuario->senha ?? ''))) {
            return MobileResponse::fail('Usuário ou senha inválidos');
        }

        if ((int) ($usuario->app_coletas ?? 0) !== 1) {
            return MobileResponse::fail('Usuário sem acesso ao app de coletas');
        }

        $motorista = $this->motoristaDoUsuario($usuario);
        if ($motorista === null) {
            return MobileResponse::fail('Usuário sem vínculo com motorista ativo');
        }

        DB::connection('raw')
            ->table('usuarios')
            ->where('id', (int) $usuario->id)
            ->update(['ultimo_login' => now('America/Sao_Paulo')->format('Y-m-d H:i:s')]);

        return MobileResponse::ok([
            'motorista' => [
                'id' => (string) $motorista->id,
                'nome' => (string) $motorista->nome,
            ],
            'usuario' => [
                'id' => (string) $usuario->id,
                'nome' => (string) $usuario->nome,
                'login' => (string) $usuario->usuario,
            ],
        ]);
    }

    private function motoristaDoUsuario(object $usuario): ?object
    {
        $nome = trim((string) ($usuario->nome ?? ''));
        if ($nome !== '') {
            $motorista = DB::connection('raw')
                ->table('motoristas')
                ->select('id', 'nome')
                ->where('ativo', 1)
                ->where('nome', $nome)
                ->orderBy('id')
                ->first();
            if ($motorista) {
                return $motorista;
            }
        }

        $codigo = trim((string) ($usuario->codigo ?? ''));
        if ($codigo !== '' && ctype_digit($codigo)) {
            return DB::connection('raw')
                ->table('motoristas')
                ->select('id', 'nome')
                ->where('ativo', 1)
                ->where('id', (int) $codigo)
                ->first();
        }

        return null;
    }

    private function senhaConfere(string $plain, string $stored): bool
    {
        $stored = trim($stored);
        if ($plain === '' || $stored === '') {
            return false;
        }

        if (strlen($stored) === 32 && ctype_xdigit($stored)) {
            return hash_equals(strtolower($stored), md5($plain));
        }

        return Hash::check($plain, $stored);
    }
}
