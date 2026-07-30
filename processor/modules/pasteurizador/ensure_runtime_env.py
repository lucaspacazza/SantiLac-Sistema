#!/usr/bin/env python3
"""Atualiza somente limites operacionais, preservando URLs e segredos."""

import argparse
import os
from pathlib import Path


EXACT_VALUES = {
    # A leitura integral evita repetir o congelamento causado por um prefixo.
    "FIELDLOGGER_MAX_BYTES": "0",
}

PRODUCTION_EXACT_VALUES = {
    "FIELDLOGGER_HOST": "192.168.5.101",
    "SANTILAC_API_URL": "http://192.168.5.202/api/pasteurizador/coletas",
    "SANTILAC_SYNC_STATE_URL": "http://192.168.5.202/api/pasteurizador/sync-state",
    "SANTILAC_API_TOKEN_FILE": "/etc/santilac-pasteurizador/api-token",
}

MINIMUM_VALUES = {
    "PASTEURIZADOR_CATCHUP_LOOKBACK_DAYS": 90,
    "FIELDLOGGER_REQUEST_TIMEOUT_SECONDS": 30,
    "FIELDLOGGER_READ_RETRY_ATTEMPTS": 10,
    "FIELDLOGGER_SNAPSHOT_SYNC_ATTEMPTS": 5,
    "PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS": 10800,
    "SANTILAC_HTTP_TIMEOUT": 10800,
    "SANTILAC_POST_RETRY_ATTEMPTS": 8,
    "SANTILAC_POST_RETRY_BASE_DELAY_SECONDS": 5,
    "SANTILAC_POST_RETRY_MAX_DELAY_SECONDS": 300,
    "PASTEURIZADOR_RAW_SNAPSHOT_RETENTION": 3,
    "PASTEURIZADOR_SENT_PAYLOAD_RETENTION": 30,
}

DEFAULT_VALUES = {
    "PASTEURIZADOR_STATE_FILE": "/var/lib/santilac-pasteurizador/state.json",
    "PASTEURIZADOR_HEALTH_FILE": "/var/lib/santilac-pasteurizador/health.json",
    "PASTEURIZADOR_HEALTH_MAX_AGE_SECONDS": "10800",
    "SANTILAC_SYNC_TIMEOUT_SECONDS": "45",
    "SANTILAC_SYNC_RETRY_ATTEMPTS": "3",
    "SANTILAC_SYNC_RETRY_DELAY_SECONDS": "2",
}

VALUE_REPLACEMENTS = {
    "FIELDLOGGER_HOST": {
        "192.168.0.101": "192.168.5.101",
    },
    "SANTILAC_API_URL": {
        "http://192.168.0.202/api/pasteurizador/coletas":
            "http://192.168.5.202/api/pasteurizador/coletas",
    },
    "SANTILAC_SYNC_STATE_URL": {
        "http://192.168.0.202/api/pasteurizador/sync-state":
            "http://192.168.5.202/api/pasteurizador/sync-state",
    },
}


def _effective_value(key, current):
    if key in EXACT_VALUES:
        return EXACT_VALUES[key]
    if key in MINIMUM_VALUES:
        minimum = MINIMUM_VALUES[key]
        try:
            return str(max(int(float(current)), minimum))
        except (TypeError, ValueError):
            return str(minimum)
    if key in VALUE_REPLACEMENTS:
        return VALUE_REPLACEMENTS[key].get(current, current)
    return current or DEFAULT_VALUES[key]


def _read_token_file(path):
    if not path:
        return None

    token_path = Path(path)
    raw = token_path.read_text(encoding="utf-8").strip()
    if "=" in raw:
        key, raw = raw.split("=", 1)
        if key.strip() not in {"SANTILAC_API_KEY", "SANTILAC_API_TOKEN"}:
            raise ValueError("arquivo de token nao contem uma chave reconhecida")
    token = raw.strip().strip('"').strip("'")
    if not token:
        raise ValueError("token de ingestao do pasteurizador esta vazio")
    if "\n" in token or "\r" in token:
        raise ValueError("token de ingestao do pasteurizador e invalido")
    return token


