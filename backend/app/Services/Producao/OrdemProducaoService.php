<?php

namespace App\Services\Producao;

use App\Models\Producao\ProducaoFormulacaoQueijo;
use App\Models\Producao\ProducaoOrdemProducao;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class OrdemProducaoService
{
    private const CAMPO_EM_BRANCO = '__op_blank__';

    private const CAMPOS_OP = [
        ['chave' => 'producao_data', 'rotulo' => 'PRODUÇÃO DIARIA / DATA'],
        ['chave' => 'lts_produzidos_total', 'rotulo' => 'LTS PRODUZIDOS TOTAL'],
        ['chave' => 'pecas_f4', 'rotulo' => 'PEÇAS F4'],
        ['chave' => 'pecas_f1', 'rotulo' => 'PEÇAS F1'],
        ['chave' => 'pecas_f6', 'rotulo' => 'PEÇAS F6'],
        ['chave' => 'pecas_colonial', 'rotulo' => 'PEÇAS COLONIAL'],
        ['chave' => 'pecas_coalho', 'rotulo' => 'PEÇAS COALHO'],
        ['chave' => 'pecas_provolone', 'rotulo' => 'PEÇAS PROVOLONE'],
        ['chave' => 'pecas_gouda', 'rotulo' => 'PEÇAS GOUDA'],
        ['chave' => 'pecas_gruyere', 'rotulo' => 'PEÇAS GRUYERE'],
        ['chave' => 'pecas_prato', 'rotulo' => 'PEÇAS PRATO'],
        ['chave' => 'cloreto_calcio', 'rotulo' => 'CLORETO CÁLCIO'],
        ['chave' => 'coalho', 'rotulo' => 'COALHO'],
        ['chave' => 'fermento_mvd', 'rotulo' => 'FERMENTO (MVD)'],
        ['chave' => 'fermento_fast', 'rotulo' => 'FERMENTO (FAST)'],
        ['chave' => 'fermento_1', 'rotulo' => 'FERMENTO'],
        ['chave' => 'fermento_2', 'rotulo' => 'FERMENTO'],
        ['chave' => 'corante', 'rotulo' => 'CORANTE'],
    ];

    public function listar(Request $request): array
    {
        $data = trim((string) $request->query('data', ''));
        $somenteAbertas = $request->query('status') === 'abertas';

        if ($data === '' && ! $somenteAbertas) {
            return [];
        }

        return ProducaoOrdemProducao::query()
            ->where('status', '!=', 'cancelada')
            ->when($somenteAbertas, fn ($query) => $query->whereIn('status', ['rascunho', 'aguardando_formato']))
            ->when(! $somenteAbertas, fn ($query) => $query->whereDate('data_ordem', $data))
            ->orderByDesc('data_ordem')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ProducaoOrdemProducao $ordem): array => $this->resumoOrdem($ordem))
            ->values()
            ->all();
    }

    public function buscar(int $id): ?array
    {
        $ordem = ProducaoOrdemProducao::query()
            ->where('id', $id)
            ->where('status', '!=', 'cancelada')
            ->first();

        return $ordem === null ? null : $this->formatarOrdem($ordem, $this->formulacoesDaOrdem($ordem));
    }

    public function catalogos(): array
    {
        return [
            'queijos' => $this->catalogoQueijos(),
            'insumos' => $this->catalogoInsumos(),
        ];
    }

    public function salvar(array $payload): array
    {
        $data = (string) $payload['data'];
        $codigo = $this->normalizarCodigo((string) ($payload['codigo_ordem'] ?? ''));
        $campos = collect($payload['campos'] ?? [])
            ->map(fn (array $campo): array => [
                'rotulo' => trim((string) ($campo['rotulo'] ?? '')),
                'valor' => trim((string) ($campo['valor'] ?? '')),
            ])
            ->filter(fn (array $campo): bool => $campo['rotulo'] !== '')
            ->values()
            ->all();

        $codigo = $codigo !== '' ? $codigo : $this->gerarCodigo($data);

        $ordem = ProducaoOrdemProducao::query()->updateOrCreate(
            ['codigo_ordem' => $codigo],
            [
                'formulacao_queijo_id' => null,
                'data_ordem' => $data,
                'campos_json' => $campos,
                'origem' => 'manual',
                'status' => 'rascunho',
                'observacoes' => $payload['observacoes'] ?? null,
            ],
        );

        return $this->formatarOrdem($ordem, collect());
    }

    public function finalizar(int $id): ?array
    {
        $ordem = ProducaoOrdemProducao::query()->where('id', $id)->first();

        if ($ordem === null) {
            return null;
        }

        if (($ordem->status ?? 'rascunho') === 'finalizada') {
            return $this->formatarOrdem($ordem, $this->formulacoesDaOrdem($ordem));
        }

        if (($ordem->status ?? 'rascunho') !== 'rascunho') {
            throw new \DomainException('Somente uma OP em rascunho pode ser finalizada por esta tela.');
        }

        $ordem->forceFill(['status' => 'finalizada'])->save();

        return $this->formatarOrdem($ordem->refresh(), $this->formulacoesDaOrdem($ordem));
    }

    public function cancelar(int $id): ?array
    {
        $alteradas = ProducaoOrdemProducao::query()
            ->where('id', $id)
            ->whereIn('status', ['rascunho', 'aguardando_formato'])
            ->update(['status' => 'cancelada']);

        $ordem = ProducaoOrdemProducao::query()->where('id', $id)->first();

        if ($ordem === null) {
            return null;
        }

        if ($alteradas === 0 && ($ordem->status ?? '') !== 'cancelada') {
            throw new \DomainException('Uma OP finalizada não pode ser cancelada.');
        }

        return $this->formatarOrdem($ordem, $this->formulacoesDaOrdem($ordem));
    }

    public function gerarDaFormulacao(int $formulacaoId): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $formulacaoId)->first();

        if ($formulacao === null || $formulacao->status !== 'finalizada') {
            return null;
        }

        $data = optional($formulacao->data_formulacao)->toDateString();
        if ($data === null) {
            return null;
        }

        $ordem = ProducaoOrdemProducao::query()->updateOrCreate(
            ['formulacao_queijo_id' => $formulacao->id],
            [
                'codigo_ordem' => $this->gerarCodigoDaFormulacao($formulacao),
                'data_ordem' => $data,
                'campos_json' => $this->camposDaFormulacao($formulacao),
                'origem' => 'automatica',
                'status' => $this->isMussarela((string) $formulacao->tipo_queijo) ? 'aguardando_formato' : 'finalizada',
                'observacoes' => 'Gerada pela formulação ' . ($formulacao->codigo_formulacao ?? $formulacao->id),
            ],
        );

        return $this->formatarOrdem($ordem, collect([$formulacao]));
    }

    public function definirFormato(int $id, string $formato): ?array
    {
        $ordem = ProducaoOrdemProducao::query()->where('id', $id)->first();
        if ($ordem === null) {
            return null;
        }

        $formulacoes = $this->formulacoesDaOrdem($ordem);
        $formulacao = $formulacoes->first();
        if (! $formulacao instanceof ProducaoFormulacaoQueijo || ! $this->isMussarela((string) $formulacao->tipo_queijo)) {
            return $this->formatarOrdem($ordem, $formulacoes);
        }

        $campo = $this->campoFormatoMussarela($formato);
        if ($campo === null) {
            throw new \DomainException('Escolha F1, F4 ou F6.');
        }

        $ordem->forceFill([
            'campos_json' => $this->camposComFormatoMussarela($ordem->campos_json, $campo),
            'status' => 'finalizada',
        ])->save();

        return $this->formatarOrdem($ordem->refresh(), $formulacoes);
    }

    private function resumoOrdem(ProducaoOrdemProducao $ordem): array
    {
        $formulacao = $ordem->formulacao_queijo_id !== null
            ? ProducaoFormulacaoQueijo::query()->where('id', $ordem->formulacao_queijo_id)->first()
            : null;

        return [
            'id' => (int) $ordem->id,
            'codigo_ordem' => (string) $ordem->codigo_ordem,
            'data' => optional($ordem->data_ordem)->toDateString(),
            'tipo_queijo' => $formulacao?->tipo_queijo ?? $this->tipoQueijoDosCampos($ordem->campos_json),
            'lote_queijo' => $formulacao?->lote_queijo,
            'origem' => (string) $ordem->origem,
            'status' => $ordem->status ?? 'rascunho',
            'pendencia_formato' => ($ordem->status ?? '') === 'aguardando_formato',
        ];
    }

    private function formulacoesDaOrdem(ProducaoOrdemProducao $ordem): Collection
    {
        if ($ordem->formulacao_queijo_id !== null) {
            return ProducaoFormulacaoQueijo::query()
                ->where('id', $ordem->formulacao_queijo_id)
                ->get();
        }

        return collect();
    }

    private function tipoQueijoDosCampos(array $campos): string
    {
        foreach ($campos as $campo) {
            $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));

            if (str_starts_with($rotulo, 'pecas ')) {
                return trim(str_replace('pecas ', '', $rotulo));
            }
        }

        return 'manual';
    }

    private function formatarOrdem(ProducaoOrdemProducao $ordem, Collection $formulacoes): array
    {
        return [
            'id' => $ordem->id,
            'codigo_ordem' => $ordem->codigo_ordem,
            'data' => optional($ordem->data_ordem)->toDateString(),
            'manual' => $ordem->origem === 'manual',
            'origem' => $ordem->origem,
            'status' => $ordem->status ?? 'rascunho',
            'pendencia_formato' => ($ordem->status ?? '') === 'aguardando_formato',
            'total_formulacoes' => $formulacoes->count(),
            'campos' => array_values(is_array($ordem->campos_json) ? $ordem->campos_json : []),
            'formulacoes' => $this->formatarFormulacoes($formulacoes),
        ];
    }

    private function formatarFormulacoes(Collection $formulacoes): array
    {
        return $formulacoes->map(fn (ProducaoFormulacaoQueijo $item): array => [
            'id' => $item->id,
            'codigo_formulacao' => $item->codigo_formulacao,
            'tipo_queijo' => $item->tipo_queijo,
            'lote_queijo' => $item->lote_queijo,
            'quantidade_leite' => (float) ($item->quantidade_leite ?? 0),
            'status' => $item->status,
        ])->values()->all();
    }

    private function camposAutomaticos(Collection $formulacoes): array
    {
        $valores = $this->modeloVazio();

        foreach ($formulacoes as $formulacao) {
            $valores = $this->somarValoresOp($valores, $this->valoresDaFormulacao($formulacao));
        }

        return $this->camposDoModelo($valores);
    }

    private function camposDaFormulacao(ProducaoFormulacaoQueijo $formulacao): array
    {
        return $this->camposDoModelo($this->valoresDaFormulacao($formulacao));
    }

    private function valoresDaFormulacao(ProducaoFormulacaoQueijo $formulacao): array
    {
        $valores = $this->modeloVazio();
        $valores['producao_data'] = optional($formulacao->data_formulacao)->format('d/m/Y') ?? '';
        $valores['lts_produzidos_total'] = $this->valor((float) ($formulacao->quantidade_leite ?? 0), ' L');

        $campoQueijo = $this->campoQueijo((string) $formulacao->tipo_queijo);
        if ($campoQueijo !== null) {
            $valores[$campoQueijo] = self::CAMPO_EM_BRANCO;
        }

        foreach (($formulacao->insumos_json ?? []) as $insumo) {
            $quantidade = (float) ($insumo['quantidade'] ?? 0);
            if ($quantidade <= 0) {
                continue;
            }

            $nomeInsumo = (string) ($insumo['nome_insumo'] ?? '');
            $campo = $this->campoInsumo((string) ($insumo['tipo_insumo'] ?? ''), $nomeInsumo);
            if ($campo === null) {
                continue;
            }

            $rotulo = $this->rotuloInsumo($campo, $nomeInsumo);
            if ($rotulo !== null) {
                $valores['__rotulos'][$campo] = $rotulo;
            }
            if (! array_key_exists($campo, $valores)) {
                $valores[$campo] = '';
            }

            $unidade = $this->unidadePadrao($campo, (string) ($insumo['unidade'] ?? ''));
            $quantidadeBase = $this->converterQuantidade($quantidade, (string) ($insumo['unidade'] ?? ''), $unidade);
            $valorAtual = $this->numeroDeCampo((string) $valores[$campo]);
            $valores[$campo] = $this->valor($valorAtual + $quantidadeBase, ' ' . $unidade);
        }

        return $valores;
    }

    private function modeloVazio(): array
    {
        $valores = [];

        foreach (self::CAMPOS_OP as $campo) {
            $valores[$campo['chave']] = '';
        }

        $valores['__rotulos'] = [];

        return $valores;
    }

    private function camposDoModelo(array $valores): array
    {
        $rotulos = is_array($valores['__rotulos'] ?? null) ? $valores['__rotulos'] : [];
        $camposFixos = array_column(self::CAMPOS_OP, 'chave');
        $campos = [];

        $dinamicos = collect($valores)
            ->reject(fn (mixed $valor, string $chave): bool => $chave === '__rotulos' || in_array($chave, $camposFixos, true) || (string) $valor === '')
            ->map(fn (mixed $valor, string $chave): array => [
                'rotulo' => (string) ($rotulos[$chave] ?? $this->rotuloCampo($chave) ?? mb_strtoupper(str_replace('_', ' ', $chave), 'UTF-8')),
                'valor' => $valor === self::CAMPO_EM_BRANCO ? '' : (string) $valor,
            ])
            ->values()
            ->all();

        foreach (self::CAMPOS_OP as $campo) {
            $valor = $valores[$campo['chave']] ?? '';

            if ((string) $valor !== '') {
                $campos[] = [
                    'rotulo' => (string) ($rotulos[$campo['chave']] ?? $campo['rotulo']),
                    'valor' => $valor === self::CAMPO_EM_BRANCO ? '' : (string) $valor,
                ];
            }

            if ($campo['chave'] === 'fermento_fast') {
                array_push($campos, ...$dinamicos);
            }
        }

        return $campos;
    }

    private function somarValoresOp(array $base, array $adicao): array
    {
        foreach ($adicao as $campo => $valor) {
            if ($campo === '__rotulos') {
                $base['__rotulos'] = array_merge($base['__rotulos'] ?? [], is_array($valor) ? $valor : []);
                continue;
            }

            if ($valor === '') {
                continue;
            }

            if (! array_key_exists($campo, $base)) {
                $base[$campo] = '';
            }

            if ($campo === 'producao_data') {
                $base[$campo] = $base[$campo] !== '' ? $base[$campo] : $valor;
                continue;
            }

            if ($valor === self::CAMPO_EM_BRANCO) {
                $base[$campo] = self::CAMPO_EM_BRANCO;
                continue;
            }

            if ($base[$campo] === '' || $base[$campo] === self::CAMPO_EM_BRANCO) {
                $base[$campo] = $valor;
                continue;
            }

            $baseNumero = $this->numeroDeCampo((string) $base[$campo]);
            $adicaoNumero = $this->numeroDeCampo((string) $valor);

            if ($baseNumero > 0 || $adicaoNumero > 0) {
                $sufixo = preg_replace('/^[0-9.,]+\\s*/', '', (string) $valor);
                $base[$campo] = $this->valor($baseNumero + $adicaoNumero, $sufixo !== '' ? ' ' . trim($sufixo) : '');
            }
        }

        return $base;
    }

    private function campoQueijo(string $tipoQueijo, ?string $formatoMussarela = null): ?string
    {
        $tipo = $this->normalizar($tipoQueijo);

        return match (true) {
            str_contains($tipo, 'f4') => 'pecas_f4',
            str_contains($tipo, 'f1') => 'pecas_f1',
            str_contains($tipo, 'f6') => 'pecas_f6',
            str_contains($tipo, 'mussarela') => $this->campoFormatoMussarela($formatoMussarela ?? ''),
            str_contains($tipo, 'colonial') => 'pecas_colonial',
            str_contains($tipo, 'coalho') => 'pecas_coalho',
            str_contains($tipo, 'provolone') => 'pecas_provolone',
            str_contains($tipo, 'gouda') => 'pecas_gouda',
            str_contains($tipo, 'gruyere') => 'pecas_gruyere',
            str_contains($tipo, 'prato') => 'pecas_prato',
            default => null,
        };
    }

    private function campoInsumo(string $tipo, string $nome): ?string
    {
        $base = $this->normalizar($nome !== '' ? $nome : $tipo);

        return match (true) {
            str_contains($base, 'cloreto') => 'cloreto_calcio',
            str_contains($base, 'coalho') => 'coalho',
            str_contains($base, 'mvd') => 'fermento_mvd',
            str_contains($base, 'fast') => 'fermento_fast',
            str_contains($base, 'fermento') => 'fermento_extra_' . ($this->normalizarCodigo($nome) ?: 'generico'),
            str_contains($base, 'corante') => 'corante',
            default => null,
        };
    }

    private function unidadePadrao(string $campo, string $unidade): string
    {
        if (str_starts_with($campo, 'fermento_extra_')) {
            return 'g';
        }

        return match ($campo) {
            'fermento_mvd', 'fermento_fast', 'fermento_1', 'fermento_2' => 'g',
            'coalho', 'cloreto_calcio', 'corante' => 'ml',
            default => $unidade !== '' ? strtolower($unidade) : 'un',
        };
    }

    private function catalogoQueijos(): array
    {
        if (! $this->tabelaExiste('producao_queijos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('producao_queijos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(function (object $queijo): array {
                $nome = (string) ($queijo->nome ?? '');
                $slug = (string) ($queijo->slug ?? $nome);

                return [
                    'id' => (int) ($queijo->id ?? 0),
                    'nome' => $nome,
                    'slug' => $slug,
                    'codigo_balanca' => (string) ($queijo->codigo_balanca ?? ''),
                    'op_rotulo' => $this->rotuloCampo($this->campoQueijo($slug !== '' ? $slug : $nome)),
                    'precisa_formato' => $this->isMussarela($slug !== '' ? $slug : $nome),
                ];
            })
            ->filter(fn (array $queijo): bool => $queijo['nome'] !== '' && ($queijo['op_rotulo'] !== null || $queijo['precisa_formato']))
            ->values()
            ->all();
    }

    private function catalogoInsumos(): array
    {
        if (! $this->tabelaExiste('insumos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('insumos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(function (object $insumo): array {
                $nome = (string) ($insumo->nome ?? '');
                $campo = $this->campoInsumo('', $nome);

                return [
                    'id' => (int) ($insumo->id ?? 0),
                    'nome' => $nome,
                    'unidade' => (string) ($insumo->un_base ?? ''),
                    'op_rotulo' => $this->rotuloInsumo($campo, $nome),
                ];
            })
            ->filter(fn (array $insumo): bool => $insumo['nome'] !== '' && $insumo['op_rotulo'] !== null)
            ->values()
            ->all();
    }

    private function rotuloInsumo(?string $chave, string $nome): ?string
    {
        if ($chave === null) {
            return null;
        }

        if (str_starts_with($chave, 'fermento_extra_')) {
            $nome = trim($nome);

            return $nome !== '' ? mb_strtoupper($nome, 'UTF-8') : 'FERMENTO';
        }

        return $this->rotuloCampo($chave);
    }

    private function rotuloCampo(?string $chave): ?string
    {
        if ($chave === null) {
            return null;
        }

        foreach (self::CAMPOS_OP as $campo) {
            if ($campo['chave'] === $chave) {
                return $campo['rotulo'];
            }
        }

        return null;
    }

    private function campoFormatoMussarela(string $formato): ?string
    {
        return match ($this->normalizar($formato)) {
            'f1' => 'pecas_f1',
            'f4' => 'pecas_f4',
            'f6' => 'pecas_f6',
            default => null,
        };
    }

    private function isMussarela(string $tipoQueijo): bool
    {
        return str_contains($this->normalizar($tipoQueijo), 'mussarela');
    }

    private function camposComFormatoMussarela(array $campos, string $campoPecas): array
    {
        $rotulo = $this->rotuloCampo($campoPecas);
        if ($rotulo === null) {
            return $campos;
        }

        $campos = collect($campos)
            ->reject(function (array $campo): bool {
                $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));

                return in_array($rotulo, ['pecas f1', 'pecas f4', 'pecas f6'], true);
            })
            ->values()
            ->all();

        $novoCampo = ['rotulo' => $rotulo, 'valor' => ''];
        $indiceInsercao = null;

        foreach ($campos as $indice => $campo) {
            $rotuloAtual = $this->normalizar((string) ($campo['rotulo'] ?? ''));
            if ($rotuloAtual === 'lote do queijo') {
                $indiceInsercao = $indice;
                break;
            }
            if ($rotuloAtual === 'lts produzidos total') {
                $indiceInsercao = $indice;
            }
        }

        if ($indiceInsercao === null) {
            $campos[] = $novoCampo;

            return $campos;
        }

        array_splice($campos, $indiceInsercao + 1, 0, [$novoCampo]);

        return $campos;
    }

    private function buscarQueijo(ProducaoFormulacaoQueijo $formulacao): ?array
    {
        $tipo = $this->normalizar((string) $formulacao->tipo_queijo);

        if (! $this->tabelaExiste('producao_queijos')) {
            return null;
        }

        $queijos = DB::connection('raw')
            ->table('producao_queijos')
            ->where('ativo', 1)
            ->get();

        foreach ($queijos as $queijo) {
            if ($this->normalizar((string) $queijo->slug) === $tipo || $this->normalizar((string) $queijo->nome) === $tipo) {
                return ['codigo_balanca' => (string) $queijo->codigo_balanca];
            }
        }

        return null;
    }

    private function tabelaExiste(string $tabela): bool
    {
        return DB::connection('raw')
            ->table('information_schema.TABLES')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $tabela)
            ->exists();
    }

    private function converterQuantidade(float $quantidade, string $origem, string $destino): float
    {
        $origem = strtolower($origem);
        $destino = strtolower($destino);

        if ($origem === $destino || $origem === '') {
            return $quantidade;
        }
        if ($origem === 'l' && $destino === 'ml') {
            return $quantidade * 1000;
        }
        if ($origem === 'ml' && $destino === 'l') {
            return $quantidade / 1000;
        }
        if ($origem === 'kg' && $destino === 'g') {
            return $quantidade * 1000;
        }
        if ($origem === 'g' && $destino === 'kg') {
            return $quantidade / 1000;
        }

        return $quantidade;
    }

    private function valor(float $valor, string $sufixo = ''): string
    {
        if ($valor <= 0) {
            return '';
        }

        $formatado = rtrim(rtrim(number_format($valor, 2, ',', '.'), '0'), ',');

        return $formatado . $sufixo;
    }

    private function numeroDeCampo(string $valor): float
    {
        $numero = preg_replace('/[^0-9,.-]/', '', $valor);
        $numero = str_replace('.', '', (string) $numero);
        $numero = str_replace(',', '.', $numero);

        return (float) $numero;
    }

    private function gerarCodigo(string $data, ?Collection $formulacoes = null): string
    {
        $formulacoes ??= ProducaoFormulacaoQueijo::query()
            ->whereDate('data_formulacao', $data)
            ->where('status', '!=', 'cancelada')
            ->orderBy('numero_queijomatic')
            ->orderBy('id')
            ->get();

        $base = $formulacoes->first();

        return $base instanceof ProducaoFormulacaoQueijo
            ? $this->gerarCodigoDaFormulacao($base)
            : 'op' . preg_replace('/[^0-9]/', '', $data);
    }

    private function gerarCodigoDaFormulacao(ProducaoFormulacaoQueijo $formulacao): string
    {
        $queijo = $this->buscarQueijo($formulacao);
        $produto = preg_replace('/[^a-z0-9]/', '', strtolower((string) ($queijo['codigo_balanca'] ?? '0')));
        $lote = preg_replace('/[^a-z0-9]/', '', strtolower((string) $formulacao->lote_queijo));

        $base = 'op' . $produto . ($lote !== '' ? $lote : (string) $formulacao->id);

        return $this->codigoUnicoDaFormulacao($base, $formulacao);
    }

    private function codigoUnicoDaFormulacao(string $base, ProducaoFormulacaoQueijo $formulacao): string
    {
        $existente = ProducaoOrdemProducao::query()
            ->where('codigo_ordem', $base)
            ->first();

        if ($existente === null || (int) $existente->formulacao_queijo_id === (int) $formulacao->id) {
            return $base;
        }

        $codigo = $base . (string) $formulacao->id;
        $tentativa = 2;

        while (ProducaoOrdemProducao::query()->where('codigo_ordem', $codigo)->exists()) {
            $codigo = $base . (string) $formulacao->id . (string) $tentativa;
            $tentativa++;
        }

        return $codigo;
    }

    private function normalizarCodigo(string $codigo): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower(trim($codigo))) ?? '';
    }

    private function normalizar(string $valor): string
    {
        $normalizado = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($valor));

        return strtolower($normalizado !== false ? $normalizado : trim($valor));
    }
}
