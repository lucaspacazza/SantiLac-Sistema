<?php

namespace App\Services\Coletas;

use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Symfony\Component\Process\Process;

class ColetasImportacaoService
{
    private const IMPORTS_TABLE = 'coletas_importacoes';

    private const IMPORT_LOCK_NAME = 'santilac_coletas_importacao';

    private const INSERT_CHUNK_SIZE = 500;

    public function importar(UploadedFile $arquivo): array
    {
        $nomeOriginal = $arquivo->getClientOriginalName();
        $extensao = strtolower((string) $arquivo->getClientOriginalExtension());
        $maxBytes = max(1, (int) config('services.coletas_importacao.max_bytes', 100 * 1024 * 1024));

        if ($extensao !== 'pdf') {
            return $this->falha('MILK_IMPORT_411', 'Envie o relatorio em formato PDF.', $nomeOriginal);
        }
        if (($arquivo->getSize() ?: 0) > $maxBytes) {
            return $this->falha('MILK_IMPORT_413', 'O PDF excede o tamanho maximo permitido.', $nomeOriginal);
        }

        $nomeStorage = now()->format('Ymd_His').'_'.bin2hex(random_bytes(4)).'_'.Str::slug(pathinfo($nomeOriginal, PATHINFO_FILENAME)).'.pdf';
        $caminhoRelativo = $arquivo->storeAs('importacoes/coletas', $nomeStorage, 'local');
        if (! is_string($caminhoRelativo) || $caminhoRelativo === '') {
            return $this->falha('MILK_IMPORT_414', 'Nao foi possivel armazenar o PDF para processamento.', $nomeOriginal);
        }
        $caminhoCompleto = Storage::disk('local')->path($caminhoRelativo);
        $assinatura = file_get_contents($caminhoCompleto, false, null, 0, 5);
        if ($assinatura !== '%PDF-') {
            Storage::disk('local')->delete($caminhoRelativo);

            return $this->falha('MILK_IMPORT_411', 'O arquivo enviado nao e um PDF valido.', $nomeOriginal);
        }
        $hash = (string) hash_file('sha256', $caminhoCompleto);

        $jaImportado = $this->importacaoJaRegistrada($hash);

        $processor = $this->executarProcessor($caminhoCompleto, $nomeOriginal, $hash);
        if (! ($processor['success'] ?? false)) {
            Storage::disk('local')->delete($caminhoRelativo);

            return [
                'success' => false,
                'summary' => $this->resumoVazio($nomeOriginal, $hash),
                'warnings' => array_values($processor['warnings'] ?? []),
                'errors' => array_values($processor['errors'] ?? []),
            ];
        }

        try {
            $registros = array_map(
                fn (array $record): array => self::normalizarRegistro($record),
                array_values($processor['records'] ?? [])
            );
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($caminhoRelativo);

            return $this->falha('MILK_IMPORT_424', $exception->getMessage(), $nomeOriginal, $hash);
        }

        if ($registros === []) {
            Storage::disk('local')->delete($caminhoRelativo);

            return $this->falha('MILK_IMPORT_412', 'Nenhuma coleta valida foi encontrada no PDF.', $nomeOriginal, $hash);
        }

        $chavesDoArquivo = [];
        foreach ($registros as $registro) {
            $chave = $this->chaveRegistro($registro);
            if (isset($chavesDoArquivo[$chave])) {
                Storage::disk('local')->delete($caminhoRelativo);

                return $this->falha(
                    'MILK_IMPORT_423',
                    'O PDF possui mais de uma coleta para o mesmo produtor e dia.',
                    $nomeOriginal,
                    $hash
                );
            }
            $chavesDoArquivo[$chave] = true;
        }

        try {
            $resultado = $this->comTravaDeImportacao(fn (): array => DB::connection('raw')->transaction(function () use (
                $registros,
                $processor,
                $nomeOriginal,
                $caminhoRelativo,
                $hash,
                $jaImportado
            ): array {
                $produtoresCriados = $this->criarProdutoresAusentes($registros);
                $chavesExistentes = $this->chavesColetasExistentes($registros);
                $novos = array_values(array_filter($registros, function (array $registro) use ($chavesExistentes): bool {
                    return ! isset($chavesExistentes[$this->chaveRegistro($registro)]);
                }));

                $this->inserirColetas($novos, $hash);

                $litrosLidos = array_sum(array_column($registros, 'litros'));
                $litrosImportados = array_sum(array_column($novos, 'litros'));
                $summary = [
                    'arquivo' => $nomeOriginal,
                    'arquivo_hash' => $hash,
                    'ja_importado' => $jaImportado,
                    'paginas' => (int) data_get($processor, 'summary.pages', 0),
                    'registros_lidos' => count($registros),
                    'registros_criados' => count($novos),
                    'registros_ignorados' => count($registros) - count($novos),
                    'produtores_criados' => $produtoresCriados,
                    'litros_lidos' => round($litrosLidos, 3),
                    'litros_importados' => round($litrosImportados, 3),
                    'data_inicio' => (string) data_get($processor, 'summary.date_start', ''),
                    'data_fim' => (string) data_get($processor, 'summary.date_end', ''),
                ];

                $this->registrarImportacao($nomeOriginal, $caminhoRelativo, $hash, $summary);

                return $summary;
            }));
        } catch (\DomainException $exception) {
            Storage::disk('local')->delete($caminhoRelativo);

            return $this->falha('MILK_IMPORT_429', $exception->getMessage(), $nomeOriginal, $hash);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($caminhoRelativo);
            throw $exception;
        }

        return [
            'success' => true,
            'summary' => $resultado,
            'warnings' => array_values($processor['warnings'] ?? []),
            'errors' => [],
        ];
    }

