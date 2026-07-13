<?php

namespace App\Models\Usuarios;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['codigo', 'nome', 'usuario', 'senha', 'nivel', 'admin', 'ativo', 'adm_app', 'app_coletas'])]
#[Hidden(['senha'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $table = 'usuarios';
    public $timestamps = false;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'admin' => 'boolean',
            'adm_app' => 'boolean',
            'app_coletas' => 'boolean',
            'ultimo_login' => 'datetime',
            'criado_em' => 'datetime',
        ];
    }

    public function getNameAttribute(): string
    {
        return (string) $this->nome;
    }

    public function getAuthPasswordName(): string
    {
        return 'senha';
    }

    public function getAuthPassword(): string
    {
        return (string) $this->senha;
    }

    public function getEmailAttribute(): ?string
    {
        $value = $this->attributes['email'] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function getNiveisAttribute(): array
    {
        $nivel = (string) ($this->attributes['nivel'] ?? '');
        if ($nivel === '') {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map('trim', preg_split('/[,;\s]+/', $nivel) ?: []),
            static fn (string $item): bool => $item !== ''
        )));
    }

    public function getRememberTokenName(): ?string
    {
        return null;
    }

    public function getRememberToken(): ?string
    {
        return null;
    }

    public function setRememberToken($value): void
    {
    }
}
