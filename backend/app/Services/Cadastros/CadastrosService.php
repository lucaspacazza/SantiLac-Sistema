<?php

namespace App\Services\Cadastros;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;

class CadastrosService
{
    public function usuarios(Request $request): array
    {
        $query = DB::connection('raw')
            ->table('usuarios')
            ->select('id', 'codigo', 'nome', 'usuario', 'nivel', 'admin', 'ativo', 'ultimo_login', 'criado_em', 'adm_app', 'app_coletas');

        $status = (string) $request->query('status', 'ativos');
        if ($status === 'ativos') {
            $query->where('ativo', 1);
        } elseif ($status === 'inativos') {
            $query->where('ativo', 0);
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('nome', 'like', "%{$search}%")
                    ->orWhere('usuario', 'like', "%{$search}%")
                    ->orWhere('codigo', 'like', "%{$search}%");
            });
        }

        return collect($query->orderByDesc('ativo')->orderBy('nome')->orderBy('id')->limit(300)->get())
            ->map(fn ($row): array => $this->usuarioParaApi((array) $row))
            ->all();
    }

    public function usuario(int $id): ?array
    {
        $row = DB::connection('raw')
            ->table('usuarios')
            ->select('id', 'codigo', 'nome', 'usuario', 'nivel', 'admin', 'ativo', 'ultimo_login', 'criado_em', 'adm_app', 'app_coletas')
            ->where('id', $id)
            ->first();

        return $row ? $this->usuarioParaApi((array) $row) : null;
    }

    public function criarUsuario(array $payload, bool $canManageAdminFlags): array
    {
        $codigo = trim((string) ($payload['codigo'] ?? ''));
        $nome = trim((string) ($payload['nome'] ?? ''));
        $usuario = trim((string) ($payload['usuario'] ?? ''));
        $senha = (string) ($payload['senha'] ?? '');
        $nivel = trim((string) ($payload['nivel'] ?? '1')) ?: '1';

        if ($codigo === '' || $nome === '' || $usuario === '' || $senha === '') {
            throw new InvalidArgumentException('Código, nome, usuário e senha são obrigatórios.');
        }

        $id = DB::connection('raw')->table('usuarios')->insertGetId([
            'codigo' => $codigo,
            'nome' => $nome,
            'usuario' => $usuario,
            'senha' => Hash::make($senha),
            'nivel' => $nivel,
            'admin' => $canManageAdminFlags && $this->bool($payload['admin'] ?? false) ? 1 : 0,
            'ativo' => 1,
            'adm_app' => $canManageAdminFlags && $this->bool($payload['adm_app'] ?? false) ? 1 : 0,
            'app_coletas' => $canManageAdminFlags && $this->bool($payload['app_coletas'] ?? false) ? 1 : 0,
        ]);

        return $this->usuario((int) $id) ?? [];
    }

    public function editarUsuario(array $payload, bool $canManageAdminFlags): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $codigo = trim((string) ($payload['codigo'] ?? ''));
        $nome = trim((string) ($payload['nome'] ?? ''));
        $usuario = trim((string) ($payload['usuario'] ?? ''));
        $nivel = trim((string) ($payload['nivel'] ?? '1')) ?: '1';
        $senha = trim((string) ($payload['senha'] ?? ''));

        if ($id <= 0 || $codigo === '' || $nome === '' || $usuario === '') {
            throw new InvalidArgumentException('ID, código, nome e usuário são obrigatórios.');
        }

        $data = [
            'codigo' => $codigo,
            'nome' => $nome,
            'usuario' => $usuario,
            'nivel' => $nivel,
            'ativo' => $this->bool($payload['ativo'] ?? false) ? 1 : 0,
        ];

        if ($canManageAdminFlags) {
            $data['admin'] = $this->bool($payload['admin'] ?? false) ? 1 : 0;
            $data['adm_app'] = $this->bool($payload['adm_app'] ?? false) ? 1 : 0;
            $data['app_coletas'] = $this->bool($payload['app_coletas'] ?? false) ? 1 : 0;
        }

        if ($senha !== '') {
            $data['senha'] = Hash::make($senha);
        }

        DB::connection('raw')->table('usuarios')->where('id', $id)->update($data);

        $usuarioRow = $this->usuario($id);
        if ($usuarioRow === null) {
            throw new InvalidArgumentException('Usuário não encontrado.');
        }

        return $usuarioRow;
    }

    public function inativarUsuario(int $id): array
    {
        if ($id <= 0) {
            throw new InvalidArgumentException('Usuário inválido.');
        }

        DB::connection('raw')->table('usuarios')->where('id', $id)->update(['ativo' => 0]);

        $usuario = $this->usuario($id);
        if ($usuario === null) {
            throw new InvalidArgumentException('Usuário não encontrado.');
        }

        return $usuario;
    }

    public function produtores(Request $request): array
    {
        $query = DB::connection('raw')
            ->table('produtores')
            ->select('id', 'codigo', 'nome', 'cidade', 'rota', 'diario', 'endereco', 'cep', 'cpf_cnpj', 'celular', 'ativo', 'novo', 'data_cadastro', 'data_inativacao', 'projeto');

        $status = (string) $request->query('status', 'ativos');
        if ($status === 'ativos') {
            $query->where('ativo', 1);
        } elseif ($status === 'inativos') {
            $query->where('ativo', 0);
        }

        if ($request->filled('rota')) {
            $query->where('rota', trim((string) $request->query('rota')));
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('nome', 'like', "%{$search}%")
                    ->orWhere('codigo', 'like', "%{$search}%")
                    ->orWhere('cidade', 'like', "%{$search}%")
                    ->orWhere('rota', 'like', "%{$search}%");
            });
        }

        return collect($query->orderByDesc('ativo')->orderBy('nome')->orderBy('id')->limit(500)->get())
            ->map(fn ($row): array => $this->produtorParaApi((array) $row))
            ->all();
    }

    public function produtor(int $id): ?array
    {
        $row = DB::connection('raw')
            ->table('produtores')
            ->select('id', 'codigo', 'nome', 'cidade', 'rota', 'diario', 'endereco', 'cep', 'cpf_cnpj', 'celular', 'ativo', 'novo', 'data_cadastro', 'data_inativacao', 'projeto')
            ->where('id', $id)
            ->first();

        return $row ? $this->produtorParaApi((array) $row) : null;
    }

    public function criarProdutor(array $payload): array
    {
        $codigo = trim((string) ($payload['codigo'] ?? ''));
        $nome = trim((string) ($payload['nome'] ?? ''));

        if ($codigo === '' || $nome === '') {
            throw new InvalidArgumentException('Código e nome são obrigatórios.');
        }

        $id = DB::connection('raw')->table('produtores')->insertGetId([
            'codigo' => $codigo,
            'nome' => $nome,
            'cidade' => trim((string) ($payload['cidade'] ?? '')),
            'rota' => trim((string) ($payload['rota'] ?? '')),
            'diario' => $this->bool($payload['diario'] ?? false) ? 1 : 0,
            'endereco' => $this->nullable($payload['endereco'] ?? null),
            'cep' => $this->nullable($payload['cep'] ?? null),
            'cpf_cnpj' => $this->nullable($payload['cpf_cnpj'] ?? null),
            'celular' => $this->nullable($payload['celular'] ?? null),
            'ativo' => 1,
            'novo' => array_key_exists('novo', $payload) ? ($this->bool($payload['novo']) ? 1 : 0) : 1,
            'projeto' => $this->bool($payload['projeto'] ?? false) ? 1 : 0,
        ]);

        return $this->produtor((int) $id) ?? [];
    }

    public function editarProdutor(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $codigo = trim((string) ($payload['codigo'] ?? ''));
        $nome = trim((string) ($payload['nome'] ?? ''));

        if ($id <= 0 || $codigo === '' || $nome === '') {
            throw new InvalidArgumentException('ID, código e nome são obrigatórios.');
        }

        $ativo = $this->bool($payload['ativo'] ?? false);
        DB::connection('raw')->table('produtores')->where('id', $id)->update([
            'codigo' => $codigo,
            'nome' => $nome,
            'cidade' => trim((string) ($payload['cidade'] ?? '')),
            'rota' => trim((string) ($payload['rota'] ?? '')),
            'diario' => $this->bool($payload['diario'] ?? false) ? 1 : 0,
            'endereco' => $this->nullable($payload['endereco'] ?? null),
            'cep' => $this->nullable($payload['cep'] ?? null),
            'cpf_cnpj' => $this->nullable($payload['cpf_cnpj'] ?? null),
            'celular' => $this->nullable($payload['celular'] ?? null),
            'ativo' => $ativo ? 1 : 0,
            'novo' => $this->bool($payload['novo'] ?? false) ? 1 : 0,
            'projeto' => $this->bool($payload['projeto'] ?? false) ? 1 : 0,
            'data_inativacao' => $ativo ? null : DB::raw('COALESCE(data_inativacao, NOW())'),
        ]);

        $produtor = $this->produtor($id);
        if ($produtor === null) {
            throw new InvalidArgumentException('Produtor não encontrado.');
        }

        return $produtor;
    }

    public function inativarProdutor(int $id): array
    {
        if ($id <= 0) {
            throw new InvalidArgumentException('Produtor inválido.');
        }

        DB::connection('raw')->table('produtores')->where('id', $id)->update([
            'ativo' => 0,
            'data_inativacao' => DB::raw('COALESCE(data_inativacao, NOW())'),
        ]);

        $produtor = $this->produtor($id);
        if ($produtor === null) {
            throw new InvalidArgumentException('Produtor não encontrado.');
        }

        return $produtor;
    }

    public function motoristas(Request $request): array
    {
        $query = DB::connection('raw')->table('motoristas')->select('id', 'nome', 'ativo');

        $status = (string) $request->query('status', 'ativos');
        if ($status === 'ativos') {
            $query->where('ativo', 1);
        } elseif ($status === 'inativos') {
            $query->where('ativo', 0);
        }

        if ($request->filled('q')) {
            $query->where('nome', 'like', '%' . trim((string) $request->query('q')) . '%');
        }

        return collect($query->orderByDesc('ativo')->orderBy('nome')->orderBy('id')->limit(300)->get())
            ->map(fn ($row): array => $this->motoristaParaApi((array) $row))
            ->all();
    }

    public function motorista(int $id): ?array
    {
        $row = DB::connection('raw')->table('motoristas')->select('id', 'nome', 'ativo')->where('id', $id)->first();

        return $row ? $this->motoristaParaApi((array) $row) : null;
    }

    public function criarMotorista(array $payload): array
    {
        $nome = trim((string) ($payload['nome'] ?? ''));
        if ($nome === '') {
            throw new InvalidArgumentException('Nome do motorista é obrigatório.');
        }

        $id = DB::connection('raw')->table('motoristas')->insertGetId([
            'nome' => $nome,
            'ativo' => 1,
        ]);

        return $this->motorista((int) $id) ?? [];
    }

    public function editarMotorista(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $nome = trim((string) ($payload['nome'] ?? ''));

        if ($id <= 0 || $nome === '') {
            throw new InvalidArgumentException('ID e nome do motorista são obrigatórios.');
        }

        DB::connection('raw')->table('motoristas')->where('id', $id)->update([
            'nome' => $nome,
            'ativo' => $this->bool($payload['ativo'] ?? false) ? 1 : 0,
        ]);

        $motorista = $this->motorista($id);
        if ($motorista === null) {
            throw new InvalidArgumentException('Motorista não encontrado.');
        }

        return $motorista;
    }

    public function inativarMotorista(int $id): array
    {
        if ($id <= 0) {
            throw new InvalidArgumentException('Motorista inválido.');
        }

        DB::connection('raw')->table('motoristas')->where('id', $id)->update(['ativo' => 0]);

        $motorista = $this->motorista($id);
        if ($motorista === null) {
            throw new InvalidArgumentException('Motorista não encontrado.');
        }

        return $motorista;
    }

    private function usuarioParaApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'codigo' => (string) ($row['codigo'] ?? ''),
            'nome' => (string) ($row['nome'] ?? ''),
            'usuario' => (string) ($row['usuario'] ?? ''),
            'nivel' => (string) ($row['nivel'] ?? ''),
            'admin' => (int) ($row['admin'] ?? 0),
            'ativo' => (int) ($row['ativo'] ?? 0),
            'ultimo_login' => $row['ultimo_login'] !== null ? (string) $row['ultimo_login'] : null,
            'criado_em' => (string) ($row['criado_em'] ?? ''),
            'adm_app' => (int) ($row['adm_app'] ?? 0),
            'app_coletas' => (int) ($row['app_coletas'] ?? 0),
        ];
    }

    private function produtorParaApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'codigo' => (string) ($row['codigo'] ?? ''),
            'nome' => (string) ($row['nome'] ?? ''),
            'cidade' => (string) ($row['cidade'] ?? ''),
            'rota' => (string) ($row['rota'] ?? ''),
            'diario' => (int) ($row['diario'] ?? 0),
            'endereco' => $row['endereco'] !== null ? (string) $row['endereco'] : null,
            'cep' => $row['cep'] !== null ? (string) $row['cep'] : null,
            'cpf_cnpj' => $row['cpf_cnpj'] !== null ? (string) $row['cpf_cnpj'] : null,
            'celular' => $row['celular'] !== null ? (string) $row['celular'] : null,
            'ativo' => (int) ($row['ativo'] ?? 0),
            'novo' => (int) ($row['novo'] ?? 0),
            'data_cadastro' => $row['data_cadastro'] !== null ? (string) $row['data_cadastro'] : null,
            'data_inativacao' => $row['data_inativacao'] !== null ? (string) $row['data_inativacao'] : null,
            'projeto' => (int) ($row['projeto'] ?? 0),
        ];
    }

    private function motoristaParaApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'nome' => (string) ($row['nome'] ?? ''),
            'ativo' => (int) ($row['ativo'] ?? 0),
        ];
    }

    private function nullable(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : $value;
    }

    private function bool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
