<?php

namespace SantiLac\Admin;

final class ProxmoxClient
{
    private const ALLOWED_CONTAINERS = [100, 101, 102, 103];
    public static function allowedContainerIds(): array { return self::ALLOWED_CONTAINERS; }
    public static function isAllowedContainer(int $id): bool { return in_array($id, self::ALLOWED_CONTAINERS, true); }

    public function status(): array
    {
        $url = rtrim((string) Config::get('PROXMOX_URL', ''), '/');
        $node = rawurlencode((string) Config::get('PROXMOX_NODE', 'pve'));
        $tokenId = Config::get('PROXMOX_TOKEN_ID', '');
        $secret = Config::get('PROXMOX_TOKEN_SECRET', '');
        if ($url === '' || $tokenId === '' || $secret === '') return ['configured' => false, 'host' => null, 'containers' => []];

        return [
            'configured' => true,
            'host' => $this->get("{$url}/api2/json/nodes/{$node}/status", $tokenId, $secret),
            'containers' => array_map(fn (int $id): array => [
                'id' => $id,
                'name' => [100 => 'Frontend', 101 => 'Backend', 102 => 'Processadores', 103 => 'Banco de dados'][$id],
                'status' => $this->get("{$url}/api2/json/nodes/{$node}/lxc/{$id}/status/current", $tokenId, $secret),
            ], self::ALLOWED_CONTAINERS),
        ];
    }

    private function get(string $url, string $tokenId, string $secret): ?array
    {
        $handle = curl_init($url);
        $options=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_HTTPHEADER=>["Authorization: PVEAPIToken={$tokenId}={$secret}"],CURLOPT_SSL_VERIFYPEER=>true];
        $ca=Config::get('PROXMOX_CA_FILE',''); if($ca!=='')$options[CURLOPT_CAINFO]=$ca;
        curl_setopt_array($handle,$options);
        $body = curl_exec($handle); $code = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE); curl_close($handle);
        if (! is_string($body) || $code !== 200) return null;
        $decoded = json_decode($body, true);
        return is_array($decoded['data'] ?? null) ? $decoded['data'] : null;
    }
}
