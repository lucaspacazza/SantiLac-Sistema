<?php

namespace App\Services\ProdutorApp;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class ProdutorAppService
{
    private const SESSION_PRODUTOR = 'produtor_app.produtor';
    private const SESSION_ADMIN = 'produtor_app.admin';

    public function login(string $login, string $senha): array
    {
        $login = trim($login);
        $senha = (string) $senha;

        if ($login === '' || $senha === '') {
            return $this->fail('CPF/CNPJ ou senha incorretos.', 401);
        }

        $documento = $this->somenteDigitos($login);
        if (strlen($documento) === 11 || strlen($documento) === 14) {
            return $this->loginProdutor($documento, $senha);
        }

        return $this->loginAdmin($login, $senha);
    }

    public function logout(): array
    {
        session()->forget([self::SESSION_PRODUTOR, self::SESSION_ADMIN]);

        return ['ok' => true, 'data' => ['message' => 'Sessão encerrada.']];
    }

    public function me(): array
    {
        $produtor = $this->produtorAtual();
        if ($produtor === null) {
            return $this->fail('Produtor não selecionado.', 401);
        }

        return ['ok' => true, 'data' => $produtor];
    }

    public function adminProdutores(): array
    {
        if (! $this->adminAtual()) {
            return $this->fail('Acesso administrativo obrigatório.', 403);
        }

        $produtores = DB::connection('raw')
            ->table('produtores')
            ->select('codigo', 'nome')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(fn ($row): array => [
                'codigo' => (string) $row->codigo,
                'nome' => (string) $row->nome,
            ])
            ->values()
            ->all();

        return ['ok' => true, 'data' => ['produtores' => $produtores]];
    }

    public function adminImpersonate(string $codigo): array
    {
        if (! $this->adminAtual()) {
            return $this->fail('Acesso administrativo obrigatório.', 403);
        }

        $produtor = $this->findProdutorPorCodigo($codigo);
        if ($produtor === null) {
            return $this->fail('Produtor não encontrado.', 404);
        }

        session([self::SESSION_PRODUTOR => $produtor]);

        return ['ok' => true, 'data' => ['produtor' => $produtor]];
    }