def _persist_token_file(path, token):
    token_path = Path(path)
    token_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = token_path.with_suffix(token_path.suffix + ".tmp")
    tmp_path.write_text(token + "\n", encoding="utf-8")
    os.chmod(tmp_path, 0o600)
    tmp_path.replace(token_path)
    os.chmod(token_path, 0o600)


def ensure_env(path, api_token=None, production=False):
    env_path = Path(path)
    original = (
        env_path.read_text(encoding="utf-8")
        if env_path.exists()
        else ""
    )
    lines = original.splitlines()
    managed = {
        **EXACT_VALUES,
        **MINIMUM_VALUES,
        **DEFAULT_VALUES,
        **VALUE_REPLACEMENTS,
    }
    if api_token is not None:
        managed["SANTILAC_API_TOKEN"] = api_token
    if production:
        managed.update(PRODUCTION_EXACT_VALUES)
    found = set()
    changed_keys = []
    output = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            output.append(line)
            continue
        key, raw_value = line.split("=", 1)
        normalized_key = key.strip()
        if normalized_key not in managed:
            output.append(line)
            continue

        found.add(normalized_key)
        current = raw_value.strip().strip('"').strip("'")
        desired = (
            api_token
            if normalized_key == "SANTILAC_API_TOKEN" and api_token is not None
            else PRODUCTION_EXACT_VALUES[normalized_key]
            if production and normalized_key in PRODUCTION_EXACT_VALUES
            else _effective_value(normalized_key, current)
        )
        if current != desired:
            changed_keys.append(normalized_key)
        output.append(f"{normalized_key}={desired}")

    missing = [
        key
        for key in managed
        if key not in found and key not in VALUE_REPLACEMENTS
    ]
    if missing:
        if output and output[-1] != "":
            output.append("")
        output.append("# Limites gerenciados pelo deploy do pasteurizador")
        for key in missing:
            desired = (
                api_token
                if key == "SANTILAC_API_TOKEN" and api_token is not None
                else PRODUCTION_EXACT_VALUES[key]
                if production and key in PRODUCTION_EXACT_VALUES
                else _effective_value(key, None)
            )
            output.append(f"{key}={desired}")
            changed_keys.append(key)

    rendered = "\n".join(output).rstrip() + "\n"
    if rendered == original:
        return []

    env_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = env_path.with_suffix(env_path.suffix + ".tmp")
    tmp_path.write_text(rendered, encoding="utf-8")
    if env_path.exists():
        os.chmod(tmp_path, env_path.stat().st_mode)
    else:
        os.chmod(tmp_path, 0o600)
    tmp_path.replace(env_path)
    return changed_keys


def main():
    parser = argparse.ArgumentParser(
        description="Garante limites resilientes sem exibir ou alterar segredos."
    )
    parser.add_argument(
        "--path",
        default="/etc/santilac-pasteurizador/processor.env",
    )
    parser.add_argument(
        "--token-file",
        help=(
            "Arquivo temporario contendo SANTILAC_API_KEY ou "
            "SANTILAC_API_TOKEN. O valor nunca e exibido."
        ),
    )
    parser.add_argument(
        "--production",
        action="store_true",
        help="Fixa FieldLogger e API nos endpoints de producao.",
    )
    parser.add_argument(
        "--persist-token-file",
        help="Copia protegida da credencial para recuperacao automatica.",
    )
    args = parser.parse_args()

    api_token = _read_token_file(args.token_file)
    if args.persist_token_file:
        if api_token is None:
            parser.error("--persist-token-file exige --token-file")
        _persist_token_file(args.persist_token_file, api_token)
    changed = ensure_env(
        args.path,
        api_token=api_token,
        production=args.production,
    )
    if changed:
        print("processor.env atualizado: " + ", ".join(sorted(changed)))
    else:
        print("processor.env já está atualizado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
