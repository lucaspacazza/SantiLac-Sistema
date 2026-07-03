<?php

namespace App\Services\Expedicao;

use DomainException;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class ExpedicaoExportacaoService
{
    public function exportar(array $itens, string $formato): array
    {
        if (! in_array($formato, ['xlsx', 'pdf'], true)) {
            throw new DomainException('Formato de relatório inválido.');
        }

        $resultado = $this->viaHttp($itens, $formato);
        if ($resultado !== null) {
            return $resultado;
        }

        return $this->viaProcessoLocal($itens, $formato);
    }

    private function viaHttp(array $itens, string $formato): ?array
    {
        $url = rtrim((string) config('services.processor.url', ''), '/');
        if ($url === '') {
            return null;
        }

        $request = Http::timeout(120);
        $token = (string) config('services.processor.token', '');
        if ($token !== '') {
            $request = $request->withHeaders(['X-Processor-Token' => $token]);
        }

        $response = $request->post($url.'/expedicao/exportar/'.$formato, [
            'payload' => ['itens' => $itens],
        ]);
        $dados = $response->json();
        if (! $response->successful() || ! is_array($dados) || ! ($dados['success'] ?? false)) {
            throw new DomainException('O processor não conseguiu gerar o relatório.');
        }

        $conteudo = base64_decode((string) ($dados['file_base64'] ?? ''), true);
        if ($conteudo === false || $conteudo === '') {
            throw new DomainException('O processor retornou um arquivo inválido.');
        }

        $arquivo = 'expedicao_'.now('America/Sao_Paulo')->format('Ymd_His').'.'.$formato;
        $caminho = tempnam(sys_get_temp_dir(), 'expedicao_');
        if ($caminho === false) {
            throw new DomainException('Não foi possível preparar o relatório.');
        }
        file_put_contents($caminho, $conteudo);

        return compact('arquivo', 'caminho');
    }

    private function viaProcessoLocal(array $itens, string $formato): array
    {
        $diretorio = sys_get_temp_dir();
        $entrada = tempnam($diretorio, 'expedicao_payload_');
        $saidaTemporaria = tempnam($diretorio, 'expedicao_saida_');
        if ($entrada === false || $saidaTemporaria === false) {
            throw new DomainException('Não foi possível preparar o relatório.');
        }
        $saida = $saidaTemporaria.'.'.$formato;
        @unlink($saidaTemporaria);

        file_put_contents($entrada, json_encode(['itens' => $itens], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $processo = new Process([
            env('PYTHON_BINARY', PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3'),
            base_path('../processor/modules/expedicao/export_report.py'),
            '--input',
            $entrada,
            '--output',
            $saida,
            '--logo',
            base_path('../processor/assets/logo.png'),
        ]);
        $processo->setTimeout(120);
        $processo->run();
        @unlink($entrada);

        $retorno = json_decode(trim($processo->getOutput()), true);
        if (! $processo->isSuccessful() || ! is_array($retorno) || ! ($retorno['success'] ?? false)) {
            @unlink($saida);
            throw new DomainException('Não foi possível gerar o relatório.');
        }

        return [
            'arquivo' => 'expedicao_'.now('America/Sao_Paulo')->format('Ymd_His').'.'.$formato,
            'caminho' => $saida,
        ];
    }
}