    public function coletas(?string $mesAno): array
    {
        $produtor = $this->produtorAtual();
        if ($produtor === null) {
            return $this->fail('Produtor não selecionado.', 401);
        }

        $codigo = (string) $produtor['codigo'];
        $mensal = ['total_litros' => '0.000', 'atualizado_em' => null];
        if (Schema::connection('raw')->hasTable('coletas_mensal')) {
            $row = DB::connection('raw')
                ->table('coletas_mensal')
                ->select('total_litros', 'atualizado_em')
                ->where('produtor_codigo', $codigo)
                ->first();
            if ($row) {
                $mensal = [
                    'total_litros' => (string) $row->total_litros,
                    'atualizado_em' => $row->atualizado_em,
                ];
            }
        }

        $anteriores = [];
        if (Schema::connection('raw')->hasTable('coletas_anteriores')) {
            $anteriores = DB::connection('raw')
                ->table('coletas_anteriores')
                ->select('mes_ano', 'total_litros', 'data_fechamento')
                ->where('produtor_codigo', $codigo)
                ->orderByDesc('mes_ano')
                ->limit(24)
                ->get()
                ->map(fn ($row): array => [
                    'mes_ano' => (string) $row->mes_ano,
                    'label' => $this->rotuloMes((string) $row->mes_ano),
                    'total_litros' => (string) $row->total_litros,
                    'data_fechamento' => $row->data_fechamento,
                ])
                ->values()
                ->all();
        }

        $recentes = [];
        $meses = [];
        $coletasMes = [];
        $mesSelecionado = $this->mesValido((string) $mesAno);

        if (Schema::connection('raw')->hasTable('coletas')) {
            $selectColetas = $this->selectColetas();

            $recentes = DB::connection('raw')
                ->table('coletas')
                ->select($selectColetas)
                ->where('produtor_codigo', $codigo)
                ->orderByDesc('datahora')
                ->limit(30)
                ->get()
                ->map(fn ($row): array => (array) $row)
                ->values()
                ->all();

            $meses = DB::connection('raw')
                ->table('coletas')
                ->selectRaw('DATE_FORMAT(datahora, "%Y-%m") AS mes_ano')
                ->selectRaw('SUM(litros) AS total_litros')
                ->selectRaw('COUNT(*) AS coletas_count')
                ->where('produtor_codigo', $codigo)
                ->groupByRaw('DATE_FORMAT(datahora, "%Y-%m")')
                ->orderByDesc('mes_ano')
                ->limit(36)
                ->get()
                ->map(fn ($row): array => [
                    'mes_ano' => (string) $row->mes_ano,
                    'label' => $this->rotuloMes((string) $row->mes_ano),
                    'total_litros' => (string) $row->total_litros,
                    'coletas_count' => (int) $row->coletas_count,
                ])
                ->values()
                ->all();

            if ($mesSelecionado === '' && $meses !== []) {
                $mesSelecionado = (string) $meses[0]['mes_ano'];
            }
            if ($mesSelecionado === '') {
                $mesSelecionado = now('America/Sao_Paulo')->format('Y-m');
            }

            $coletasMes = DB::connection('raw')
                ->table('coletas')
                ->select($selectColetas)
                ->where('produtor_codigo', $codigo)
                ->whereRaw('DATE_FORMAT(datahora, "%Y-%m") = ?', [$mesSelecionado])
                ->orderByDesc('datahora')
                ->limit(500)
                ->get()
                ->map(fn ($row): array => (array) $row)
                ->values()
                ->all();
        }

        return ['ok' => true, 'data' => [
            'mensal' => $mensal,
            'anteriores' => $anteriores,
            'recentes' => $recentes,
            'meses' => $meses,
            'mes_selecionado' => $mesSelecionado,
            'coletas_mes' => $coletasMes,
        ]];
    }

    public function analises(): array
    {
        $produtor = $this->produtorAtual();
        if ($produtor === null) {
            return $this->fail('Produtor não selecionado.', 401);
        }

        $codigo = (string) $produtor['codigo'];

        return ['ok' => true, 'data' => [
            'resultados' => $this->resultadosAnalises($codigo),
            'laboratorio' => $this->analisesLaboratorio($codigo),
        ]];
    }

    public function notas(?string $competencia): array
    {
        $produtor = $this->produtorAtual();
        if ($produtor === null) {
            return $this->fail('Produtor não selecionado.', 401);
        }

        if (! Schema::connection('raw')->hasTable('notas_produtores')) {
            return ['ok' => true, 'data' => [
                'competencias' => [],
                'competencia_selecionada' => '',
                'notas' => [],
            ]];
        }

        $codigo = (string) $produtor['codigo'];
        $competencias = DB::connection('raw')
            ->table('notas_produtores')
            ->select('competencia')
            ->selectRaw('COUNT(*) AS notas_count')
            ->selectRaw('MAX(updated_at) AS atualizado_em')
            ->where('produtor_codigo', $codigo)
            ->groupBy('competencia')
            ->orderByDesc('competencia')
            ->limit(60)
            ->get()
            ->map(fn ($row): array => [
                'competencia' => (string) $row->competencia,
                'label' => $this->rotuloMes((string) $row->competencia),
                'notas_count' => (int) $row->notas_count,
                'atualizado_em' => $row->atualizado_em,
            ])
            ->values()
            ->all();

        $competenciaSelecionada = $this->mesValido((string) $competencia);
        $competenciasValidas = array_column($competencias, 'competencia');
        if ($competenciaSelecionada === '' || ! in_array($competenciaSelecionada, $competenciasValidas, true)) {
            $competenciaSelecionada = (string) ($competencias[0]['competencia'] ?? '');
        }

        $notas = [];
        if ($competenciaSelecionada !== '') {
            $notas = DB::connection('raw')
                ->table('notas_produtores')
                ->select('id', 'competencia', 'emissao_data', 'numero', 'serie', 'chave_acesso', 'updated_at')
                ->where('produtor_codigo', $codigo)
                ->where('competencia', $competenciaSelecionada)
                ->orderByDesc('emissao_data')
                ->orderByDesc('id')
                ->limit(500)
                ->get()
                ->map(fn ($row): array => (array) $row)
                ->values()
                ->all();
        }

        return ['ok' => true, 'data' => [
            'competencias' => $competencias,
            'competencia_selecionada' => $competenciaSelecionada,
            'notas' => $notas,
        ]];
    }

