<?php

namespace App\Services\Embalagem;

use App\Models\Embalagem\EmbalagemCaixa;
use App\Models\Embalagem\EmbalagemLote;
use App\Models\Embalagem\EmbalagemPalete;
use App\Models\Producao\ProducaoFormulacaoQueijo;
use App\Models\Producao\ProducaoOrdemProducao;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class EmbalagemService
{
    private const BARCODE = [
        'length' => 13,
        'product_start' => 2,
        'product_length' => 4,
        'lot_start' => 5,
        'lot_length' => 3,
        'cheese_code_pos' => 6,
        'weight_start' => 8,
        'weight_length' => 5,
        'weight_divisor' => 1000,
    ];

    public function validarOrdem(string $codigoOrdem): array
    {
        $codigoOrdem = $this->normalizarCodigo($codigoOrdem);
        if ($codigoOrdem === '') {
            throw new DomainException('Digite o código da OP.');
        }

        $ordem = ProducaoOrdemProducao::query()
            ->where('codigo_ordem', $codigoOrdem)
            ->first();

        if ($ordem === null) {
            throw new DomainException('OP não encontrada.');
        }

        if (($ordem->status ?? '') === 'cancelada') {
            throw new DomainException('Esta OP está cancelada.');
        }

        if (($ordem->status_embalagem ?? 'pendente') === 'concluida') {
            throw new DomainException('Esta OP já foi finalizada na embalagem.');
        }

        $dados = $this->dadosOrdem($ordem);
        $queijo = $this->buscarQueijo($dados['tipo_queijo']);

        if ($queijo === null) {
            throw new DomainException('Queijo da OP não encontrado no catálogo de produção.');
        }

        $lote = $this->loteAbertoOuNovo($ordem, $dados, $queijo);
        $palete = $this->paleteAtual($lote, (int) $queijo['caixas_por_palete']);

        $ordem->forceFill(['status_embalagem' => 'embalando'])->save();

        return $this->respostaOperacao($ordem, $lote, $queijo, $palete);
    }

    public function estado(int $loteId): array
    {
        $lote = EmbalagemLote::query()->where('id', $loteId)->first();
        if ($lote === null) {
            throw new DomainException('Lote de embalagem não encontrado.');
        }

        $ordem = ProducaoOrdemProducao::query()->where('id', $lote->ordem_producao_id)->first();
        if ($ordem === null) {
            throw new DomainException('OP vinculada ao lote não encontrada.');
        }

        $queijo = $this->buscarQueijo($lote->tipo_queijo);
        if ($queijo === null) {
            throw new DomainException('Queijo do lote não encontrado no catálogo.');
        }

        return $this->respostaOperacao($ordem, $lote, $queijo, $this->paleteAtual($lote, (int) $queijo['caixas_por_palete']));
    }

    public function registrarCaixa(int $loteId, string $codigoBarra): array
    {
        $codigoBarra = trim($codigoBarra);
        if ($codigoBarra === '') {
            throw new DomainException('Informe o código da balança.');
        }

        $lote = EmbalagemLote::query()->where('id', $loteId)->first();
        if ($lote === null) {
            throw new DomainException('Lote de embalagem não encontrado.');
        }

        if ($lote->status === 'finalizado') {
            throw new DomainException('Este lote já foi finalizado.');
        }

        $ordem = ProducaoOrdemProducao::query()->where('id', $lote->ordem_producao_id)->first();
        if ($ordem === null) {
            throw new DomainException('OP vinculada ao lote não encontrada.');
        }

        $queijo = $this->buscarQueijo($lote->tipo_queijo);
        if ($queijo === null) {
            throw new DomainException('Queijo do lote não encontrado no catálogo.');
        }

        $parsed = $this->parseBarcode($codigoBarra);
        if ($parsed === null) {
            throw new DomainException('Código da balança inválido.');
        }

        $codigoBalanca = preg_replace('/[^0-9]/', '', (string) ($queijo['codigo_balanca'] ?? ''));
        if ($codigoBalanca !== '' && $parsed['codigo_queijo'] !== $codigoBalanca) {
            throw new DomainException('Código do queijo na balança não pertence à OP aberta.');
        }

        return DB::connection('raw')->transaction(function () use ($lote, $ordem, $queijo, $parsed): array {
            $lote = EmbalagemLote::query()
                ->where('id', $lote->id)
                ->lockForUpdate()
                ->first();

            if ($lote === null) {
                throw new DomainException('Lote de embalagem não encontrado.');
            }

            if ($lote->status === 'finalizado') {
                throw new DomainException('Este lote já foi finalizado.');
            }

            $palete = $this->paleteAtual($lote, (int) $queijo['caixas_por_palete'], true);
            $caixasNoPalete = EmbalagemCaixa::query()
                ->where('palete_id', $palete->id)
                ->get(['palete_id', 'peso']);

            if ($this->pesoJaRegistradoNoPalete($caixasNoPalete, (int) $palete->id, $parsed['peso'])) {
                $peso = number_format($parsed['peso'], 3, ',', '.');

                throw new DomainException(
                    "O peso {$peso} kg já foi registrado no palete {$palete->numero}. A caixa não foi gravada.",
                );
            }

            $sequencia = ((int) EmbalagemCaixa::query()->where('lote_id', $lote->id)->max('sequencia')) + 1;

            EmbalagemCaixa::query()->create([
                'lote_id' => $lote->id,
                'palete_id' => $palete->id,
                'sequencia' => $sequencia,
                'codigo_barra' => $parsed['digits'],
                'peso' => $parsed['peso'],
            ]);

            $palete->forceFill([
                'caixas' => $palete->caixas + 1,
                'peso_total' => $palete->peso_total + $parsed['peso'],
            ]);

            if ($palete->caixas >= (int) $queijo['caixas_por_palete']) {
                $palete->status = 'cheio';
                $this->prepararEtiquetaPalete($palete);
            }
            $palete->save();

            $lote->forceFill([
                'caixas_total' => $lote->caixas_total + 1,
                'pecas_total' => $lote->pecas_total + (int) $queijo['pecas_por_caixa'],
                'peso_total' => $lote->peso_total + $parsed['peso'],
            ])->save();

            $ordem->forceFill([
                'status_embalagem' => 'embalando',
                'pecas_embaladas' => $lote->pecas_total,
                'peso_total_embalagem' => $lote->peso_total,
            ])->save();

            $this->baixarEstoqueEmbalagem($queijo);

            return $this->respostaOperacao($ordem, $lote->refresh(), $queijo, $palete->refresh());
        });
    }

    public function finalizar(
        int $loteId,
        int $pecasAvulsas,
        float $pesoPecasAvulsas = 0,
        string $paleteParcial = 'preencher',
    ): array
    {
        $pecasAvulsas = max(0, $pecasAvulsas);
        $pesoPecasAvulsas = round(max(0, $pesoPecasAvulsas), 3);
        $paleteParcial = in_array($paleteParcial, ['preencher', 'finalizar'], true)
            ? $paleteParcial
            : 'preencher';

        if ($pecasAvulsas > 0 && $pesoPecasAvulsas <= 0) {
            throw new DomainException('Informe o peso das peças avulsas.');
        }

        return DB::connection('raw')->transaction(function () use ($loteId, $pecasAvulsas, $pesoPecasAvulsas, $paleteParcial): array {
            $lote = EmbalagemLote::query()->where('id', $loteId)->lockForUpdate()->first();
            if ($lote === null) {
                throw new DomainException('Lote de embalagem não encontrado.');
            }

            if ($lote->status === 'finalizado') {
                throw new DomainException('Este lote já foi finalizado.');
            }

            $ordem = ProducaoOrdemProducao::query()->where('id', $lote->ordem_producao_id)->first();
            if ($ordem === null) {
                throw new DomainException('OP vinculada ao lote não encontrada.');
            }

            $totalPecas = (int) $lote->pecas_total + $pecasAvulsas;
            $pesoTotal = round((float) $lote->peso_total + $pesoPecasAvulsas, 3);
            $campos = $this->camposComPecasAtualizadas($ordem->campos_json, $lote->tipo_queijo, $totalPecas);

            if ($paleteParcial === 'finalizar') {
                $paleteIds = EmbalagemCaixa::query()
                    ->where('lote_id', $lote->id)
                    ->pluck('palete_id')
                    ->unique()
                    ->values();

                EmbalagemPalete::query()
                    ->whereIn('id', $paleteIds)
                    ->where('status', 'aberto')
                    ->where('caixas', '>', 0)
                    ->get()
                    ->each(function (EmbalagemPalete $palete): void {
                        $palete->status = 'finalizado';
                        $this->prepararEtiquetaPalete($palete);
                        $palete->save();
                    });
            }

            $lote->forceFill([
                'pecas_total' => $totalPecas,
                'peso_total' => $pesoTotal,
                'peso_pecas_avulsas' => $pesoPecasAvulsas,
                'status' => 'finalizado',
            ])->save();

            $ordem->forceFill([
                'campos_json' => $campos,
                'status_embalagem' => 'concluida',
                'pecas_embaladas' => $totalPecas,
                'peso_total_embalagem' => $pesoTotal,
                'embalagem_finalizada_at' => now('America/Sao_Paulo'),
            ])->save();

            $queijo = $this->buscarQueijo($lote->tipo_queijo) ?? [];
            if ($pecasAvulsas > 0) {
                $this->baixarEstoqueEmbalagem($queijo, ['embalagem_codigo'], $pecasAvulsas);
            }

            return $this->respostaOperacao($ordem, $lote->refresh(), $queijo, null);
        });
    }

    public function paletesPendentesEtiqueta(string $baseUrl): array
    {
        return EmbalagemPalete::query()
            ->whereIn('status', ['cheio', 'finalizado'])
            ->where('caixas', '>', 0)
            ->where(function ($query): void {
                $query
                    ->whereNull('etiqueta_status')
                    ->orWhereIn('etiqueta_status', ['pendente', 'erro']);
            })
            ->orderBy('id')
            ->limit(20)
            ->get()
            ->map(function (EmbalagemPalete $palete) use ($baseUrl): array {
                $this->prepararEtiquetaPalete($palete);
                $palete->save();

                return $this->dadosEtiquetaPalete($palete->refresh(), $baseUrl);
            })
            ->values()
            ->all();
    }

    public function marcarEtiquetaPalete(int $paleteId, bool $impressa, ?string $erro = null): array
    {
        $palete = EmbalagemPalete::query()->where('id', $paleteId)->first();
        if ($palete === null) {
            throw new DomainException('Palete não encontrado.');
        }

        $palete->forceFill([
            'etiqueta_status' => $impressa ? 'impressa' : 'erro',
            'etiqueta_impressa_at' => $impressa ? now('America/Sao_Paulo') : null,
            'etiqueta_erro' => $impressa ? null : mb_substr((string) $erro, 0, 255),
        ])->save();

        return ['palete_id' => (int) $palete->id, 'etiqueta_status' => (string) $palete->etiqueta_status];
    }

    public function resumoPaletePorToken(string $token, string $baseUrl): array
    {
        $palete = EmbalagemPalete::query()->where('etiqueta_token', $token)->first();
        if ($palete === null) {
            throw new DomainException('Palete não encontrado.');
        }

        return $this->dadosEtiquetaPalete($palete, $baseUrl, true);
    }

    public function htmlResumoPalete(string $token, string $baseUrl): string
    {
        $dados = $this->resumoPaletePorToken($token, $baseUrl);
        $linhas = '';
        foreach ($dados['caixas'] as $caixa) {
            $linhas .= '<tr>'
                . '<td>' . $this->html((string) $caixa['sequencia']) . '</td>'
                . '<td>' . $this->html((string) $caixa['codigo_barra']) . '</td>'
                . '<td>' . $this->html(number_format((float) $caixa['peso'], 3, ',', '.')) . ' kg</td>'
                . '<td>' . $this->html((string) $caixa['hora']) . '</td>'
                . '</tr>';
        }

        return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Palete ' . $this->html((string) $dados['numero']) . '</title>'
            . '<style>body{margin:0;background:#000;color:#f5f5f5;font-family:Inter,Segoe UI,Arial,sans-serif}main{padding:22px;display:grid;gap:16px}h1{margin:0;font-size:28px}p{margin:0;color:#b7bac1}.card{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:16px;background:#08090a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.info span{display:block;color:#8d99ad;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.info b{display:block;margin-top:5px;font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;font-size:14px}th{color:#8d99ad;font-size:11px;text-transform:uppercase;letter-spacing:.08em}</style>'
            . '</head><body><main>'
            . '<header><h1>Palete ' . $this->html((string) $dados['numero']) . '</h1><p>' . $this->html((string) $dados['queijo']) . ' | OP ' . $this->html((string) $dados['codigo_ordem']) . '</p></header>'
            . '<section class="card grid">'
            . $this->infoHtml('Lote', (string) $dados['lote'])
            . $this->infoHtml('Fabricação', (string) $dados['data_fabricacao'])
            . $this->infoHtml('Validade', (string) $dados['data_validade'])
            . $this->infoHtml('Caixas', (string) $dados['caixas_total'])
            . $this->infoHtml('Peso total', number_format((float) $dados['peso_total'], 3, ',', '.') . ' kg')
            . '</section>'
            . '<section class="card"><table><thead><tr><th>#</th><th>Código</th><th>Peso</th><th>Hora</th></tr></thead><tbody>'
            . ($linhas !== '' ? $linhas : '<tr><td colspan="4">Nenhuma caixa registrada.</td></tr>')
            . '</tbody></table></section>'
            . '</main></body></html>';
    }

    private function dadosOrdem(ProducaoOrdemProducao $ordem): array
    {
        $formulacao = $ordem->formulacao_queijo_id !== null
            ? ProducaoFormulacaoQueijo::query()->where('id', $ordem->formulacao_queijo_id)->first()
            : null;

        if ($formulacao !== null) {
            return [
                'tipo_queijo' => (string) $formulacao->tipo_queijo,
                'lote' => (string) $formulacao->lote_queijo,
                'data' => optional($formulacao->data_formulacao)->toDateString(),
            ];
        }

        $tipo = '';
        $lote = '';
        foreach ($ordem->campos_json as $campo) {
            $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));
            $valor = trim((string) ($campo['valor'] ?? ''));
            if ($tipo === '' && str_starts_with($rotulo, 'pecas ')) {
                $tipo = trim(str_replace('pecas ', '', $rotulo));
            }
            if ($lote === '' && str_contains($rotulo, 'lote')) {
                $lote = $valor;
            }
        }

        return [
            'tipo_queijo' => $tipo,
            'lote' => $lote !== '' ? $lote : preg_replace('/[^0-9]/', '', (string) $ordem->codigo_ordem),
            'data' => optional($ordem->data_ordem)->toDateString(),
        ];
    }

    private function loteAbertoOuNovo(ProducaoOrdemProducao $ordem, array $dados, array $queijo): EmbalagemLote
    {
        $data = $dados['data'] ?: optional($ordem->data_ordem)->toDateString();

        return EmbalagemLote::query()->firstOrCreate(
            ['ordem_producao_id' => $ordem->id],
            [
                'codigo_ordem' => (string) $ordem->codigo_ordem,
                'lote' => (string) $dados['lote'],
                'tipo_queijo' => (string) $queijo['slug'],
                'data_fabricacao' => $data,
                'data_validade' => $data ? date('Y-m-d', strtotime($data . ' +120 days')) : null,
                'status' => 'aberto',
            ],
        );
    }

    private function prepararEtiquetaPalete(EmbalagemPalete $palete): void
    {
        if (! $this->colunasExistem('embalagem_paletes', ['etiqueta_token', 'etiqueta_status'])) {
            return;
        }

        if (empty($palete->etiqueta_token)) {
            $palete->etiqueta_token = Str::lower(Str::random(32));
        }

        if (($palete->etiqueta_status ?? null) === null) {
            $palete->etiqueta_status = 'pendente';
        }

        if (($palete->etiqueta_status ?? null) === 'erro') {
            $palete->etiqueta_status = 'pendente';
        }

        $palete->etiqueta_erro = null;
    }

    private function dadosEtiquetaPalete(EmbalagemPalete $palete, string $baseUrl, bool $comCaixas = false): array
    {
        $lote = EmbalagemLote::query()->where('id', $palete->lote_id)->first();
        if ($lote === null) {
            throw new DomainException('Lote do palete não encontrado.');
        }

        $queijo = $this->buscarQueijo($lote->tipo_queijo);
        $lotes = DB::connection('raw')->table('embalagem_caixas as c')
            ->join('embalagem_lotes as l', 'l.id', '=', 'c.lote_id')
            ->where('c.palete_id', $palete->id)
            ->groupBy('l.id', 'l.codigo_ordem', 'l.lote', 'l.data_fabricacao', 'l.data_validade')
            ->orderBy('l.data_fabricacao')
            ->get([
                'l.codigo_ordem',
                'l.lote',
                'l.data_fabricacao',
                'l.data_validade',
                DB::raw('COUNT(c.id) as caixas'),
                DB::raw('SUM(c.peso) as peso'),
            ]);
        if ($lotes->isEmpty()) {
            $lotes = collect([(object) [
                'codigo_ordem' => $lote->codigo_ordem,
                'lote' => $lote->lote,
                'data_fabricacao' => optional($lote->data_fabricacao)->toDateString(),
                'data_validade' => optional($lote->data_validade)->toDateString(),
                'caixas' => 0,
                'peso' => 0,
            ]]);
        }

        $primeiroLote = $lotes->first();
        $token = (string) $palete->etiqueta_token;
        if ($token === '') {
            $this->prepararEtiquetaPalete($palete);
            $palete->save();
            $token = (string) $palete->etiqueta_token;
        }

        $dados = [
            'palete_id' => (int) $palete->id,
            'codigo_barras' => 'PAL-' . (int) $palete->id,
            'token' => $token,
            'qr_url' => rtrim($baseUrl, '/') . '/api/embalagem/paletes/' . $token . '/visualizar',
            'numero' => (int) $palete->numero,
            'status' => (string) $palete->status,
            'etiqueta_status' => (string) ($palete->etiqueta_status ?? 'pendente'),
            'codigo_ordem' => $lotes->pluck('codigo_ordem')->unique()->implode(', '),
            'lote' => $lotes->pluck('lote')->unique()->implode(', '),
            'queijo' => (string) ($queijo['nome'] ?? $lote->tipo_queijo),
            'data_fabricacao' => $this->formatarDataEtiqueta($primeiroLote->data_fabricacao ?? null),
            'data_validade' => $this->formatarDataEtiqueta($primeiroLote->data_validade ?? null),
            'caixas_total' => (int) $palete->caixas,
            'peso_total' => (float) $palete->peso_total,
            'lotes' => $lotes->map(fn (object $item): array => [
                'codigo_ordem' => (string) $item->codigo_ordem,
                'lote' => (string) $item->lote,
                'data_fabricacao' => $this->formatarDataEtiqueta($item->data_fabricacao ?? null),
                'data_validade' => $this->formatarDataEtiqueta($item->data_validade ?? null),
                'caixas' => (int) $item->caixas,
                'peso' => (float) $item->peso,
            ])->values()->all(),
        ];

        if ($comCaixas) {
            $dados['caixas'] = DB::connection('raw')->table('embalagem_caixas as c')
                ->join('embalagem_lotes as l', 'l.id', '=', 'c.lote_id')
                ->where('c.palete_id', $palete->id)
                ->orderBy('c.sequencia')
                ->get(['c.*', 'l.lote'])
                ->map(fn (object $caixa): array => [
                    'id' => (int) $caixa->id,
                    'sequencia' => (int) $caixa->sequencia,
                    'codigo_barra' => (string) $caixa->codigo_barra,
                    'peso' => (float) $caixa->peso,
                    'lote' => (string) $caixa->lote,
                    'hora' => date('H:i', strtotime((string) $caixa->created_at)),
                ])
                ->values()
                ->all();
        }

        return $dados;
    }

    private function infoHtml(string $label, string $value): string
    {
        return '<div class="info"><span>' . $this->html($label) . '</span><b>' . $this->html($value) . '</b></div>';
    }

    private function html(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function paleteAtual(EmbalagemLote $lote, int $caixasPorPalete, bool $lock = false): EmbalagemPalete
    {
        $query = EmbalagemPalete::query()
            ->where('status', 'aberto')
            ->where('caixas', '<', max(1, $caixasPorPalete))
            ->whereExists(function ($sub) use ($lote): void {
                $sub->selectRaw('1')
                    ->from('embalagem_lotes as lote_palete')
                    ->whereColumn('lote_palete.id', 'embalagem_paletes.lote_id')
                    ->where('lote_palete.tipo_queijo', $lote->tipo_queijo);
            })
            ->orderByDesc('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        $palete = $query->first();
        if ($palete !== null) {
            return $palete;
        }

        $numero = ((int) EmbalagemPalete::query()->max('numero')) + 1;

        return EmbalagemPalete::query()->create([
            'lote_id' => $lote->id,
            'numero' => $numero,
            'caixas' => 0,
            'peso_total' => 0,
            'status' => 'aberto',
        ]);
    }

    private function pesoJaRegistradoNoPalete(iterable $caixas, int $paleteId, float $peso): bool
    {
        $pesoEmGramas = (int) round($peso * 1000);

        foreach ($caixas as $caixa) {
            $paleteDaCaixa = is_array($caixa) ? $caixa['palete_id'] : $caixa->palete_id;
            $pesoDaCaixa = is_array($caixa) ? $caixa['peso'] : $caixa->peso;

            if ((int) $paleteDaCaixa === $paleteId && (int) round((float) $pesoDaCaixa * 1000) === $pesoEmGramas) {
                return true;
            }
        }

        return false;
    }

    private function respostaOperacao(ProducaoOrdemProducao $ordem, EmbalagemLote $lote, array $queijo, ?EmbalagemPalete $palete): array
    {
        $paletes = EmbalagemPalete::query()
            ->where(function ($query) use ($lote): void {
                $query->where('lote_id', $lote->id)
                    ->orWhereIn('id', EmbalagemCaixa::query()
                        ->select('palete_id')
                        ->where('lote_id', $lote->id));
            })
            ->orderBy('numero')
            ->get()
            ->map(fn (EmbalagemPalete $item): array => [
                'id' => (int) $item->id,
                'numero' => (int) $item->numero,
                'caixas' => (int) $item->caixas,
                'peso_total' => (float) $item->peso_total,
                'status' => (string) $item->status,
            ])
            ->values()
            ->all();

        $historico = EmbalagemCaixa::query()
            ->where('lote_id', $lote->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (EmbalagemCaixa $item): array => [
                'id' => (int) $item->id,
                'sequencia' => (int) $item->sequencia,
                'codigo_barra' => (string) $item->codigo_barra,
                'peso' => (float) $item->peso,
                'palete_id' => (int) $item->palete_id,
                'created_at' => optional($item->created_at)->toDateTimeString(),
            ])
            ->values()
            ->all();

        return [
            'ordem' => [
                'id' => (int) $ordem->id,
                'codigo' => (string) $ordem->codigo_ordem,
                'status_embalagem' => (string) ($ordem->status_embalagem ?? 'pendente'),
            ],
            'lote' => [
                'id' => (int) $lote->id,
                'lote' => (string) $lote->lote,
                'tipo_queijo' => (string) $lote->tipo_queijo,
                'nome_queijo' => (string) ($queijo['nome'] ?? $lote->tipo_queijo),
                'data_fabricacao' => optional($lote->data_fabricacao)->format('d/m/Y'),
                'data_validade' => optional($lote->data_validade)->format('d/m/Y'),
                'pecas_por_caixa' => (int) ($queijo['pecas_por_caixa'] ?? 1),
                'caixas_por_palete' => (int) ($queijo['caixas_por_palete'] ?? 45),
                'caixas_total' => (int) $lote->caixas_total,
                'pecas_total' => (int) $lote->pecas_total,
                'peso_total' => (float) $lote->peso_total,
                'peso_pecas_avulsas' => (float) ($lote->peso_pecas_avulsas ?? 0),
                'status' => (string) $lote->status,
            ],
            'palete_atual' => $palete ? [
                'id' => (int) $palete->id,
                'numero' => (int) $palete->numero,
                'caixas' => (int) $palete->caixas,
                'peso_total' => (float) $palete->peso_total,
                'status' => (string) $palete->status,
            ] : null,
            'paletes' => $paletes,
            'historico' => $historico,
            'barcode' => self::BARCODE,
        ];
    }

    private function formatarDataEtiqueta(mixed $valor): string
    {
        if ($valor === null || $valor === '') {
            return '-';
        }

        $timestamp = strtotime((string) $valor);

        return $timestamp !== false ? date('d/m/Y', $timestamp) : (string) $valor;
    }

    private function buscarQueijo(string $tipo): ?array
    {
        $tipoNormalizado = $this->normalizar($tipo);
        if ($tipoNormalizado === '') {
            return null;
        }

        $query = DB::connection('raw')->table('producao_queijos')->where('ativo', 1);
        $queijos = $query->get();

        foreach ($queijos as $queijo) {
            $slug = (string) ($queijo->slug ?? '');
            $nome = (string) ($queijo->nome ?? '');
            if ($this->normalizar($slug) === $tipoNormalizado || $this->normalizar($nome) === $tipoNormalizado) {
                return $this->formatarQueijo($queijo);
            }
        }

        foreach ($queijos as $queijo) {
            $slug = $this->normalizar((string) ($queijo->slug ?? ''));
            $nome = $this->normalizar((string) ($queijo->nome ?? ''));
            if (str_contains($slug, $tipoNormalizado) || str_contains($tipoNormalizado, $slug) || str_contains($nome, $tipoNormalizado) || str_contains($tipoNormalizado, $nome)) {
                return $this->formatarQueijo($queijo);
            }
        }

        return null;
    }

    private function formatarQueijo(object $queijo): array
    {
        return [
            'id' => (int) ($queijo->id ?? 0),
            'slug' => (string) ($queijo->slug ?? ''),
            'nome' => (string) ($queijo->nome ?? ''),
            'codigo_balanca' => (string) ($queijo->codigo_balanca ?? ''),
            'embalagem_codigo' => (string) ($queijo->embalagem_codigo ?? ''),
            'caixa_codigo' => (string) ($queijo->caixa_codigo ?? ''),
            'pecas_por_caixa' => max(1, (int) ($queijo->pecas_por_caixa ?? 1)),
            'caixas_por_palete' => max(1, (int) ($queijo->caixas_por_palete ?? 45)),
        ];
    }

    private function parseBarcode(string $codigo): ?array
    {
        $digits = preg_replace('/\D+/', '', $codigo);
        if ($digits === null || strlen($digits) !== self::BARCODE['length']) {
            return null;
        }

        $productCode = substr($digits, self::BARCODE['product_start'] - 1, self::BARCODE['product_length']);
        $cheeseCode = substr($digits, self::BARCODE['cheese_code_pos'] - 1, 1);
        $weightDigits = substr($digits, self::BARCODE['weight_start'] - 1, self::BARCODE['weight_length']);
        if ($weightDigits === '' || !ctype_digit($weightDigits)) {
            return null;
        }

        $codigoQueijo = ltrim($productCode, '0');
        if ($codigoQueijo === '') {
            $codigoQueijo = ltrim($cheeseCode, '0') ?: '0';
        }

        return [
            'digits' => $digits,
            'codigo_queijo' => $codigoQueijo,
            'peso' => round(((int) $weightDigits) / self::BARCODE['weight_divisor'], 3),
        ];
    }

    private function camposComPecasAtualizadas(array $campos, string $tipoQueijo, int $totalPecas): array
    {
        $rotuloPecas = $this->rotuloPecas($tipoQueijo);
        $rotuloPecasNormalizado = $this->normalizar($rotuloPecas);

        foreach ($campos as &$campo) {
            $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));
            if ($rotulo === $rotuloPecasNormalizado) {
                $campo['valor'] = (string) $totalPecas;
                unset($campo);

                return $campos;
            }
        }
        unset($campo);

        return $this->inserirCampoPecas($campos, $rotuloPecas, $totalPecas);
    }

    private function inserirCampoPecas(array $campos, string $rotuloPecas, int $totalPecas): array
    {
        $novoCampo = ['rotulo' => $rotuloPecas, 'valor' => (string) $totalPecas];
        $indiceInsercao = null;

        foreach ($campos as $indice => $campo) {
            $rotulo = $this->normalizar((string) ($campo['rotulo'] ?? ''));
            if ($rotulo === 'lote do queijo') {
                $indiceInsercao = $indice;
                break;
            }
            if ($rotulo === 'lts produzidos total') {
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

    private function rotuloPecas(string $tipoQueijo): string
    {
        $tipo = $this->normalizar($tipoQueijo);

        return match (true) {
            str_contains($tipo, 'f1') => 'PEÇAS F1',
            str_contains($tipo, 'f6') => 'PEÇAS F6',
            str_contains($tipo, 'mussarela'), str_contains($tipo, 'f4') => 'PEÇAS F4',
            str_contains($tipo, 'colonial') => 'PEÇAS COLONIAL',
            str_contains($tipo, 'coalho') => 'PEÇAS COALHO',
            str_contains($tipo, 'provolone') => 'PEÇAS PROVOLONE',
            str_contains($tipo, 'gouda') => 'PEÇAS GOUDA',
            str_contains($tipo, 'gruyere') => 'PEÇAS GRUYERE',
            str_contains($tipo, 'prato') => 'PEÇAS PRATO',
            default => 'PEÇAS ' . strtoupper($tipoQueijo),
        };
    }

    private function baixarEstoqueEmbalagem(array $queijo, array $campos = ['embalagem_codigo', 'caixa_codigo'], int $quantidade = 1): void
    {
        $quantidade = max(1, $quantidade);

        if (! $this->tabelaExiste('estoque') || ! $this->colunasExistem('estoque', ['id', 'codigo', 'saldo_atual', 'ativo'])) {
            return;
        }

        foreach ($campos as $campo) {
            $codigo = trim((string) ($queijo[$campo] ?? ''));
            if ($codigo === '') {
                continue;
            }

            $item = DB::connection('raw')
                ->table('estoque')
                ->where('codigo', $codigo)
                ->where('ativo', 1)
                ->first();

            if ($item === null || ! property_exists($item, 'saldo_atual')) {
                continue;
            }

            DB::connection('raw')
                ->table('estoque')
                ->where('id', (int) $item->id)
                ->update(['saldo_atual' => max(0, (float) $item->saldo_atual - $quantidade)]);
        }
    }

    private function colunasExistem(string $tabela, array $colunas): bool
    {
        $existentes = DB::connection('raw')
            ->table('information_schema.COLUMNS')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $tabela)
            ->whereIn('COLUMN_NAME', $colunas)
            ->pluck('COLUMN_NAME')
            ->all();

        return count(array_unique($existentes)) === count($colunas);
    }

    private function tabelaExiste(string $tabela): bool
    {
        return DB::connection('raw')
            ->table('information_schema.TABLES')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $tabela)
            ->exists();
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
