<?php

namespace App\Services\Producao;

use App\Models\Producao\ProducaoOrdemProducao;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class OrdemProducaoExportacaoService
{
    public function __construct(
        private readonly OrdemProducaoService $ordens,
    ) {
    }

    public function exportarIndividual(int $id, string $formato): ?array
    {
        if (! $this->formatoValido($formato)) {
            return null;
        }

        $ordem = $this->ordens->buscar($id);
        if ($ordem === null) {
            return null;
        }

        return $this->processar([
            'escopo' => 'op',
            'id' => $id,
            'data' => $ordem['data'] ?? null,
            'ordens' => [$ordem],
        ], $formato);
    }

    public function exportarDia(string $data, string $formato): ?array
    {
        if ($data === '' || ! $this->formatoValido($formato)) {
            return null;
        }

        $ids = ProducaoOrdemProducao::query()
            ->where('status', '!=', 'cancelada')
            ->whereDate('data_ordem', $data)
            ->orderBy('codigo_ordem')
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        if ($ids === []) {
            return null;
        }

        $ordens = array_values(array_filter(array_map(
            fn (int $id): ?array => $this->ordens->buscar($id),
            $ids
        )));

        if ($ordens === []) {
            return null;
        }

        return $this->processar([
            'escopo' => 'dia',
            'data' => $data,
            'ordens' => $ordens,
        ], $formato);
    }

    private function processar(array $payload, string $formato): array
    {
        $baseDir = ExportacaoTempDirectory::resolve();

        $httpResult = $this->processarViaHttp($payload, $formato, $baseDir);
        if ($httpResult !== null) {
            return $httpResult;
        }

        $payloadPath = $baseDir.'/payload-op-'.uniqid().'.json';
        file_put_contents($payloadPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $process = new Process([
            $this->pythonBinary(),
            $this->processorPath(),
            '--tipo',
            'ordem_producao',
            '--payload',
            $payloadPath,
            '--out-dir',
            $baseDir,
            '--format',
            $formato,
        ]);
        $process->setTimeout(120);
        $process->run();

        @unlink($payloadPath);

        $output = trim($process->getOutput());
        $decoded = $output !== '' ? json_decode($output, true) : null;

        if (! $process->isSuccessful() || ! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => array_filter([
                        $decoded['errors'][0] ?? null,
                        trim($process->getErrorOutput()) ?: null,
                    ]),
                ],
            ];
        }

        return [
            'processor' => $decoded,
            'arquivo' => $decoded['arquivo'],
            'caminho' => $decoded['caminho'],
            'formato' => $formato,
        ];
    }

    private function formatoValido(string $formato): bool
    {
        return in_array($formato, ['xlsx', 'pdf'], true);
    }

    private function processorPath(): string
    {
        $candidates = [
            env('SANTILAC_PRODUCAO_PROCESSOR'),
            base_path('../processor/modules/producao/producao_processor.py'),
            base_path('../processor/producao/producao_processor.py'),
            base_path('../processor/producao_processor.py'),
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '' && file_exists($candidate)) {
                return $candidate;
            }
        }

        return base_path('../processor/modules/producao/producao_processor.py');
    }

    private function pythonBinary(): string
    {
        return env('PYTHON_BINARY', PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3');
    }

    private function processarViaHttp(array $payload, string $formato, string $baseDir): ?array
    {
        $processorUrl = rtrim((string) config('services.processor.url', ''), '/');
        if ($processorUrl === '') {
            return null;
        }

        try {
            $request = Http::timeout(120);
            $token = (string) config('services.processor.token', '');
            if ($token !== '') {
                $request = $request->withHeaders(['X-Processor-Token' => $token]);
            }

            $response = $request->post($processorUrl.'/producao/exportar', [
                'tipo' => 'ordem_producao',
                'formato' => $formato,
                'payload' => $payload,
            ]);
        } catch (\Throwable $exc) {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => [[
                        'code' => 'PROD_OP_EXPORT_HTTP',
                        'message' => 'Falha ao conectar ao processor.',
                        'details' => ['error' => $exc->getMessage()],
                    ]],
                ],
            ];
        }

        $decoded = $response->json();
        if (! $response->successful() || ! is_array($decoded) || ! ($decoded['success'] ?? false)) {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => [[
                        'code' => 'PROD_OP_EXPORT_HTTP',
                        'message' => 'Falha ao gerar OP no processor.',
                        'details' => [
                            'status' => $response->status(),
                            'body' => $response->body(),
                        ],
                    ]],
                ],
            ];
        }

        $content = base64_decode((string) ($decoded['file_base64'] ?? ''), true);
        if ($content === false || $content === '') {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => [[
                        'code' => 'PROD_OP_EXPORT_HTTP',
                        'message' => 'Processor nao retornou arquivo valido.',
                    ]],
                ],
            ];
        }

        $processor = is_array($decoded['processor'] ?? null) ? $decoded['processor'] : ['success' => true];
        $arquivo = (string) ($processor['arquivo'] ?? ('ordem_producao_'.uniqid().'.'.$formato));
        $caminho = rtrim($baseDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.uniqid('op_').'-'.$arquivo;
        file_put_contents($caminho, $content);

        return [
            'processor' => $processor,
            'arquivo' => $arquivo,
            'caminho' => $caminho,
            'formato' => $formato,
        ];
    }
}