    private function loginProdutor(string $documento, string $senha): array
    {
        if (! Schema::connection('raw')->hasColumn('produtores', 'senha_hash')) {
            return $this->fail('Senha ainda não criada para este produtor.', 403, 'password_missing');
        }

        $produtor = DB::connection('raw')
            ->table('produtores')
            ->select('id', 'codigo', 'nome', 'ativo', 'senha_hash')
            ->when(Schema::connection('raw')->hasColumn('produtores', 'senha_bloqueada'), fn ($query) => $query->addSelect('senha_bloqueada'))
            ->whereRaw("REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?", [$documento])
            ->first();

        if (! $produtor || (int) ($produtor->ativo ?? 0) !== 1) {
            return $this->fail('CPF/CNPJ ou senha incorretos.', 401);
        }

        if ((int) ($produtor->senha_bloqueada ?? 0) === 1) {
            return $this->fail('Acesso bloqueado. Fale com o administrador.', 403, 'blocked');
        }

        if (! Hash::check($senha, (string) ($produtor->senha_hash ?? ''))) {
            return $this->fail('CPF/CNPJ ou senha incorretos.', 401);
        }

        $data = [
            'codigo' => (string) $produtor->codigo,
            'nome' => (string) $produtor->nome,
            'role' => 'produtor',
        ];
        session()->forget(self::SESSION_ADMIN);
        session([self::SESSION_PRODUTOR => $data]);

        return ['ok' => true, 'data' => $data];
    }

    private function loginAdmin(string $login, string $senha): array
    {
        $query = DB::connection('raw')
            ->table('usuarios')
            ->select('id', 'codigo', 'nome', 'usuario', 'senha', 'ativo', 'admin')
            ->when(Schema::connection('raw')->hasColumn('usuarios', 'adm_app'), fn ($q) => $q->addSelect('adm_app'))
            ->where('ativo', 1)
            ->where(function ($query) use ($login): void {
                $query->where('usuario', $login);
                if (Schema::connection('raw')->hasColumn('usuarios', 'email')) {
                    $query->orWhere('email', mb_strtolower($login));
                }
            });

        $usuario = $query->first();
        $isAdmin = $usuario && ((int) ($usuario->admin ?? 0) === 1 || (int) ($usuario->adm_app ?? 0) === 1);
        if (! $isAdmin || ! $this->senhaConfere($senha, (string) ($usuario->senha ?? ''))) {
            return $this->fail('CPF/CNPJ ou senha incorretos.', 401);
        }

        $data = [
            'id' => (int) $usuario->id,
            'codigo' => (string) ($usuario->codigo ?? ''),
            'nome' => (string) $usuario->nome,
            'usuario' => (string) $usuario->usuario,
            'role' => 'admin',
        ];
        session()->forget(self::SESSION_PRODUTOR);
        session([self::SESSION_ADMIN => $data]);

        return ['ok' => true, 'data' => $data];
    }

