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
        $ordem = ProducaoOrdemProducao::query()->where('id', $id)->first();

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
        $campos = $this->normalizarCampos($payload['campos'] ?? []);

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

    public function atualizar(int $id, array $payload): array|bool|null
    {
        return DB::connection('raw')->transaction(function () use ($id, $payload): array|bool|null {
            $ordem = ProducaoOrdemProducao::query()
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if ($ordem === null) {
                return null;
            }

            if (($ordem->status ?? 'rascunho') !== 'rascunho') {
                return false;
            }

            $attributes = [
                'data_ordem' => (string) $payload['data'],
                'campos_json' => $this->normalizarCampos($payload['campos'] ?? []),
            ];

            if (array_key_exists('observacoes', $payload)) {
                $attributes['observacoes'] = $payload['observacoes'];
            }

            $ordem->forceFill($attributes)->save();

            return $this->formatarOrdem($ordem->refresh(), $this->formulacoesDaOrdem($ordem));
        });
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
        $tipoQueijo = trim((string) $formulacao->tipo_queijo);
        if ($data === null || $tipoQueijo === '') {
            return null;
        }

        return $this->comLockDoGrupo($data, $tipoQueijo, function () use ($formulacaoId, $data, $tipoQueijo): ?array {
            return DB::connection('raw')->transaction(function () use ($formulacaoId, $data, $tipoQueijo): ?array {
                $formulacao = ProducaoFormulacaoQueijo::query()
                    ->where('id', $formulacaoId)
                    ->lockForUpdate()
                    ->first();

                if ($formulacao === null || $formulacao->status !== 'finalizada') {
                    return null;
                }

                $ordens = ProducaoOrdemProducao::query()
                    ->whereDate('data_ordem', $data)
                    ->where('tipo_queijo', $tipoQueijo)
                    ->where('origem', 'automatica')
                    ->where('status', '!=', 'cancelada')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                [$ordem, , $camposManuais] = $this->consolidarOrdensDoGrupo($ordens);

                if ($ordem === null) {
                    $ordem = ProducaoOrdemProducao::query()->create([
                        'codigo_ordem' => $this->gerarCodigoDiario($formulacao, $data),
                        'formulacao_queijo_id' => $formulacao->id,
                        'tipo_queijo' => $tipoQueijo,
                        'data_ordem' => $data,
                        'campos_json' => [],
                        'origem' => 'automatica',
                        'status' => $this->isMussarela($tipoQueijo) ? 'aguardando_formato' : 'rascunho',
                        'observacoes' => 'OP diária gerada automaticamente.',
                    ]);
                }

                $jaVinculada = (int) ($formulacao->ordem_producao_id ?? 0) === (int) $ordem->id;
                if (($ordem->status ?? '') === 'finalizada' && ! $jaVinculada) {
                    throw new \DomainException('A OP deste queijo e dia já foi finalizada e não pode receber outra formulação.');
                }

                $formulacao->forceFill(['ordem_producao_id' => $ordem->id])->save();
                $formulacoes = $this->formulacoesDaOrdem($ordem);

                if (($ordem->status ?? '') !== 'finalizada') {
                    $ordem->forceFill([
                        'formulacao_queijo_id' => $formulacoes->first()?->id,
                        'tipo_queijo' => $tipoQueijo,
                        'campos_json' => $this->mesclarCamposCalculadosEManuais($this->camposAutomaticos($formulacoes), $camposManuais),
                        'observacoes' => $formulacoes->count() . ' formulação(ões) agrupada(s) nesta OP diária.',
                    ])->save();
                }

                return $this->formatarOrdem($ordem->refresh(), $formulacoes);
            });
        });
    }

    public function reconciliarOrdensDiarias(?string $data = null): array
    {
        $this->backfillVinculosLegados();

        $grupos = ProducaoOrdemProducao::query()
            ->where('origem', 'automatica')
            ->whereNotNull('tipo_queijo')
            ->when($data !== null && $data !== '', fn ($query) => $query->whereDate('data_ordem', $data))
            ->orderBy('data_ordem')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (ProducaoOrdemProducao $ordem): string => optional($ordem->data_ordem)->toDateString() . '|' . $this->normalizar((string) $ordem->tipo_queijo));

        $resultado = ['grupos' => 0, 'ordens_mescladas' => 0, 'conflitos' => []];

        foreach ($grupos as $grupo) {
            $base = $grupo->first();
            if (! $base instanceof ProducaoOrdemProducao) {
                continue;
            }

            $dataGrupo = optional($base->data_ordem)->toDateString();
            $tipoQueijo = (string) $base->tipo_queijo;
            if ($dataGrupo === null || $tipoQueijo === '') {
                continue;
            }

            try {
                $mescladas = $this->comLockDoGrupo($dataGrupo, $tipoQueijo, function () use ($dataGrupo, $tipoQueijo): int {
                    return DB::connection('raw')->transaction(function () use ($dataGrupo, $tipoQueijo): int {
                        $ordens = ProducaoOrdemProducao::query()
                            ->whereDate('data_ordem', $dataGrupo)
                            ->where('tipo_queijo', $tipoQueijo)
                            ->where('origem', 'automatica')
                            ->orderBy('id')
                            ->lockForUpdate()
                            ->get();
                        [$ordem, $totalMescladas, $camposManuais] = $this->consolidarOrdensDoGrupo($ordens);

                        if ($ordem instanceof ProducaoOrdemProducao) {
                            $formulacoes = $this->formulacoesDaOrdem($ordem);
                            if ($formulacoes->isNotEmpty()) {
                                $ordem->forceFill([
                                    'formulacao_queijo_id' => $formulacoes->first()?->id,
                                    'campos_json' => $this->mesclarCamposCalculadosEManuais($this->camposAutomaticos($formulacoes), $camposManuais),
                                    'observacoes' => $formulacoes->count() . ' formulação(ões) agrupada(s) nesta OP diária.',
                                ])->save();
                            }
                        }

                        return $totalMescladas;
                    });
                });
                $resultado['grupos']++;
                $resultado['ordens_mescladas'] += $mescladas;
            } catch (\DomainException $exception) {
                $resultado['conflitos'][] = $dataGrupo . ' - ' . $tipoQueijo . ': ' . $exception->getMessage();
            }
        }

        return $resultado;
    }

    private function backfillVinculosLegados(): void
    {
        $connection = DB::connection('raw');
        $connection->statement(
            'UPDATE producao_formulacoes_queijo f '
            .'INNER JOIN ordens_producao o ON o.formulacao_queijo_id = f.id '
            .'SET f.ordem_producao_id = o.id '
            .'WHERE f.ordem_producao_id IS NULL'
        );
        $connection->statement(
            'UPDATE ordens_producao o '
            .'INNER JOIN producao_formulacoes_queijo f ON f.id = o.formulacao_queijo_id '
            .'SET o.tipo_queijo = f.tipo_queijo '
            .'WHERE o.tipo_queijo IS NULL OR o.tipo_queijo = \'\''
        );
    }

    private function comLockDoGrupo(string $data, string $tipoQueijo, callable $callback): mixed
    {
        $connection = DB::connection('raw');
        $lock = 'santilac_op_diaria_' . sha1($data . '|' . $this->normalizar($tipoQueijo));
        $result = $connection->selectOne('SELECT GET_LOCK(?, 10) AS acquired', [$lock]);

        if ((int) ($result->acquired ?? 0) !== 1) {
            throw new \DomainException('Não foi possível bloquear a OP diária para atualização. Tente novamente.');
        }

        try {
            return $callback();
        } finally {
            $connection->selectOne('SELECT RELEASE_LOCK(?) AS released', [$lock]);
        }
    }

    private function consolidarOrdensDoGrupo(Collection $ordens): array
    {
        if ($ordens->isEmpty()) {
            return [null, 0, []];
        }

        $ordens = $ordens->sortBy('id')->values();
        $camposManuais = $this->camposManuaisDasOrdens($ordens);
        if ($ordens->count() === 1) {
            return [$ordens->first(), 0, $camposManuais];
        }

        $ids = $ordens->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $idsComEmbalagem = $this->tabelaExiste('embalagem_lotes')
            ? DB::connection('raw')->table('embalagem_lotes')->whereIn('ordem_producao_id', $ids)->pluck('ordem_producao_id')->unique()->values()
            : collect();

        if ($idsComEmbalagem->count() > 1) {
            throw new \DomainException('há mais de uma OP com movimentação na embalagem; consolidação automática bloqueada.');
        }

        $ordemPrincipal = $idsComEmbalagem->isNotEmpty()
            ? $ordens->first(fn (ProducaoOrdemProducao $ordem): bool => $idsComEmbalagem->contains((int) $ordem->id))
            : ($ordens->first(fn (ProducaoOrdemProducao $ordem): bool => ($ordem->status ?? '') === 'finalizada')
                ?? $ordens->first(fn (ProducaoOrdemProducao $ordem): bool => ($ordem->status ?? '') !== 'cancelada')
                ?? $ordens->first());

        if (! $ordemPrincipal instanceof ProducaoOrdemProducao) {
            return [null, 0, $camposManuais];
        }

        $mescladas = 0;
        foreach ($ordens as $ordem) {
            if ((int) $ordem->id === (int) $ordemPrincipal->id) {
                continue;
            }

            ProducaoFormulacaoQueijo::query()
                ->where('ordem_producao_id', $ordem->id)
                ->update(['ordem_producao_id' => $ordemPrincipal->id]);

            if ($ordemPrincipal->formulacao_queijo_id === null && $ordem->formulacao_queijo_id !== null) {
                $ordemPrincipal->formulacao_queijo_id = $ordem->formulacao_queijo_id;
            }

            $ordem->forceFill([
                'tipo_queijo' => null,
                'status' => 'cancelada',
                'observacoes' => 'Consolidada na OP ' . $ordemPrincipal->codigo_ordem . '.',
            ])->save();
            $mescladas++;
        }

        $ordemPrincipal->save();

        return [$ordemPrincipal->refresh(), $mescladas, $camposManuais];
    }

    private function camposManuaisDasOrdens(Collection $ordens): array
    {
        $campos = [];

        foreach ($ordens as $ordem) {
            foreach (($ordem->campos_json ?? []) as $campo) {
                $rotulo = trim((string) ($campo['rotulo'] ?? ''));
                $chave = $this->normalizar($rotulo);
                $valor = trim((string) ($campo['valor'] ?? ''));

                if (! str_starts_with($chave, 'pecas ') || $valor === '') {
                    continue;
                }

                $campos[$chave] ??= ['rotulo' => $rotulo, 'total' => 0.0];
                $campos[$chave]['total'] += $this->numeroDeCampo($valor);
            }
        }

        return collect($campos)
            ->map(fn (array $campo): array => [
                'rotulo' => $campo['rotulo'],
                'valor' => $this->valor((float) $campo['total']),
            ])
            ->values()
            ->all();
    }

    private function mesclarCamposCalculadosEManuais(array $calculados, array $manuais): array
    {
        $porRotulo = collect($manuais)->keyBy(fn (array $campo): string => $this->normalizar((string) ($campo['rotulo'] ?? '')));
        $resultado = collect($calculados)->map(function (array $campo) use ($porRotulo): array {
            $manual = $porRotulo->get($this->normalizar((string) ($campo['rotulo'] ?? '')));

            return is_array($manual) ? $manual : $campo;
        });
        $existentes = $resultado->map(fn (array $campo): string => $this->normalizar((string) ($campo['rotulo'] ?? '')));

        return $resultado
            ->concat(collect($manuais)->reject(fn (array $campo): bool => $existentes->contains($this->normalizar((string) ($campo['rotulo'] ?? '')))))
            ->values()
            ->all();
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
            'tipo_queijo' => $ordem->tipo_queijo ?? $formulacao?->tipo_queijo ?? $this->tipoQueijoDosCampos($ordem->campos_json),
            'lote_queijo' => $formulacao?->lote_queijo,
            'origem' => (string) $ordem->origem,
            'status' => $ordem->status ?? 'rascunho',
            'pendencia_formato' => ($ordem->status ?? '') === 'aguardando_formato',
        ];
    }

    private function formulacoesDaOrdem(ProducaoOrdemProducao $ordem): Collection
    {
        $formulacoes = ProducaoFormulacaoQueijo::query()
            ->where('ordem_producao_id', $ordem->id)
            ->where('status', 'finalizada')
            ->orderBy('id')
            ->get();

        if ($formulacoes->isNotEmpty()) {
            return $formulacoes;
        }

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

    private function gerarCodigoDiario(ProducaoFormulacaoQueijo $formulacao, string $data): string
    {
        $queijo = $this->buscarQueijo($formulacao);
        $produto = preg_replace('/[^a-z0-9]/', '', strtolower((string) ($queijo['codigo_balanca'] ?? $formulacao->tipo_queijo)));
        $dia = preg_replace('/[^0-9]/', '', $data);
        $base = substr('op' . ($produto !== '' ? $produto : 'queijo') . $dia, 0, 32);

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

    private function normalizarCampos(array $campos): array
    {
        return collect($campos)
            ->map(fn (array $campo): array => [
                'rotulo' => trim((string) ($campo['rotulo'] ?? '')),
                'valor' => trim((string) ($campo['valor'] ?? '')),
            ])
            ->filter(fn (array $campo): bool => $campo['rotulo'] !== '')
            ->values()
            ->all();
    }

    private function normalizar(string $valor): string
    {
        $normalizado = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($valor));

        return strtolower($normalizado !== false ? $normalizado : trim($valor));
    }
}
