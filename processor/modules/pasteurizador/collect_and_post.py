#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, time as datetime_time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fieldlogger_core import DEFAULT_HOST, DEFAULT_PORT, DEFAULT_UNIT_ID, download_history_file, extract_history_samples

APP_NAME = "santilac-pasteurizador"
DEFAULT_ENV_FILE = "/etc/santilac-pasteurizador/processor.env"
DEFAULT_STATE_FILE = "/var/lib/santilac-pasteurizador/state.json"
DATE_FORMAT = "%Y-%m-%d"
PERIOD_POSTED = "posted"
PERIOD_SKIPPED = "skipped"
PERIOD_PENDING = "pending"
PERIOD_FAILED = "failed"


def load_env(path):
    env = {}
    file_path = Path(path)
    if not file_path.exists():
        return env
    for line in file_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def parse_local_datetime(value):
    normalized = value.strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            pass
    raise ValueError(f"Data/hora invalida: {value!r}. Use YYYY-MM-DD HH:MM:SS.")


def day_range(target):
    return (
        datetime.combine(target, datetime_time(0, 0, 0)),
        datetime.combine(target, datetime_time(23, 59, 59)),
    )


def previous_day_range(timezone_name):
    today = datetime.now(ZoneInfo(timezone_name)).date()
    return day_range(today - timedelta(days=1))


def previous_production_day(timezone_name):
    today = datetime.now(ZoneInfo(timezone_name)).date()
    days_back = 2 if today.weekday() == 0 else 1
    return today - timedelta(days=days_back)


def previous_production_day_range(timezone_name):
    return day_range(previous_production_day(timezone_name))


def is_production_day(target):
    return target.weekday() != 6


def production_dates(start_date, end_date):
    current = start_date
    while current <= end_date:
        if is_production_day(current):
            yield current
        current += timedelta(days=1)


def is_full_day_range(period_start, period_end):
    if period_start is None or period_end is None:
        return False
    return (
        period_start.time() == datetime_time(0, 0, 0)
        and period_end.time() == datetime_time(23, 59, 59)
        and period_start.date() <= period_end.date()
    )


def read_state(path):
    state_path = Path(path)
    if not state_path.exists():
        return {}
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def parse_state_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), DATE_FORMAT).date()
    except ValueError:
        return None