    private function findProdutorPorCodigo(string $codigo): ?array
    {
        $row = DB::connection('raw')
            ->table('produtores')
            ->select('codigo', 'nome')
            ->where('ativo', 1)
            ->where('codigo', trim($codigo))
            ->first();

        if (! $row) {
            return null;
        }

        return [
            'codigo' => (string) $row->codigo,
            'nome' => (string) $row->nome,
            'role' => 'produtor',
        ];
    }

    private function produtorAtual(): ?array
    {
        $produtor = session(self::SESSION_PRODUTOR);
        return is_array($produtor) ? $produtor : null;
    }

    private function adminAtual(): ?array
    {
        $admin = session(self::SESSION_ADMIN);
        return is_array($admin) ? $admin : null;
    }

    private function resultadosAnalises(string $codigo): array
    {
        if (! Schema::connection('raw')->hasTable('resultadosanalises')) {
            return [];
        }

        $campos = [
            'data',
            'gordura',
            'proteina',
            'lactose',
            'solidos_totais',
            'ccs',
            'ufc',
            'caseina',
            'sng',
            'ureia',
            'antibiotico',
            'bacteria',
            'temperatura',
        ];

        $select = array_values(array_filter($campos, fn (string $campo): bool => Schema::connection('raw')->hasColumn('resultadosanalises', $campo)));
        if ($select === []) {
            return [];
        }

        return DB::connection('raw')
            ->table('resultadosanalises')
            ->select($select)
            ->where('produtor_codigo', $codigo)
            ->orderByDesc(Schema::connection('raw')->hasColumn('resultadosanalises', 'data') ? 'data' : 'id')
            ->limit(24)
            ->get()
            ->map(fn ($row): array => (array) $row)
            ->values()
            ->all();
    }

    private function analisesLaboratorio(string $codigo): array
    {
        if (! Schema::connection('raw')->hasTable('analiseslaboratorio')) {
            return [];
        }

        $campos = ['data', 'crioscopia', 'alizarol', 'observacao', 'usuario', 'created_at'];
        $select = array_values(array_filter($campos, fn (string $campo): bool => Schema::connection('raw')->hasColumn('analiseslaboratorio', $campo)));
        if ($select === []) {
            return [];
        }

        return DB::connection('raw')
            ->table('analiseslaboratorio')
            ->select($select)
            ->where('produtor_codigo', $codigo)
            ->orderByDesc(Schema::connection('raw')->hasColumn('analiseslaboratorio', 'data') ? 'data' : 'id')
            ->limit(24)
            ->get()
            ->map(fn ($row): array => (array) $row)
            ->values()
            ->all();
    }

    private function selectColetas(): array
    {
        $select = ['litros', 'temperatura', 'datahora', 'rota_nome', 'motorista_nome'];
        if (Schema::connection('raw')->hasColumn('coletas', 'tanque')) {
            $select[] = 'tanque';
        }

        return $select;
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

    private function somenteDigitos(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?: '';
    }

    private function mesValido(string $mes): string
    {
        $mes = trim($mes);
        return preg_match('/^\d{4}-\d{2}$/', $mes) ? $mes : '';
    }

    private function rotuloMes(string $mesAno): string
    {
        if (! preg_match('/^(\d{4})-(\d{2})$/', $mesAno, $matches)) {
            return $mesAno;
        }

        $meses = [
            '01' => 'Janeiro',
            '02' => 'Fevereiro',
            '03' => 'Março',
            '04' => 'Abril',
            '05' => 'Maio',
            '06' => 'Junho',
            '07' => 'Julho',
            '08' => 'Agosto',
            '09' => 'Setembro',
            '10' => 'Outubro',
            '11' => 'Novembro',
            '12' => 'Dezembro',
        ];

        return ($meses[$matches[2]] ?? $matches[2]) . '/' . $matches[1];
    }

    private function fail(string $message, int $status, string $code = 'error'): array
    {
        return [
            'ok' => false,
            'error' => $message,
            'code' => $code,
            '_status' => $status,
        ];
    }
}
