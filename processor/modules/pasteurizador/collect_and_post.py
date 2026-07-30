#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, time as datetime_time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fieldlogger_core import (
    DEFAULT_HOST,
    DEFAULT_MAX_BYTES,
    DEFAULT_PORT,
    DEFAULT_READ_RETRY_ATTEMPTS,
    DEFAULT_READ_RETRY_DELAY_SECONDS,
    DEFAULT_REQUEST_TIMEOUT_SECONDS,
    DEFAULT_SNAPSHOT_SYNC_ATTEMPTS,
    DEFAULT_UNIT_ID,
    download_history_file,
    extract_history_samples,
)

APP_NAME = "santilac-pasteurizador"
DEFAULT_ENV_FILE = "/etc/santilac-pasteurizador/processor.env"
DEFAULT_STATE_FILE = "/var/lib/santilac-pasteurizador/state.json"
DATE_FORMAT = "%Y-%m-%d"
PERIOD_POSTED = "posted"
PERIOD_SKIPPED = "skipped"
PERIOD_PENDING = "pending"
PERIOD_FAILED = "failed"
DEFAULT_SENT_PAYLOAD_RETENTION = 30
DEFAULT_RAW_SNAPSHOT_RETENTION = 3
DEFAULT_HEALTH_FILE = "/var/lib/santilac-pasteurizador/health.json"
DEFAULT_PERIOD_COVERAGE_TOLERANCE_SECONDS = 10 * 60
RUNTIME_DETAILS = {}


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


def resolve_api_token(env):
    token = str(env.get("SANTILAC_API_TOKEN", "")).strip()
    if token:
        return token

    token_file = str(env.get("SANTILAC_API_TOKEN_FILE", "")).strip()
    if not token_file:
        return ""
    try:
        return Path(token_file).read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def write_health_status(exit_code, error=None):
    env_file = os.environ.get("PASTEURIZADOR_ENV", DEFAULT_ENV_FILE)
    env = {**load_env(env_file), **os.environ}
    path = Path(env.get("PASTEURIZADOR_HEALTH_FILE", DEFAULT_HEALTH_FILE))
    previous = read_state(path)
    out_dir = Path(
        env.get("OUTBOX_DIR", "/var/lib/santilac-pasteurizador/outbox")
    )
    rejected_payloads = sorted(
        (out_dir / "rejected").glob("*.rejected.json"),
        key=lambda item: item.stat().st_mtime,
    )
    reason_files = sorted(
        (out_dir / "rejected").glob("*.reason.json"),
        key=lambda item: item.stat().st_mtime,
    )
    last_rejected_reason = None
    if reason_files:
        try:
            reason_payload = json.loads(
                reason_files[-1].read_text(encoding="utf-8")
            )
            last_rejected_reason = reason_payload.get("reason")
        except Exception:
            last_rejected_reason = "motivo de rejeição ilegível"
    reported_error = error
    if reported_error is None and int(exit_code) != 0:
        reported_error = RUNTIME_DETAILS.get("failure_reason")
    payload = {
        **previous,
        **RUNTIME_DETAILS,
        "ok": exit_code == 0 and error is None,
        "exit_code": int(exit_code),
        "last_run_at": datetime.now().isoformat(timespec="seconds"),
        "last_error": str(reported_error) if reported_error is not None else None,
        "pending_payloads": len(list((out_dir / "pending").glob("*.pending.json"))),
        "rejected_payloads": len(rejected_payloads),
        "last_rejected_reason": last_rejected_reason,
    }
    _atomic_write_text(
        path,
        json.dumps(payload, ensure_ascii=False, indent=2),
    )


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


def is_open_period(period_end, timezone_name, now=None):
    if period_end is None:
        return False

    zone = ZoneInfo(timezone_name)
    current = now
    if current is None:
        current = datetime.now(zone)
    elif current.tzinfo is None:
        current = current.replace(tzinfo=zone)
    else:
        current = current.astimezone(zone)

    return period_end.date() >= current.date()


def daily_period_bounds(period_start, period_end, target_date):
    day_start, day_end = day_range(target_date)
    if target_date == period_start.date():
        day_start = period_start
    if target_date == period_end.date():
        day_end = period_end
    return day_start, day_end


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


def _dates_from_state(state, key):
    values = state.get(key)
    if not isinstance(values, list):
        return set()
    return {
        parsed
        for parsed in (parse_state_date(value) for value in values)
        if parsed is not None
    }