def write_state(path, last_date, equipment):
    state_path = Path(path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "equipment": equipment,
        "last_successful_production_date": last_date.strftime(DATE_FORMAT),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    tmp_path = state_path.with_suffix(state_path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(state_path)


def catch_up_dates(state_path, target_date, lookback_days, start_date_override=None, authoritative_last_date=None):
    state = read_state(state_path)
    last_successful = parse_state_date(state.get("last_successful_production_date"))
    if authoritative_last_date is not None:
        start_date = authoritative_last_date + timedelta(days=1)
    elif last_successful is not None:
        start_date = last_successful + timedelta(days=1)
    elif start_date_override is not None:
        start_date = start_date_override
    else:
        start_date = target_date - timedelta(days=max(lookback_days, 1) - 1)
    return list(production_dates(start_date, target_date))


def filter_samples_by_period(samples, period_start, period_end):
    if period_start is None and period_end is None:
        return samples

    filtered = []
    for sample in samples:
        if period_start is not None and sample.timestamp < period_start:
            continue
        if period_end is not None and sample.timestamp > period_end:
            continue
        filtered.append(sample)
    return filtered


def build_payload(result, samples, channels, equipment, raw_path, period_start=None, period_end=None, status="processada", mensagem_erro=None):
    units = {channel.name: channel.unit for channel in channels}
    payload_samples = []
    for sample in samples:
        for channel in channels:
            value = sample.values.get(channel.name)
            if value is None:
                continue
            payload_samples.append(
                {
                    "channel": channel.name,
                    "unit": units.get(channel.name) or None,
                    "sample_index": sample.sample_index,
                    "raw_offset": sample.raw_offset,
                    "timestamp_record": sample.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "value": round(float(value), 6),
                    "quality": None,
                }
            )

    return {
        "source": "fieldlogger_modbus",
        "equipment": equipment,
        "remote_file": result["remote_file"],
        "raw_file_path": str(raw_path),
        "downloaded_at": result["downloaded_at"].replace("T", " "),
        "bytes_downloaded": len(result["data"]),
        "raw_sha256": hashlib.sha256(result["data"]).hexdigest(),
        "period_start": period_start.strftime("%Y-%m-%d %H:%M:%S") if period_start else None,
        "period_end": period_end.strftime("%Y-%m-%d %H:%M:%S") if period_end else None,
        "samples_count": len(samples),
        "channels": [channel.name for channel in channels],
        "status": status,
        "mensagem_erro": mensagem_erro,
        "samples": payload_samples,
    }


def post_json(url, token, payload, timeout):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
        "User-Agent": f"{APP_NAME}/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", "replace")
        return response.status, body


def get_json(url, token, timeout):
    headers = {
        "Accept": "application/json",
        "User-Agent": f"{APP_NAME}/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", "replace")
        return response.status, body


def post_json_with_retry(url, token, payload, timeout, attempts=4, base_delay=5.0):
    for attempt in range(1, max(attempts, 1) + 1):
        try:
            return post_json(url, token, payload, timeout)
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable or attempt >= attempts:
                raise

            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            try:
                delay = max(float(retry_after), 0.0) if retry_after else base_delay * attempt
            except ValueError:
                delay = base_delay * attempt
            print(
                f"[{APP_NAME}] POST recebeu HTTP {exc.code}; "
                f"nova tentativa {attempt + 1}/{attempts} em {delay:.1f}s."
            )
            time.sleep(delay)


def derive_sync_state_url(api_url):
    if not api_url:
        return ""
    suffix = "/api/pasteurizador/coletas"
    if api_url.endswith(suffix):
        return api_url[: -len(suffix)] + "/api/pasteurizador/sync-state"
    if api_url.endswith("/coletas"):
        return api_url[: -len("/coletas")] + "/sync-state"
    return ""


def fetch_remote_sync_state(api_url, token, timeout, explicit_url=""):
    url = explicit_url.strip() or derive_sync_state_url(api_url)
    if not url:
        return None
    try:
        http_status, body = get_json(url, token, timeout)
        payload = json.loads(body)
        if http_status < 200 or http_status >= 300 or not isinstance(payload, dict):
            return None
        data = payload.get("data")
        if not isinstance(data, dict):
            return None
        last_sample_date = parse_state_date(data.get("last_sample_date"))
        return {
            "url": url,
            "last_sample_date": last_sample_date,
            "payload": data,
        }
    except Exception as exc:
        print(f"[{APP_NAME}] aviso: nao foi possivel consultar sync-state remoto: {exc}", file=sys.stderr)
        return None


def write_outbox(out_dir, payload, raw_data):
    path = Path(out_dir)
    path.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = path / f"pasteurizador_payload_{stamp}.json"
    raw_path = path / f"pasteurizador_memflash_{stamp}.fl"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    raw_path.write_bytes(raw_data)
    return json_path, raw_path


def resolve_period_status(all_samples, period_start, period_end):
    if (period_start or period_end) and all_samples:
        arquivo_inicio = all_samples[0].timestamp
        arquivo_fim = all_samples[-1].timestamp
        if period_start is not None and arquivo_fim < period_start:
            return "erro", (
                "Histórico do equipamento está atrasado: "
                f"arquivo termina em {arquivo_fim:%Y-%m-%d %H:%M:%S}, "
                f"período solicitado inicia em {period_start:%Y-%m-%d %H:%M:%S}."
            )
        if period_end is not None and arquivo_inicio > period_end:
            return "erro", (
                "Histórico do equipamento não cobre o período solicitado: "
                f"arquivo inicia em {arquivo_inicio:%Y-%m-%d %H:%M:%S}, "
                f"período solicitado termina em {period_end:%Y-%m-%d %H:%M:%S}."
            )
    elif (period_start or period_end) and not all_samples:
        return "erro", "Nenhuma amostra foi decodificada do histórico baixado do equipamento."

    return "processada", None


def process_period(result, all_samples, channels, raw_path, env, period_start, period_end, timezone_name):
    equipment = env["equipment"]
    api_url = env["api_url"]
    api_token = env["api_token"]
    http_timeout = env["http_timeout"]
    post_retry_attempts = env["post_retry_attempts"]
    post_retry_base_delay = env["post_retry_base_delay"]

    samples = filter_samples_by_period(all_samples, period_start, period_end)
    status, mensagem_erro = resolve_period_status(all_samples, period_start, period_end)
    payload = build_payload(result, samples, channels, equipment, raw_path, period_start, period_end, status, mensagem_erro)
    stamp = period_start.strftime("%Y%m%d") if period_start else datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = raw_path.with_name(f"pasteurizador_payload_{stamp}.json")
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    values = [sample.values.get("Temp.Pasteuriza") for sample in samples if sample.values.get("Temp.Pasteuriza") is not None]
    print(f"[{APP_NAME}] filtro_periodo={period_start:%Y-%m-%d %H:%M:%S}..{period_end:%Y-%m-%d %H:%M:%S} timezone={timezone_name}")
    print(f"[{APP_NAME}] bytes={len(result['data'])} amostras_arquivo={len(all_samples)} amostras_filtradas={len(samples)} registros={len(payload['samples'])}")
    print(f"[{APP_NAME}] canais={', '.join(channel.name for channel in channels)}")
    if all_samples:
        print(f"[{APP_NAME}] periodo_arquivo={all_samples[0].timestamp:%Y-%m-%d %H:%M:%S}..{all_samples[-1].timestamp:%Y-%m-%d %H:%M:%S}")
    if samples:
        print(f"[{APP_NAME}] periodo={samples[0].timestamp:%Y-%m-%d %H:%M:%S}..{samples[-1].timestamp:%Y-%m-%d %H:%M:%S}")
    if mensagem_erro:
        print(f"[{APP_NAME}] status={status} mensagem={mensagem_erro}")
    if values:
        peak = max(samples, key=lambda sample: sample.values.get("Temp.Pasteuriza") or float("-inf"))
        print(f"[{APP_NAME}] Temp.Pasteuriza={min(values):.2f}..{max(values):.2f} C pico={peak.timestamp:%Y-%m-%d %H:%M:%S}")
    print(f"[{APP_NAME}] outbox json={json_path}")
    print(f"[{APP_NAME}] outbox raw={raw_path}")

    if not payload["samples"]:
        if status == "erro":
            print(f"[{APP_NAME}] período ainda não disponível no FieldLogger; estado não será avançado.")
        else:
            print(f"[{APP_NAME}] período coberto, mas sem registros decodificados; estado não será avançado.")
        return PERIOD_PENDING

    if api_url:
        try:
            http_status, body = post_json_with_retry(
                api_url,
                api_token,
                payload,
                http_timeout,
                attempts=post_retry_attempts,
                base_delay=post_retry_base_delay,
            )
            print(f"[{APP_NAME}] POST {api_url} -> HTTP {http_status}")
            if body:
                print(body[:1000])
            return PERIOD_POSTED
        except urllib.error.HTTPError as exc:
            print(f"[{APP_NAME}] erro HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:1000]}", file=sys.stderr)
            return PERIOD_FAILED
        except Exception as exc:
            print(f"[{APP_NAME}] erro ao enviar para API: {exc}", file=sys.stderr)
            return PERIOD_FAILED

    print(f"[{APP_NAME}] SANTILAC_API_URL vazio; payload ficou salvo no outbox e o estado não será avançado.")
    return PERIOD_FAILED


def main():
    parser = argparse.ArgumentParser(description="Coleta historico do FieldLogger e envia para a API SantiLac.")
    parser.add_argument("--start", help="Inicio do periodo no horario local do equipamento. Ex: 2026-06-01 00:00:00")
    parser.add_argument("--end", help="Fim do periodo no horario local do equipamento. Ex: 2026-06-01 23:59:59")
    parser.add_argument("--previous-day", action="store_true", help="Coleta somente o dia anterior no horario de Brasilia.")
    parser.add_argument("--previous-production-day", action="store_true", help="Coleta o ultimo dia de produção. Segunda-feira busca sábado.")
    parser.add_argument("--catch-up", action="store_true", help="Coleta todos os dias de produção pendentes desde o ultimo sucesso registrado.")
    parser.add_argument("--timezone", default=os.environ.get("PASTEURIZADOR_TIMEZONE", "America/Sao_Paulo"))
    args = parser.parse_args()

    env_file = os.environ.get("PASTEURIZADOR_ENV", DEFAULT_ENV_FILE)
    env = {**load_env(env_file), **os.environ}

    host = env.get("FIELDLOGGER_HOST", DEFAULT_HOST)
    port = int(env.get("FIELDLOGGER_PORT", DEFAULT_PORT))
    unit_id = int(env.get("FIELDLOGGER_UNIT_ID", DEFAULT_UNIT_ID))
    equipment = env.get("EQUIPMENT_NAME", "pasteurizador")
    max_bytes = int(env.get("FIELDLOGGER_MAX_BYTES", "8000000"))
    api_url = env.get("SANTILAC_API_URL", "").strip()
    api_token = env.get("SANTILAC_API_TOKEN", "").strip()
    sync_state_url = env.get("SANTILAC_SYNC_STATE_URL", "").strip()
    http_timeout = int(env.get("SANTILAC_HTTP_TIMEOUT", "240"))
    out_dir = env.get("OUTBOX_DIR", "/var/lib/santilac-pasteurizador/outbox")
    post_empty_periods = env.get("POST_EMPTY_PERIODS", "1").strip().lower() in {"1", "true", "yes", "sim"}
    state_file = env.get("PASTEURIZADOR_STATE_FILE", DEFAULT_STATE_FILE)
    catchup_lookback_days = int(env.get("PASTEURIZADOR_CATCHUP_LOOKBACK_DAYS", "14"))
    catchup_start_date = parse_state_date(env.get("PASTEURIZADOR_CATCHUP_START_DATE"))
    catchup_post_interval = float(env.get("PASTEURIZADOR_CATCHUP_POST_INTERVAL_SECONDS", "11"))
    post_retry_attempts = int(env.get("SANTILAC_POST_RETRY_ATTEMPTS", "4"))
    post_retry_base_delay = float(env.get("SANTILAC_POST_RETRY_BASE_DELAY_SECONDS", "5"))
    runtime_env = {
        "equipment": equipment,
        "api_url": api_url,
        "api_token": api_token,
        "http_timeout": http_timeout,
        "post_retry_attempts": post_retry_attempts,
        "post_retry_base_delay": post_retry_base_delay,
    }

    period_start = parse_local_datetime(args.start) if args.start else None
    period_end = parse_local_datetime(args.end) if args.end else None
    if args.previous_production_day:
        period_start, period_end = previous_production_day_range(args.timezone)
    elif args.previous_day:
        period_start, period_end = previous_day_range(args.timezone)
    if period_start is not None and period_end is not None and period_start > period_end:
        print(f"[{APP_NAME}] periodo invalido: inicio maior que fim", file=sys.stderr)
        return 2

    started = time.time()
    print(f"[{APP_NAME}] coletando historico {equipment} em {host}:{port} unit={unit_id} max_bytes={max_bytes}")
    result = download_history_file(host=host, port=port, unit_id=unit_id, max_bytes=max_bytes)
    all_samples, channels = extract_history_samples(result["data"])
    samples = filter_samples_by_period(all_samples, period_start, period_end)
    _, raw_path = write_outbox(out_dir, {"status": "raw_downloaded"}, result["data"])
    size_hint = result.get("directory_size_hint")
    if size_hint is not None:
        print(f"[{APP_NAME}] size_hint={size_hint} bytes_baixados={len(result['data'])}")
        if size_hint > max_bytes:
            print(f"[{APP_NAME}] download truncado no limite FIELDLOGGER_MAX_BYTES={max_bytes}.")

    if args.catch_up:
        target = previous_production_day(args.timezone)
        state = read_state(state_file)
        state_last_successful = parse_state_date(state.get("last_successful_production_date"))
        remote_sync = fetch_remote_sync_state(api_url, api_token, http_timeout, sync_state_url)
        remote_last_sample_date = remote_sync.get("last_sample_date") if remote_sync else None
        if remote_sync is not None:
            print(
                f"[{APP_NAME}] sync-state remoto={remote_sync['url']} "
                f"last_sample_date={remote_last_sample_date or 'null'}"
            )
        if remote_last_sample_date is not None and remote_last_sample_date != state_last_successful:
            write_state(state_file, remote_last_sample_date, equipment)
            state_last_successful = remote_last_sample_date
            print(
                f"[{APP_NAME}] state sincronizado com backend: "
                f"{remote_last_sample_date:%Y-%m-%d}"
            )

        pending_dates = catch_up_dates(
            state_file,
            target,
            catchup_lookback_days,
            catchup_start_date,
            authoritative_last_date=remote_last_sample_date,
        )
        if not pending_dates:
            print(f"[{APP_NAME}] catch-up sem dias pendentes ate {target:%Y-%m-%d}.")
            print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
            return 0

        print(
            f"[{APP_NAME}] catch-up dias={len(pending_dates)} "
            f"periodo={pending_dates[0]:%Y-%m-%d}..{pending_dates[-1]:%Y-%m-%d} "
            f"state={state_file}"
        )
        for index, target_date in enumerate(pending_dates):
            day_start, day_end = day_range(target_date)
            outcome = process_period(result, all_samples, channels, raw_path, runtime_env, day_start, day_end, args.timezone)
            if outcome in {PERIOD_PENDING, PERIOD_FAILED}:
                print(f"[{APP_NAME}] catch-up interrompido em {target_date:%Y-%m-%d}; estado nao avancado.", file=sys.stderr)
                return 2
            write_state(state_file, target_date, equipment)
            print(f"[{APP_NAME}] catch-up estado atualizado: {target_date:%Y-%m-%d}")
            if outcome == PERIOD_POSTED and index < len(pending_dates) - 1 and catchup_post_interval > 0:
                print(f"[{APP_NAME}] aguardando {catchup_post_interval:.1f}s para respeitar o limite da API.")
                time.sleep(catchup_post_interval)

        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return 0

    if is_full_day_range(period_start, period_end) and period_start.date() < period_end.date():
        remote_sync = fetch_remote_sync_state(api_url, api_token, http_timeout, sync_state_url)
        remote_last_sample_date = remote_sync.get("last_sample_date") if remote_sync else None
        requested_dates = list(production_dates(period_start.date(), period_end.date()))
        if remote_last_sample_date is not None:
            requested_dates = [target_date for target_date in requested_dates if target_date > remote_last_sample_date]
            print(
                f"[{APP_NAME}] intervalo diario remoto="
                f"{remote_sync['url'] if remote_sync else 'n/a'} "
                f"last_sample_date={remote_last_sample_date:%Y-%m-%d}"
            )
        if not requested_dates:
            print(f"[{APP_NAME}] intervalo sem dias faltantes para gravar.")
            print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
            return 0

        print(
            f"[{APP_NAME}] intervalo diario dias={len(requested_dates)} "
            f"periodo={requested_dates[0]:%Y-%m-%d}..{requested_dates[-1]:%Y-%m-%d}"
        )
        for index, target_date in enumerate(requested_dates):
            day_start, day_end = day_range(target_date)
            outcome = process_period(result, all_samples, channels, raw_path, runtime_env, day_start, day_end, args.timezone)
            if outcome in {PERIOD_PENDING, PERIOD_FAILED}:
                print(f"[{APP_NAME}] intervalo interrompido em {target_date:%Y-%m-%d}.", file=sys.stderr)
                return 2
            if outcome == PERIOD_POSTED and index < len(requested_dates) - 1 and catchup_post_interval > 0:
                print(f"[{APP_NAME}] aguardando {catchup_post_interval:.1f}s para respeitar o limite da API.")
                time.sleep(catchup_post_interval)

        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return 0

    if period_start is not None and period_end is not None:
        outcome = process_period(result, all_samples, channels, raw_path, runtime_env, period_start, period_end, args.timezone)
        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return 0 if outcome in {PERIOD_POSTED, PERIOD_SKIPPED} else 2

    status = "processada"
    mensagem_erro = None
    if (period_start or period_end) and all_samples:
        arquivo_inicio = all_samples[0].timestamp
        arquivo_fim = all_samples[-1].timestamp
        if period_start is not None and arquivo_fim < period_start:
            status = "erro"
            mensagem_erro = (
                "Histórico do equipamento esta atrasado: "
                f"arquivo termina em {arquivo_fim:%Y-%m-%d %H:%M:%S}, "
                f"periodo solicitado inicia em {period_start:%Y-%m-%d %H:%M:%S}."
            )
        elif period_end is not None and arquivo_inicio > period_end:
            status = "erro"
            mensagem_erro = (
                "Histórico  do equipamento nao cobre o periodo solicitado: "
                f"arquivo inicia em {arquivo_inicio:%Y-%m-%d %H:%M:%S}, "
                f"periodo solicitado termina em {period_end:%Y-%m-%d %H:%M:%S}."
            )
    elif (period_start or period_end) and not all_samples:
        status = "erro"
        mensagem_erro = "Nenhuma amostra foi decodificada do histórico baixado do equipamento."

    payload = build_payload(result, samples, channels, equipment, raw_path, period_start, period_end, status, mensagem_erro)
    json_path = raw_path.with_name(raw_path.name.replace("memflash", "payload")).with_suffix(".json")
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    values = [sample.values.get("Temp.Pasteuriza") for sample in samples if sample.values.get("Temp.Pasteuriza") is not None]
    print(f"[{APP_NAME}] bytes={len(result['data'])} amostras_arquivo={len(all_samples)} amostras_filtradas={len(samples)} registros={len(payload['samples'])}")
    print(f"[{APP_NAME}] canais={', '.join(channel.name for channel in channels)}")
    if all_samples:
        print(f"[{APP_NAME}] periodo_arquivo={all_samples[0].timestamp:%Y-%m-%d %H:%M:%S}..{all_samples[-1].timestamp:%Y-%m-%d %H:%M:%S}")
    if samples:
        print(f"[{APP_NAME}] periodo={samples[0].timestamp:%Y-%m-%d %H:%M:%S}..{samples[-1].timestamp:%Y-%m-%d %H:%M:%S}")
    if mensagem_erro:
        print(f"[{APP_NAME}] status={status} mensagem={mensagem_erro}")
    if values:
        peak = max(samples, key=lambda sample: sample.values.get("Temp.Pasteuriza") or float("-inf"))
        print(f"[{APP_NAME}] Temp.Pasteuriza={min(values):.2f}..{max(values):.2f} C pico={peak.timestamp:%Y-%m-%d %H:%M:%S}")
    print(f"[{APP_NAME}] outbox json={json_path}")
    print(f"[{APP_NAME}] outbox raw={raw_path}")

    if api_url and (payload["samples"] or post_empty_periods):
        try:
            status, body = post_json_with_retry(
                api_url,
                api_token,
                payload,
                http_timeout,
                attempts=post_retry_attempts,
                base_delay=post_retry_base_delay,
            )
            print(f"[{APP_NAME}] POST {api_url} -> HTTP {status}")
            if body:
                print(body[:1000])
        except urllib.error.HTTPError as exc:
            print(f"[{APP_NAME}] erro HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:1000]}", file=sys.stderr)
            return 2
        except Exception as exc:
            print(f"[{APP_NAME}] erro ao enviar para API: {exc}", file=sys.stderr)
            return 2
    elif api_url:
        print(f"[{APP_NAME}] nenhum registro no periodo filtrado; POST ignorado porque POST_EMPTY_PERIODS=0.")
    else:
        print(f"[{APP_NAME}] SANTILAC_API_URL vazio; payload ficou salvo no outbox.")

    print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
