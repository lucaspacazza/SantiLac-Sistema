<?php

namespace App\Services\Producao;

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
}