    public static function normalizarRegistro(array $record): array
    {
        $codigo = trim((string) data_get($record, 'data.produtor_codigo', ''));
        $nome = trim((string) data_get($record, 'data.produtor_nome', ''));
        $data = trim((string) data_get($record, 'data.data', ''));
        $litros = data_get($record, 'data.litros');
        $pagina = (int) data_get($record, 'source.page', 0);

        $dataValida = CarbonImmutable::createFromFormat('!Y-m-d', $data);
        $errosData = CarbonImmutable::getLastErrors();
        if (
            $codigo === ''
            || $nome === ''
            || ! is_numeric($litros)
            || (float) $litros <= 0
            || $dataValida === false
            || (is_array($errosData) && ($errosData['warning_count'] > 0 || $errosData['error_count'] > 0))
        ) {
            throw new InvalidArgumentException('O processor retornou uma coleta invalida.');
        }

        return [
            'produtor_codigo' => $codigo,
            'produtor_nome' => $nome,
            'data' => $dataValida->toDateString(),
            'litros' => (float) $litros,
            'pagina' => $pagina,
        ];
    }

    private function executarProcessor(string $caminhoCompleto, string $nomeOriginal, string $hash): array
    {
        $processorUrl = rtrim((string) config('services.processor.url', ''), '/');
        if ($processorUrl !== '') {
            return $this->executarProcessorHttp($processorUrl, $caminhoCompleto, $nomeOriginal, $hash);
        }

        $script = (string) config('services.coletas_importacao.processor_script', '');
        if ($script === '') {
            $script = base_path('../processor/modules/coletas/import_tickets_pdf.py');
        }
        $python = preg_split('/\s+/', trim((string) config('services.coletas_importacao.python', 'python'))) ?: ['python'];
        $process = new Process([
            ...$python,
            $script,
            '--input',
            $caminhoCompleto,
            '--filename',
            $nomeOriginal,
            '--hash',
            $hash,
        ]);
        $process->setTimeout($this->processorTimeout());
        $process->run();

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded)) {
            return $this->processorError('PROCESSOR_711', 'Retorno do processor invalido.', [
                'stderr' => $process->getErrorOutput(),
                'exit_code' => $process->getExitCode(),
            ]);
        }

        return $decoded;
    }

    private function executarProcessorHttp(string $url, string $caminho, string $nome, string $hash): array
    {
        try {
            $request = Http::timeout($this->processorTimeout());
            $token = (string) config('services.processor.token', '');
            if ($token !== '') {
                $request = $request->withHeaders(['X-Processor-Token' => $token]);
            }
            $response = $request->post($url.'/coletas/importar-tickets', [
                'filename' => $nome,
                'hash' => $hash,
                'content_base64' => base64_encode((string) file_get_contents($caminho)),
            ]);
        } catch (\Throwable $exception) {
            return $this->processorError('PROCESSOR_712', 'Falha ao conectar ao processor.', ['error' => $exception->getMessage()]);
        }

        $decoded = $response->json();
        if (is_array($decoded) && ($decoded['success'] ?? null) === false) {
            return $this->normalizarFalhaProcessor($decoded, $response->status());
        }
        if (! $response->successful() || ! is_array($decoded)) {
            return $this->processorError('PROCESSOR_711', 'Retorno do processor invalido.', [
                'status' => $response->status(),
            ]);
        }

        return $decoded;
    }

    private function normalizarFalhaProcessor(array $payload, int $status): array
    {
        $errors = array_values(array_filter(
            is_array($payload['errors'] ?? null) ? $payload['errors'] : [],
            fn ($error): bool => is_array($error) && is_string($error['message'] ?? null)
        ));

        if ($errors === []) {
            $error = $payload['error'] ?? null;
            if (is_array($error) && is_string($error['message'] ?? null)) {
                $errors[] = [
                    'code' => (string) ($error['code'] ?? 'PROCESSOR_711'),
                    'message' => $error['message'],
                    'details' => is_array($error['details'] ?? null) ? $error['details'] : [],
                ];
            } elseif (is_string($payload['message'] ?? null)) {
                $errors[] = [
                    'code' => 'PROCESSOR_711',
                    'message' => $payload['message'],
                    'details' => ['status' => $status],
                ];
            }
        }

        if ($errors === []) {
            $errors[] = [
                'code' => 'PROCESSOR_711',
                'message' => 'O processor nao informou a causa da falha.',
                'details' => ['status' => $status],
            ];
        }

        return [
            ...$payload,
            'success' => false,
            'records' => [],
            'warnings' => array_values(is_array($payload['warnings'] ?? null) ? $payload['warnings'] : []),
            'errors' => $errors,
        ];
    }

    private function criarProdutoresAusentes(array $registros): int
    {
        if (! Schema::connection('raw')->hasTable('produtores')) {
            return 0;
        }

        $porCodigo = collect($registros)->unique('produtor_codigo')->keyBy('produtor_codigo');
        $existentes = DB::connection('raw')->table('produtores')
            ->whereIn('codigo', $porCodigo->keys()->all())
            ->pluck('codigo')
            ->map(fn ($codigo): string => (string) $codigo)
            ->flip();
        $colunas = array_flip(Schema::connection('raw')->getColumnListing('produtores'));
        $linhas = [];

        foreach ($porCodigo as $codigo => $registro) {
            if ($existentes->has((string) $codigo)) {
                continue;
            }
            $candidato = [
                'codigo' => (string) $codigo,
                'nome' => $registro['produtor_nome'],
                'cidade' => 'NAO INFORMADA',
                'rota' => '',
                'diario' => 0,
                'ativo' => 1,
                'novo' => 1,
                'projeto' => 0,
            ];
            $linhas[] = array_intersect_key($candidato, $colunas);
        }

        foreach (array_chunk($linhas, self::INSERT_CHUNK_SIZE) as $chunk) {
            DB::connection('raw')->table('produtores')->insert($chunk);
        }

        return count($linhas);
    }

    private function chavesColetasExistentes(array $registros): array
    {
        $datas = array_column($registros, 'data');
        $codigos = array_values(array_unique(array_column($registros, 'produtor_codigo')));
        $inicio = min($datas).' 00:00:00';
        $fim = CarbonImmutable::parse(max($datas), config('app.timezone'))->addDay()->format('Y-m-d 00:00:00');

        return DB::connection('raw')->table('coletas')
            ->whereIn('produtor_codigo', $codigos)
            ->where('datahora', '>=', $inicio)
            ->where('datahora', '<', $fim)
            ->get(['produtor_codigo', 'datahora'])
            ->mapWithKeys(fn ($row): array => [
                trim((string) $row->produtor_codigo).'|'.substr((string) $row->datahora, 0, 10) => true,
            ])
            ->all();
    }

    private function inserirColetas(array $registros, string $hash): void
    {
        $colunas = array_flip(Schema::connection('raw')->getColumnListing('coletas'));
        $agora = now()->format('Y-m-d H:i:s');
        $linhas = array_map(function (array $registro) use ($colunas, $hash, $agora): array {
            $candidato = [
                'produtor_codigo' => $registro['produtor_codigo'],
                'produtor_nome' => $registro['produtor_nome'],
                'litros' => $registro['litros'],
                'temperatura' => null,
                'usuario' => 'importacao_pdf',
                'device_id' => 'pdf-'.substr($hash, 0, 16),
                'datahora' => $registro['data'].' 06:00:00',
                'created_at' => $agora,
            ];

            return array_intersect_key($candidato, $colunas);
        }, $registros);

        foreach (array_chunk($linhas, self::INSERT_CHUNK_SIZE) as $chunk) {
            DB::connection('raw')->table('coletas')->insert($chunk);
        }
    }

    private function chaveRegistro(array $registro): string
    {
        return $registro['produtor_codigo'].'|'.$registro['data'];
    }

    private function comTravaDeImportacao(callable $callback): array
    {
        $connection = DB::connection('raw');
        $driver = $connection->getDriverName();
        $acquired = true;

        if ($driver === 'mysql') {
            $row = $connection->selectOne('SELECT GET_LOCK(?, 30) AS acquired', [self::IMPORT_LOCK_NAME]);
            $acquired = (int) ($row->acquired ?? 0) === 1;
        } elseif ($driver === 'pgsql') {
            $row = $connection->selectOne('SELECT pg_try_advisory_lock(hashtext(?)) AS acquired', [self::IMPORT_LOCK_NAME]);
            $value = $row->acquired ?? false;
            $acquired = $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
        }

        if (! $acquired) {
            throw new \DomainException('Outra importacao de coletas esta sendo gravada. Tente novamente em instantes.');
        }

        try {
            return $callback();
        } finally {
            if ($driver === 'mysql') {
                $connection->selectOne('SELECT RELEASE_LOCK(?) AS released', [self::IMPORT_LOCK_NAME]);
            } elseif ($driver === 'pgsql') {
                $connection->selectOne('SELECT pg_advisory_unlock(hashtext(?)) AS released', [self::IMPORT_LOCK_NAME]);
            }
        }
    }

    private function processorTimeout(): int
    {
        return max(60, (int) config('services.coletas_importacao.processor_timeout_seconds', 600));
    }

    private function importacaoJaRegistrada(string $hash): bool
    {
        if (! Schema::connection('raw')->hasTable(self::IMPORTS_TABLE)) {
            return false;
        }

        return DB::connection('raw')->table(self::IMPORTS_TABLE)->where('arquivo_hash', $hash)->exists();
    }

    private function registrarImportacao(string $nome, string $caminho, string $hash, array $summary): void
    {
        if (! Schema::connection('raw')->hasTable(self::IMPORTS_TABLE)) {
            return;
        }
        $colunas = array_flip(Schema::connection('raw')->getColumnListing(self::IMPORTS_TABLE));
        $dados = [
            'arquivo_nome' => $nome,
            'arquivo_caminho' => $caminho,
            'arquivo_hash' => $hash,
            'registros_lidos' => $summary['registros_lidos'],
            'registros_criados' => $summary['registros_criados'],
            'registros_ignorados' => $summary['registros_ignorados'],
            'litros_lidos' => $summary['litros_lidos'],
            'resumo' => json_encode($summary, JSON_UNESCAPED_UNICODE),
            'created_at' => now()->format('Y-m-d H:i:s'),
        ];
        $dados = array_intersect_key($dados, $colunas);
        DB::connection('raw')->table(self::IMPORTS_TABLE)->updateOrInsert(
            ['arquivo_hash' => $hash],
            array_diff_key($dados, ['arquivo_hash' => true])
        );
    }

    private function falha(string $code, string $message, string $arquivo, ?string $hash = null): array
    {
        return [
            'success' => false,
            'summary' => $this->resumoVazio($arquivo, $hash),
            'warnings' => [],
            'errors' => [['code' => $code, 'message' => $message, 'details' => []]],
        ];
    }

    private function resumoVazio(string $arquivo, ?string $hash): array
    {
        return [
            'arquivo' => $arquivo,
            'arquivo_hash' => $hash,
            'ja_importado' => false,
            'paginas' => 0,
            'registros_lidos' => 0,
            'registros_criados' => 0,
            'registros_ignorados' => 0,
            'produtores_criados' => 0,
            'litros_lidos' => 0.0,
            'litros_importados' => 0.0,
            'data_inicio' => '',
            'data_fim' => '',
        ];
    }

    private function processorError(string $code, string $message, array $details): array
    {
        return ['success' => false, 'records' => [], 'warnings' => [], 'errors' => [[
            'code' => $code,
            'message' => $message,
            'details' => $details,
        ]]];
    }
}
