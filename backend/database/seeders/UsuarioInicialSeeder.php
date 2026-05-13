<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsuarioInicialSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SANTILAC_ADMIN_PASSWORD');

        if (! is_string($password) || $password === '') {
            return;
        }

        User::query()->updateOrCreate(
            ['email' => env('SANTILAC_ADMIN_EMAIL', 'lucas@santilac.local')],
            [
                'nome' => env('SANTILAC_ADMIN_NOME', 'Lucas'),
                'password' => Hash::make($password),
                'niveis' => ['admin', 'qualidade'],
                'ativo' => true,
            ],
        );
    }
}
