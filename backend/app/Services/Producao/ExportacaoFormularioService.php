<?php

namespace App\Services\Producao;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class ExportacaoFormularioService
{
    public function __construct(
        private readonly FormulacaoQueijoService $formulacaoQueijo,
        private readonly SoroRefrigeradoService $soroRefrigerado,
        private readonly FormulacaoCremeService $formulacaoCreme,
        private readonly ProducaoCremeService $producaoCreme,
    ) {
    }

    public function exportar(string $tipo, int $id, string $formato): ?array
    {
        $config = [
            'formulacao-queijo' => ['processor' => 'formulacao_queijo', 'finder' => fn (): ?array => $this->formulacaoQueijo->diaPorId($id)],
            'soro-refrigerado' => ['processor' => 'soro_refrigerado', 'finder' => fn (): ?array => $this->soroRefrigerado->buscar($id)],
            'formulacao-creme' => ['processor' => 'formulacao_creme', 'finder' => fn (): ?array => $this->formulacaoCreme->buscar($id)],
            'producao-creme' => ['processor' => 'producao_creme', 'finder' => fn (): ?array => $this->producaoCreme->buscar($id)],
        ][$tipo] ?? null;

        if ($config === null || ! in_array($formato, ['docx', 'pdf'], true)) {
            return null;
        }

        $registro = $config['finder']();
        if ($registro === null) {
            return null;
        }

        $baseDir = storage_path('app/producao-exportacoes');
        if (! is_dir($baseDir)) {
            mkdir($baseDir, 0775, true);
        }

        $httpResult = $this->processarViaHttp($config['processor'], $registro, $formato, $baseDir);
        if ($httpResult !== null) {
            return $httpResult;
        }

        $payloadPath = $baseDir.'/payload-'.$tipo.'-'.$id.'-'.uniqid().'.json';
        file_put_contents($payloadPath, json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $process = new Process([
            $this->pythonBinary(),
            $this->processorPath(),
            '--tipo',
            $config['processor'],
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

    private function processarViaHttp(string $tipo, array $payload, string $formato, string $baseDir): ?array
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
                'tipo' => $tipo,
                'formato' => $formato,
                'payload' => $payload,
            ]);
        } catch (\Throwable $exc) {
            return [
                'processor' => [
                    'success' => false,
                    'errors' => [[
                        'code' => 'PROD_EXPORT_HTTP',
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
                        'code' => 'PROD_EXPORT_HTTP',
                        'message' => 'Falha ao gerar documento no processor.',
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
                        'code' => 'PROD_EXPORT_HTTP',
                        'message' => 'Processor nao retornou arquivo valido.',
                    ]],
                ],
            ];
        }

        $processor = is_array($decoded['processor'] ?? null) ? $decoded['processor'] : ['success' => true];
        $arquivo = (string) ($processor['arquivo'] ?? ('producao_exportacao_'.uniqid().'.'.$formato));
        $caminho = rtrim($baseDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.uniqid('producao_').'-'.$arquivo;
        file_put_contents($caminho, $content);

        return [
            'processor' => $processor,
            'arquivo' => $arquivo,
            'caminho' => $caminho,
            'formato' => $formato,
        ];
    }
}