def write_state(
    path,
    last_date,
    equipment,
    completed_dates=None,
    failed_dates=None,
    last_error=None,
):
    state_path = Path(path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    current = read_state(path)
    completed = (
        set(completed_dates)
        if completed_dates is not None
        else _dates_from_state(current, "completed_dates")
    )
    failed = (
        set(failed_dates)
        if failed_dates is not None
        else _dates_from_state(current, "failed_dates")
    )
    completed -= failed

    # Completed dates are only a local recovery ledger. Keep a bounded history;
    # failures are never pruned until the backend confirms them.
    completed_sorted = sorted(completed)[-370:]
    payload = {
        "equipment": equipment,
        "last_successful_production_date": (
            last_date.strftime(DATE_FORMAT)
            if last_date is not None
            else current.get("last_successful_production_date")
        ),
        "completed_dates": [value.strftime(DATE_FORMAT) for value in completed_sorted],
        "failed_dates": [value.strftime(DATE_FORMAT) for value in sorted(failed)],
        "last_error": last_error,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    tmp_path = state_path.with_suffix(state_path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(state_path)


def record_period_outcome(state_path, target_date, equipment, outcome, error=None):
    state = read_state(state_path)
    completed = _dates_from_state(state, "completed_dates")
    failed = _dates_from_state(state, "failed_dates")
    last_successful = parse_state_date(state.get("last_successful_production_date"))

    if outcome in {PERIOD_POSTED, PERIOD_SKIPPED}:
        completed.add(target_date)
        failed.discard(target_date)
        if last_successful is None or target_date > last_successful:
            last_successful = target_date
    else:
        completed.discard(target_date)
        failed.add(target_date)

    write_state(
        state_path,
        last_successful,
        equipment,
        completed_dates=completed,
        failed_dates=failed,
        last_error=error,
    )


def catch_up_dates(
    state_path,
    target_date,
    lookback_days,
    start_date_override=None,
    authoritative_last_date=None,
    authoritative_covered_dates=None,
    authoritative_series_start_date=None,
):
    state = read_state(state_path)
    last_successful = parse_state_date(state.get("last_successful_production_date"))
    completed = _dates_from_state(state, "completed_dates")
    failed = _dates_from_state(state, "failed_dates")
    covered = (
        set(authoritative_covered_dates)
        if authoritative_covered_dates is not None
        else None
    )

    if start_date_override is not None:
        start_date = start_date_override
    elif covered is not None:
        lookback_start = target_date - timedelta(days=max(lookback_days, 1) - 1)
        if covered:
            series_start = authoritative_series_start_date or min(covered)
            start_date = max(lookback_start, series_start)
        elif authoritative_last_date is not None:
            # Compatibilidade com backend legado: covered_dates=[] não significa
            # que toda a janela histórica está ausente. Revalide o último dia
            # conhecido e avance dali, sem inventar meses de lacunas.
            start_date = authoritative_last_date
        elif authoritative_series_start_date is not None:
            start_date = max(lookback_start, authoritative_series_start_date)
        else:
            start_date = lookback_start
    elif authoritative_last_date is not None:
        start_date = authoritative_last_date + timedelta(days=1)
    elif last_successful is not None:
        start_date = last_successful + timedelta(days=1)
    elif authoritative_series_start_date is not None:
        lookback_start = target_date - timedelta(days=max(lookback_days, 1) - 1)
        start_date = max(lookback_start, authoritative_series_start_date)
    else:
        start_date = target_date - timedelta(days=max(lookback_days, 1) - 1)

    candidates = set(production_dates(start_date, target_date))
    candidates.update(value for value in failed if value <= target_date)
    if covered is not None:
        candidates -= covered
    else:
        candidates -= completed
    return sorted(candidates)


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

    raw_sha256 = result.get("raw_sha256")
    if not raw_sha256:
        raw_sha256 = hashlib.sha256(result["data"]).hexdigest()
    period_identity = "|".join([
        "fieldlogger_modbus",
        equipment,
        period_start.strftime("%Y-%m-%d %H:%M:%S") if period_start else "",
        period_end.strftime("%Y-%m-%d %H:%M:%S") if period_end else "",
        "" if period_start or period_end else raw_sha256,
    ])

    return {
        "ingestion_key": hashlib.sha256(period_identity.encode("utf-8")).hexdigest(),
        "source": "fieldlogger_modbus",
        "equipment": equipment,
        "remote_file": result["remote_file"],
        "raw_file_path": str(raw_path),
        "downloaded_at": result["downloaded_at"].replace("T", " "),
        "bytes_downloaded": len(result["data"]),
        "raw_sha256": raw_sha256,
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


def _retry_delay(attempt, base_delay, retry_after=None, max_delay=300.0):
    if retry_after:
        try:
            return min(max(float(retry_after), 0.0), max_delay)
        except (TypeError, ValueError):
            pass
    exponential = max(float(base_delay), 0.0) * (2 ** max(attempt - 1, 0))
    jitter = random.uniform(0.0, max(float(base_delay), 0.0))
    return min(exponential + jitter, max_delay)


def post_json_with_retry(
    url,
    token,
    payload,
    timeout,
    attempts=4,
    base_delay=5.0,
    max_delay=300.0,
):
    attempts = max(int(attempts), 1)
    for attempt in range(1, attempts + 1):
        try:
            return post_json(url, token, payload, timeout)
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable or attempt >= attempts:
                raise

            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            delay = _retry_delay(attempt, base_delay, retry_after, max_delay)
            print(
                f"[{APP_NAME}] POST recebeu HTTP {exc.code}; "
                f"nova tentativa {attempt + 1}/{attempts} em {delay:.1f}s."
            )
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            if attempt >= attempts:
                raise
            delay = _retry_delay(attempt, base_delay, max_delay=max_delay)
            print(
                f"[{APP_NAME}] falha transitória no POST ({exc}); "
                f"nova tentativa {attempt + 1}/{attempts} em {delay:.1f}s.",
                file=sys.stderr,
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


def fetch_remote_sync_state(
    api_url,
    token,
    timeout,
    explicit_url="",
    attempts=3,
    retry_delay_seconds=2.0,
):
    url = explicit_url.strip() or derive_sync_state_url(api_url)
    if not url:
        return None
    attempts = max(int(attempts), 1)
    for attempt in range(1, attempts + 1):
        try:
            http_status, body = get_json(url, token, timeout)
            payload = json.loads(body)
            if http_status < 200 or http_status >= 300 or not isinstance(payload, dict):
                return None
            data = payload.get("data")
            if not isinstance(data, dict):
                return None
            last_sample_date = parse_state_date(data.get("last_sample_date"))
            series_start_date = parse_state_date(data.get("series_start_date"))
            covered_dates = {
                parsed
                for parsed in (
                    parse_state_date(value)
                    for value in (data.get("covered_dates") or [])
                )
                if parsed is not None
            }
            return {
                "url": url,
                "last_sample_date": last_sample_date,
                "series_start_date": series_start_date,
                "covered_dates": covered_dates if "covered_dates" in data else None,
                "payload": data,
            }
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable:
                print(
                    f"[{APP_NAME}] aviso: sync-state retornou HTTP {exc.code}; "
                    "o catch-up continuará usando o ledger local.",
                    file=sys.stderr,
                )
                return None
            error = exc
        except (
            urllib.error.URLError,
            TimeoutError,
            ConnectionError,
            OSError,
            json.JSONDecodeError,
        ) as exc:
            error = exc
        except Exception as exc:
            print(
                f"[{APP_NAME}] aviso: resposta inválida do sync-state remoto: {exc}",
                file=sys.stderr,
            )
            return None

        if attempt >= attempts:
            print(
                f"[{APP_NAME}] aviso: sync-state indisponível após "
                f"{attempts} tentativas curtas: {error}",
                file=sys.stderr,
            )
            return None
        delay = min(
            max(float(retry_delay_seconds), 0.0) * (2 ** (attempt - 1)),
            10.0,
        )
        print(
            f"[{APP_NAME}] sync-state falhou ({error}); tentativa "
            f"{attempt + 1}/{attempts} em {delay:.1f}s.",
            file=sys.stderr,
        )
        time.sleep(delay)

    return None


def _atomic_write_text(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(value, encoding="utf-8")
    tmp_path.replace(path)


def _atomic_write_bytes(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_bytes(value)
    tmp_path.replace(path)


def write_outbox(out_dir, payload, raw_data):
    root = Path(out_dir)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    json_path = root / "diagnostics" / f"pasteurizador_download_{stamp}.json"
    raw_path = root / "raw" / f"pasteurizador_memflash_{stamp}.fl"
    _atomic_write_bytes(raw_path, raw_data)
    _atomic_write_text(
        json_path,
        json.dumps(payload, ensure_ascii=False, indent=2),
    )
    return json_path, raw_path


def _payload_sample_map(payload):
    sample_map = {}
    for sample in payload.get("samples") or []:
        if not isinstance(sample, dict):
            continue
        timestamp = str(sample.get("timestamp_record") or "").strip()
        channel = str(sample.get("channel") or "").strip()
        if not timestamp or not channel:
            continue
        sample_map[(timestamp, channel)] = sample
    return sample_map


def _payload_raw_paths(payload):
    paths = []
    for value in payload.get("raw_file_paths") or []:
        if value and str(value) not in paths:
            paths.append(str(value))
    value = payload.get("raw_file_path")
    if value and str(value) not in paths:
        paths.append(str(value))
    return paths


def merge_progressive_payload(existing, incoming):
    for field in (
        "ingestion_key",
        "source",
        "equipment",
        "period_start",
        "period_end",
    ):
        existing_value = existing.get(field)
        incoming_value = incoming.get(field)
        if (
            existing_value is not None
            and incoming_value is not None
            and existing_value != incoming_value
        ):
            raise ValueError(
                f"colisão de ingestion_key com {field} divergente: "
                f"{existing_value!r} != {incoming_value!r}"
            )

    existing_samples = _payload_sample_map(existing)
    incoming_samples = _payload_sample_map(incoming)
    existing_keys = set(existing_samples)
    incoming_keys = set(incoming_samples)

    if existing_keys and incoming_keys:
        if existing_keys < incoming_keys:
            merged = dict(incoming)
            contributing_payloads = [incoming]
        elif incoming_keys < existing_keys:
            merged = dict(existing)
            contributing_payloads = [existing]
        elif existing_keys == incoming_keys:
            # Mesma cobertura: prefira a leitura mais recente, que pode conter
            # correções de valor/qualidade sem reduzir a série.
            merged = dict(incoming)
            contributing_payloads = [incoming]
        else:
            combined = {**existing_samples, **incoming_samples}
            merged = dict(incoming)
            merged["samples"] = [
                combined[key]
                for key in sorted(combined)
            ]
            merged["samples_count"] = len(
                {timestamp for timestamp, _channel in combined}
            )
            merged["channels"] = list(dict.fromkeys([
                *(existing.get("channels") or []),
                *(incoming.get("channels") or []),
                *(channel for _timestamp, channel in combined),
            ]))
            merged["bytes_downloaded"] = max(
                int(existing.get("bytes_downloaded") or 0),
                int(incoming.get("bytes_downloaded") or 0),
            )
            merged["merged_raw_sha256"] = list(dict.fromkeys([
                *(_as_list(existing.get("merged_raw_sha256"))),
                *(_as_list(existing.get("raw_sha256"))),
                *(_as_list(incoming.get("merged_raw_sha256"))),
                *(_as_list(incoming.get("raw_sha256"))),
            ]))
            contributing_payloads = [existing, incoming]
    else:
        existing_count = int(existing.get("samples_count") or len(existing_keys))
        incoming_count = int(incoming.get("samples_count") or len(incoming_keys))
        if existing_count > incoming_count:
            merged = dict(existing)
            contributing_payloads = [existing]
        else:
            merged = dict(incoming)
            contributing_payloads = [incoming]

    raw_paths = []
    for source_payload in contributing_payloads:
        for raw_path in _payload_raw_paths(source_payload):
            if raw_path not in raw_paths:
                raw_paths.append(raw_path)
    if raw_paths:
        merged["raw_file_paths"] = raw_paths
        if not merged.get("raw_file_path"):
            merged["raw_file_path"] = raw_paths[-1]
    return merged


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def queue_payload(out_dir, payload):
    ingestion_key = str(payload.get("ingestion_key") or "").strip()
    if not ingestion_key:
        raise ValueError("payload sem ingestion_key")
    pending_path = (
        Path(out_dir)
        / "pending"
        / f"pasteurizador_{ingestion_key}.pending.json"
    )
    payload_to_write = payload
    if pending_path.exists():
        existing = json.loads(pending_path.read_text(encoding="utf-8"))
        if not isinstance(existing, dict):
            raise ValueError(f"payload pendente inválido em {pending_path}")
        payload_to_write = merge_progressive_payload(existing, payload)
    _atomic_write_text(
        pending_path,
        json.dumps(payload_to_write, ensure_ascii=False, indent=2),
    )
    return pending_path


def archive_sent_payload(pending_path, retention=DEFAULT_SENT_PAYLOAD_RETENTION):
    pending_path = Path(pending_path)
    sent_dir = pending_path.parent.parent / "sent"
    sent_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    sent_name = pending_path.name.replace(
        ".pending.json",
        f".{stamp}.sent.json",
    )
    sent_path = sent_dir / sent_name
    pending_path.replace(sent_path)

    sent_files = sorted(
        sent_dir.glob("pasteurizador_*.sent.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    for stale in sent_files[max(int(retention), 0):]:
        stale.unlink(missing_ok=True)
    return sent_path


def quarantine_pending_payload(pending_path, reason):
    pending_path = Path(pending_path)
    rejected_dir = pending_path.parent.parent / "rejected"
    rejected_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    rejected_name = pending_path.name.replace(
        ".pending.json",
        f".{stamp}.rejected.json",
    )
    rejected_path = rejected_dir / rejected_name
    pending_path.replace(rejected_path)
    reason_path = rejected_path.with_suffix(".reason.json")
    _atomic_write_text(
        reason_path,
        json.dumps(
            {
                "reason": reason,
                "rejected_at": datetime.now().isoformat(timespec="seconds"),
                "payload_path": str(rejected_path),
            },
            ensure_ascii=False,
            indent=2,
        ),
    )
    return rejected_path


def replay_payload_disposition(payload, timezone_name):
    period_start_raw = payload.get("period_start")
    period_end_raw = payload.get("period_end")
    if not period_start_raw or not period_end_raw:
        return (
            "reject",
            "payload legado sem period_start/period_end; catch-up deve recriar o período completo",
        )

    try:
        period_start = parse_local_datetime(str(period_start_raw))
        period_end = parse_local_datetime(str(period_end_raw))
    except (AttributeError, TypeError, ValueError) as exc:
        return "reject", f"período inválido no payload: {exc}"

    if period_start > period_end:
        return "reject", "period_start posterior a period_end"

    if payload.get("status") != "processada":
        return (
            "reject",
            "payload com status diferente de processada; período deve ser recriado pelo catch-up",
        )

    downloaded_at_raw = payload.get("downloaded_at")
    if not downloaded_at_raw:
        return (
            "reject",
            "payload sem downloaded_at; não é possível provar que o período estava fechado",
        )
    try:
        downloaded_at = parse_local_datetime(str(downloaded_at_raw))
    except (AttributeError, TypeError, ValueError) as exc:
        return "reject", f"downloaded_at inválido no payload: {exc}"

    if downloaded_at <= period_end:
        return (
            "reject",
            "snapshot baixado antes do fechamento do período; catch-up deve recriar o dia completo",
        )

    if is_open_period(period_end, timezone_name):
        return "defer", "período ainda é hoje ou futuro no fuso do equipamento"

    return "deliver", None


def deliver_pending_payload(pending_path, env):
    pending_path = Path(pending_path)
    payload = json.loads(pending_path.read_text(encoding="utf-8"))
    http_status, body = post_json_with_retry(
        env["api_url"],
        env["api_token"],
        payload,
        env["http_timeout"],
        attempts=env["post_retry_attempts"],
        base_delay=env["post_retry_base_delay"],
        max_delay=env["post_retry_max_delay"],
    )
    if http_status < 200 or http_status >= 300:
        raise RuntimeError(f"API retornou HTTP {http_status}: {body[:1000]}")
    archive_sent_payload(
        pending_path,
        retention=env["sent_payload_retention"],
    )
    return http_status, body


def replay_pending_payloads(out_dir, env):
    if not env["api_url"]:
        return 0, 0
    pending_dir = Path(out_dir) / "pending"
    if not pending_dir.exists():
        return 0, 0

    posted = 0
    failed = 0
    pending_paths = sorted(pending_dir.glob("*.pending.json"))
    for index, pending_path in enumerate(pending_paths):
        try:
            payload = json.loads(pending_path.read_text(encoding="utf-8"))
            disposition, reason = replay_payload_disposition(
                payload,
                env.get("timezone", "America/Sao_Paulo"),
            )
            if disposition == "reject":
                rejected_path = quarantine_pending_payload(
                    pending_path,
                    reason,
                )
                print(
                    f"[{APP_NAME}] replay rejeitado e preservado em "
                    f"{rejected_path}: {reason}",
                    file=sys.stderr,
                )
                continue
            if disposition == "defer":
                print(
                    f"[{APP_NAME}] replay adiado para {pending_path.name}: {reason}",
                )
                continue

            status, _body = deliver_pending_payload(pending_path, env)
            posted += 1
            print(f"[{APP_NAME}] replay {pending_path.name} -> HTTP {status}")
            if (
                index < len(pending_paths) - 1
                and env["post_interval"] > 0
            ):
                time.sleep(env["post_interval"])
        except Exception as exc:
            failed += 1
            print(
                f"[{APP_NAME}] replay pendente falhou para {pending_path.name}: {exc}",
                file=sys.stderr,
            )
    return posted, failed


def prune_raw_snapshots(out_dir, retention=DEFAULT_RAW_SNAPSHOT_RETENTION):
    root = Path(out_dir)
    referenced = set()
    payload_paths = [
        *(root / "pending").glob("*.pending.json"),
        *(root / "rejected").glob("*.rejected.json"),
    ]
    for pending_path in payload_paths:
        try:
            payload = json.loads(pending_path.read_text(encoding="utf-8"))
            for raw_path in _payload_raw_paths(payload):
                referenced.add(str(Path(raw_path).resolve()))
        except Exception:
            # A corrupt queue entry must be kept for manual recovery.
            continue

    raw_files = sorted(
        (root / "raw").glob("pasteurizador_memflash_*.fl"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    kept_unreferenced = 0
    for raw_path in raw_files:
        if str(raw_path.resolve()) in referenced:
            continue
        kept_unreferenced += 1
        if kept_unreferenced > max(int(retention), 0):
            raw_path.unlink(missing_ok=True)


def resolve_period_status(
    all_samples,
    period_start,
    period_end,
    coverage_tolerance_seconds=DEFAULT_PERIOD_COVERAGE_TOLERANCE_SECONDS,
):
    if (period_start or period_end) and all_samples:
        arquivo_inicio = min(sample.timestamp for sample in all_samples)
        arquivo_fim = max(sample.timestamp for sample in all_samples)
        tolerance = timedelta(
            seconds=max(float(coverage_tolerance_seconds), 0.0)
        )
        if (
            period_start is not None
            and arquivo_inicio > period_start + tolerance
        ):
            return "erro", (
                "Histórico do equipamento não cobre o início integral do período: "
                f"arquivo inicia em {arquivo_inicio:%Y-%m-%d %H:%M:%S}, "
                f"período solicitado inicia em {period_start:%Y-%m-%d %H:%M:%S}, "
                f"tolerância={int(tolerance.total_seconds())}s."
            )
        if (
            period_end is not None
            and arquivo_fim < period_end - tolerance
        ):
            return "erro", (
                "Histórico do equipamento não cobre o fim integral do período: "
                f"arquivo termina em {arquivo_fim:%Y-%m-%d %H:%M:%S}, "
                f"período solicitado termina em {period_end:%Y-%m-%d %H:%M:%S}, "
                f"tolerância={int(tolerance.total_seconds())}s."
            )
    elif (period_start or period_end) and not all_samples:
        return "erro", "Nenhuma amostra foi decodificada do histórico baixado do equipamento."

    return "processada", None


def process_period(result, all_samples, channels, raw_path, env, period_start, period_end, timezone_name):
    equipment = env["equipment"]
    api_url = env["api_url"]
    post_empty_periods = env["post_empty_periods"]
    out_dir = raw_path.parent.parent

    if is_open_period(period_end, timezone_name):
        period_label = period_start or period_end
        print(
            f"[{APP_NAME}] período {period_label:%Y-%m-%d} ainda está aberto; "
            "nenhum payload parcial será publicado."
        )
        return PERIOD_PENDING

    samples = filter_samples_by_period(all_samples, period_start, period_end)
    status, mensagem_erro = resolve_period_status(all_samples, period_start, period_end)
    payload = build_payload(result, samples, channels, equipment, raw_path, period_start, period_end, status, mensagem_erro)
    stamp = period_start.strftime("%Y%m%d") if period_start else datetime.now().strftime("%Y%m%d_%H%M%S")
    diagnostic_path = out_dir / "diagnostics" / f"pasteurizador_payload_{stamp}.json"
    _atomic_write_text(
        diagnostic_path,
        json.dumps(payload, ensure_ascii=False, indent=2),
    )

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
    print(f"[{APP_NAME}] outbox json={diagnostic_path}")
    print(f"[{APP_NAME}] outbox raw={raw_path}")

    if status != "processada":
        print(
            f"[{APP_NAME}] período sem cobertura integral; diagnóstico preservado, "
            "mas nenhum payload parcial será enfileirado."
        )
        return PERIOD_PENDING

    if not payload["samples"]:
        if not post_empty_periods:
            print(f"[{APP_NAME}] período coberto e vazio; marcado como concluído sem POST.")
            return PERIOD_SKIPPED
        print(f"[{APP_NAME}] período coberto e vazio; será registrado na API.")

    pending_path = queue_payload(out_dir, payload)
    print(f"[{APP_NAME}] fila persistente={pending_path}")

    if api_url:
        try:
            http_status, body = deliver_pending_payload(pending_path, env)
            print(f"[{APP_NAME}] POST {api_url} -> HTTP {http_status}")
            if body:
                print(body[:1000])
            return PERIOD_POSTED
        except Exception as exc:
            print(
                f"[{APP_NAME}] erro ao enviar para API; payload preservado em "
                f"{pending_path}: {exc}",
                file=sys.stderr,
            )
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
    max_bytes = int(env.get("FIELDLOGGER_MAX_BYTES", str(DEFAULT_MAX_BYTES)))
    fieldlogger_request_timeout = float(
        env.get("FIELDLOGGER_REQUEST_TIMEOUT_SECONDS", str(DEFAULT_REQUEST_TIMEOUT_SECONDS))
    )
    fieldlogger_read_retry_attempts = int(
        env.get("FIELDLOGGER_READ_RETRY_ATTEMPTS", str(DEFAULT_READ_RETRY_ATTEMPTS))
    )
    fieldlogger_read_retry_delay = float(
        env.get("FIELDLOGGER_READ_RETRY_DELAY_SECONDS", str(DEFAULT_READ_RETRY_DELAY_SECONDS))
    )
    fieldlogger_snapshot_sync_attempts = int(
        env.get("FIELDLOGGER_SNAPSHOT_SYNC_ATTEMPTS", str(DEFAULT_SNAPSHOT_SYNC_ATTEMPTS))
    )
    api_url = env.get("SANTILAC_API_URL", "").strip()
    api_token = resolve_api_token(env)
    sync_state_url = env.get("SANTILAC_SYNC_STATE_URL", "").strip()
    http_timeout = int(env.get("SANTILAC_HTTP_TIMEOUT", "10800"))
    sync_timeout = min(
        max(int(env.get("SANTILAC_SYNC_TIMEOUT_SECONDS", "45")), 1),
        60,
    )
    sync_retry_attempts = min(
        max(int(env.get("SANTILAC_SYNC_RETRY_ATTEMPTS", "3")), 1),
        5,
    )
    sync_retry_delay = float(
        env.get("SANTILAC_SYNC_RETRY_DELAY_SECONDS", "2")
    )
    out_dir = env.get("OUTBOX_DIR", "/var/lib/santilac-pasteurizador/outbox")
    post_empty_periods = env.get("POST_EMPTY_PERIODS", "1").strip().lower() in {"1", "true", "yes", "sim"}
    state_file = env.get("PASTEURIZADOR_STATE_FILE", DEFAULT_STATE_FILE)
    catchup_lookback_days = int(env.get("PASTEURIZADOR_CATCHUP_LOOKBACK_DAYS", "90"))
    catchup_start_date = parse_state_date(env.get("PASTEURIZADOR_CATCHUP_START_DATE"))
    catchup_post_interval = float(env.get("PASTEURIZADOR_CATCHUP_POST_INTERVAL_SECONDS", "11"))
    post_retry_attempts = int(env.get("SANTILAC_POST_RETRY_ATTEMPTS", "8"))
    post_retry_base_delay = float(env.get("SANTILAC_POST_RETRY_BASE_DELAY_SECONDS", "5"))
    post_retry_max_delay = float(env.get("SANTILAC_POST_RETRY_MAX_DELAY_SECONDS", "300"))
    sent_payload_retention = int(
        env.get("PASTEURIZADOR_SENT_PAYLOAD_RETENTION", str(DEFAULT_SENT_PAYLOAD_RETENTION))
    )
    raw_snapshot_retention = int(
        env.get("PASTEURIZADOR_RAW_SNAPSHOT_RETENTION", str(DEFAULT_RAW_SNAPSHOT_RETENTION))
    )
    runtime_env = {
        "equipment": equipment,
        "api_url": api_url,
        "api_token": api_token,
        "timezone": args.timezone,
        "http_timeout": http_timeout,
        "post_retry_attempts": post_retry_attempts,
        "post_retry_base_delay": post_retry_base_delay,
        "post_retry_max_delay": post_retry_max_delay,
        "sent_payload_retention": sent_payload_retention,
        "post_empty_periods": post_empty_periods,
        "post_interval": catchup_post_interval,
    }
    if api_url and not api_token:
        RUNTIME_DETAILS.update({
            "equipment": equipment,
            "stage": "configuration_validation",
            "failure_reason": "credencial da API ausente no env e no backup",
        })
        print(
            f"[{APP_NAME}] SANTILAC_API_URL está configurada, mas a credencial "
            "está ausente no env e no backup; coleta abortada antes de tocar no FieldLogger.",
            file=sys.stderr,
        )
        return 2

    period_start = parse_local_datetime(args.start) if args.start else None
    period_end = parse_local_datetime(args.end) if args.end else None
    if args.previous_production_day:
        period_start, period_end = previous_production_day_range(args.timezone)
    elif args.previous_day:
        period_start, period_end = previous_day_range(args.timezone)
    elif period_start is None and period_end is None and not args.catch_up:
        args.catch_up = True
        print(
            f"[{APP_NAME}] nenhum período informado; usando catch-up seguro "
            "até o último dia de produção fechado."
        )
    if (period_start is None) != (period_end is None):
        print(
            f"[{APP_NAME}] período incompleto: informe --start e --end juntos.",
            file=sys.stderr,
        )
        return 2
    if period_start is not None and period_end is not None and period_start > period_end:
        print(f"[{APP_NAME}] periodo invalido: inicio maior que fim", file=sys.stderr)
        return 2

    started = time.time()
    replayed, replay_failed = replay_pending_payloads(out_dir, runtime_env)
    if replayed or replay_failed:
        print(
            f"[{APP_NAME}] replay da fila: enviados={replayed} "
            f"falhas={replay_failed}"
        )
    if replay_failed:
        RUNTIME_DETAILS["replay_failures"] = replay_failed

    pending_dates = None
    if args.catch_up:
        target = previous_production_day(args.timezone)
        remote_sync = fetch_remote_sync_state(
            api_url,
            api_token,
            sync_timeout,
            sync_state_url,
            attempts=sync_retry_attempts,
            retry_delay_seconds=sync_retry_delay,
        )
        remote_last_sample_date = remote_sync.get("last_sample_date") if remote_sync else None
        remote_series_start_date = remote_sync.get("series_start_date") if remote_sync else None
        remote_covered_dates = remote_sync.get("covered_dates") if remote_sync else None
        if remote_sync is not None:
            coverage_count = (
                len(remote_covered_dates)
                if remote_covered_dates is not None
                else "indisponível"
            )
            print(
                f"[{APP_NAME}] sync-state remoto={remote_sync['url']} "
                f"last_sample_date={remote_last_sample_date or 'null'} "
                f"series_start_date={remote_series_start_date or 'null'} "
                f"covered_dates={coverage_count}"
            )

        pending_dates = catch_up_dates(
            state_file,
            target,
            catchup_lookback_days,
            catchup_start_date,
            authoritative_last_date=remote_last_sample_date,
            authoritative_covered_dates=remote_covered_dates,
            authoritative_series_start_date=remote_series_start_date,
        )
        if not pending_dates:
            RUNTIME_DETAILS.update({
                "equipment": equipment,
                "stage": "up_to_date",
                "last_backend_sample_date": (
                    remote_last_sample_date.strftime(DATE_FORMAT)
                    if remote_last_sample_date
                    else None
                ),
            })
            print(f"[{APP_NAME}] catch-up sem dias pendentes até {target:%Y-%m-%d}.")
            prune_raw_snapshots(out_dir, raw_snapshot_retention)
            print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
            return 2 if replay_failed else 0

    print(f"[{APP_NAME}] coletando historico {equipment} em {host}:{port} unit={unit_id} max_bytes={max_bytes}")
    result = download_history_file(
        host=host,
        port=port,
        unit_id=unit_id,
        max_bytes=max_bytes,
        request_timeout=fieldlogger_request_timeout,
        read_retry_attempts=fieldlogger_read_retry_attempts,
        read_retry_delay_seconds=fieldlogger_read_retry_delay,
        snapshot_sync_attempts=fieldlogger_snapshot_sync_attempts,
    )
    result["downloaded_at"] = (
        datetime.now(ZoneInfo(args.timezone))
        .replace(tzinfo=None)
        .isoformat(timespec="seconds")
    )
    all_samples, channels = extract_history_samples(result["data"])
    if not channels:
        raise RuntimeError("Nenhum canal foi decodificado do histórico do FieldLogger.")
    if not all_samples:
        raise RuntimeError(
            "Nenhuma amostra válida foi decodificada; o estado não será avançado."
        )
    result["raw_sha256"] = hashlib.sha256(result["data"]).hexdigest()
    RUNTIME_DETAILS.update({
        "equipment": equipment,
        "stage": "history_decoded",
        "fieldlogger_host": host,
        "history_bytes": len(result["data"]),
        "history_sha256": result["raw_sha256"],
        "first_sample_timestamp": all_samples[0].timestamp.isoformat(sep=" "),
        "last_sample_timestamp": all_samples[-1].timestamp.isoformat(sep=" "),
        "decoded_samples": len(all_samples),
        "decoded_channels": [channel.name for channel in channels],
    })
    samples = filter_samples_by_period(all_samples, period_start, period_end)
    _, raw_path = write_outbox(
        out_dir,
        {
            "status": "raw_downloaded",
            "directory_size_hint": result.get("directory_size_hint"),
            "snapshot_size": result.get("snapshot_size"),
            "size_changed_during_download": result.get("size_changed_during_download"),
            "raw_sha256": result["raw_sha256"],
            "first_sample": all_samples[0].timestamp.isoformat(sep=" "),
            "last_sample": all_samples[-1].timestamp.isoformat(sep=" "),
            "samples": len(all_samples),
            "channels": [channel.name for channel in channels],
        },
        result["data"],
    )
    size_hint = result.get("directory_size_hint")
    if size_hint is not None:
        print(f"[{APP_NAME}] size_hint={size_hint} bytes_baixados={len(result['data'])}")

    if args.catch_up:
        print(
            f"[{APP_NAME}] catch-up dias={len(pending_dates)} "
            f"periodo={pending_dates[0]:%Y-%m-%d}..{pending_dates[-1]:%Y-%m-%d} "
            f"state={state_file}"
        )
        failed_dates = []
        for index, target_date in enumerate(pending_dates):
            day_start, day_end = day_range(target_date)
            outcome = process_period(result, all_samples, channels, raw_path, runtime_env, day_start, day_end, args.timezone)
            record_period_outcome(
                state_file,
                target_date,
                equipment,
                outcome,
                error=None if outcome in {PERIOD_POSTED, PERIOD_SKIPPED} else outcome,
            )
            if outcome in {PERIOD_PENDING, PERIOD_FAILED}:
                failed_dates.append(target_date)
                print(
                    f"[{APP_NAME}] catch-up pendente em {target_date:%Y-%m-%d}; "
                    "os demais dias continuarão e esta lacuna será retentada.",
                    file=sys.stderr,
                )
            else:
                print(f"[{APP_NAME}] catch-up estado atualizado: {target_date:%Y-%m-%d}")
            if outcome == PERIOD_POSTED and index < len(pending_dates) - 1 and catchup_post_interval > 0:
                print(f"[{APP_NAME}] aguardando {catchup_post_interval:.1f}s para respeitar o limite da API.")
                time.sleep(catchup_post_interval)

        prune_raw_snapshots(out_dir, raw_snapshot_retention)
        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return 2 if failed_dates or replay_failed else 0

    if (
        period_start is not None
        and period_end is not None
        and period_start.date() < period_end.date()
    ):
        remote_sync = fetch_remote_sync_state(
            api_url,
            api_token,
            sync_timeout,
            sync_state_url,
            attempts=sync_retry_attempts,
            retry_delay_seconds=sync_retry_delay,
        )
        remote_last_sample_date = remote_sync.get("last_sample_date") if remote_sync else None
        remote_covered_dates = remote_sync.get("covered_dates") if remote_sync else None
        today_local = datetime.now(ZoneInfo(args.timezone)).date()
        requested_dates = [
            target_date
            for target_date in production_dates(
                period_start.date(),
                period_end.date(),
            )
            if target_date < today_local
        ]
        if remote_covered_dates is not None:
            requested_dates = [
                target_date
                for target_date in requested_dates
                if target_date not in remote_covered_dates
            ]
        elif remote_last_sample_date is not None:
            requested_dates = [target_date for target_date in requested_dates if target_date > remote_last_sample_date]
        if remote_sync is not None:
            print(
                f"[{APP_NAME}] intervalo diario remoto="
                f"{remote_sync['url'] if remote_sync else 'n/a'} "
                f"last_sample_date={remote_last_sample_date:%Y-%m-%d}"
            )
        if not requested_dates:
            print(f"[{APP_NAME}] intervalo sem dias faltantes para gravar.")
            print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
            return 2 if replay_failed else 0

        print(
            f"[{APP_NAME}] intervalo diario dias={len(requested_dates)} "
            f"periodo={requested_dates[0]:%Y-%m-%d}..{requested_dates[-1]:%Y-%m-%d}"
        )
        failed_dates = []
        for index, target_date in enumerate(requested_dates):
            day_start, day_end = daily_period_bounds(
                period_start,
                period_end,
                target_date,
            )
            outcome = process_period(result, all_samples, channels, raw_path, runtime_env, day_start, day_end, args.timezone)
            if (
                target_date < today_local
                and is_full_day_range(day_start, day_end)
            ):
                record_period_outcome(
                    state_file,
                    target_date,
                    equipment,
                    outcome,
                    error=None if outcome in {PERIOD_POSTED, PERIOD_SKIPPED} else outcome,
                )
            if outcome in {PERIOD_PENDING, PERIOD_FAILED}:
                failed_dates.append(target_date)
                print(
                    f"[{APP_NAME}] intervalo pendente em {target_date:%Y-%m-%d}; "
                    "continuando para não bloquear dias posteriores.",
                    file=sys.stderr,
                )
            else:
                print(f"[{APP_NAME}] intervalo estado atualizado: {target_date:%Y-%m-%d}")
            if outcome == PERIOD_POSTED and index < len(requested_dates) - 1 and catchup_post_interval > 0:
                print(f"[{APP_NAME}] aguardando {catchup_post_interval:.1f}s para respeitar o limite da API.")
                time.sleep(catchup_post_interval)

        prune_raw_snapshots(out_dir, raw_snapshot_retention)
        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return 2 if failed_dates or replay_failed else 0

    if period_start is not None and period_end is not None:
        outcome = process_period(result, all_samples, channels, raw_path, runtime_env, period_start, period_end, args.timezone)
        prune_raw_snapshots(out_dir, raw_snapshot_retention)
        print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
        return (
            0
            if outcome in {PERIOD_POSTED, PERIOD_SKIPPED} and not replay_failed
            else 2
        )

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
    json_path = raw_path.parent.parent / "diagnostics" / (
        raw_path.name.replace("memflash", "payload")
    )
    json_path = json_path.with_suffix(".json")
    _atomic_write_text(
        json_path,
        json.dumps(payload, ensure_ascii=False, indent=2),
    )

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

    if payload["samples"] or post_empty_periods:
        pending_path = queue_payload(out_dir, payload)
    else:
        pending_path = None

    if api_url and pending_path is not None:
        try:
            status, body = deliver_pending_payload(pending_path, runtime_env)
            print(f"[{APP_NAME}] POST {api_url} -> HTTP {status}")
            if body:
                print(body[:1000])
        except Exception as exc:
            print(
                f"[{APP_NAME}] erro ao enviar para API; payload preservado em "
                f"{pending_path}: {exc}",
                file=sys.stderr,
            )
            return 2
    elif api_url:
        print(f"[{APP_NAME}] nenhum registro no periodo filtrado; POST ignorado porque POST_EMPTY_PERIODS=0.")
    else:
        print(
            f"[{APP_NAME}] SANTILAC_API_URL vazio; payload ficou salvo no outbox"
            f"{f' em {pending_path}' if pending_path else ''}."
        )

    prune_raw_snapshots(out_dir, raw_snapshot_retention)
    print(f"[{APP_NAME}] finalizado em {time.time() - started:.1f}s")
    unresolved_payload = pending_path is not None and not api_url
    return 2 if replay_failed or unresolved_payload else 0

   
if __name__ == "__main__":
    try:
        exit_code = main()
    except Exception as exc:
        try:
            write_health_status(1, error=exc)
        except Exception as health_error:
            print(
                f"[{APP_NAME}] não foi possível atualizar health: {health_error}",
                file=sys.stderr,
            )
        raise
    else:
        try:
            write_health_status(exit_code)
        except Exception as health_error:
            print(
                f"[{APP_NAME}] não foi possível atualizar health: {health_error}",
                file=sys.stderr,
            )
        raise SystemExit(exit_code)
