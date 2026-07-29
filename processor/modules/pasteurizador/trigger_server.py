#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from collect_and_post import (
    DEFAULT_ENV_FILE,
    DEFAULT_HEALTH_FILE,
    load_env,
    read_state,
)

LOCK = threading.Lock()
BASE_COMMAND = [
    "/usr/bin/flock",
    "--nonblock",
    "--conflict-exit-code",
    "75",
    "/run/lock/santilac-pasteurizador.lock",
    "/usr/bin/python3",
    "/opt/santilac-pasteurizador-processor/collect_and_post.py",
]
PDF_COMMAND = ["/usr/bin/python3", "/opt/santilac-pasteurizador-processor/export_chart_pdf.py"]
DEFAULT_COLLECTION_TIMEOUT_SECONDS = 10800
DEFAULT_HEALTH_MAX_AGE_SECONDS = 3 * 60 * 60


def collection_timeout_seconds():
    env_path = os.environ.get("PASTEURIZADOR_ENV", DEFAULT_ENV_FILE)
    env = {**load_env(env_path), **os.environ}
    try:
        return max(
            int(env.get("PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS", DEFAULT_COLLECTION_TIMEOUT_SECONDS)),
            1,
        )
    except (TypeError, ValueError):
        return DEFAULT_COLLECTION_TIMEOUT_SECONDS


def collector_health(now=None):
    env_path = os.environ.get("PASTEURIZADOR_ENV", DEFAULT_ENV_FILE)
    env = {**load_env(env_path), **os.environ}
    health_path = env.get("PASTEURIZADOR_HEALTH_FILE", DEFAULT_HEALTH_FILE)
    payload = read_state(health_path)
    available = bool(payload)
    outbox_dir = Path(
        env.get("OUTBOX_DIR", "/var/lib/santilac-pasteurizador/outbox")
    )
    pending_dir = outbox_dir / "pending"
    rejected_dir = outbox_dir / "rejected"
    try:
        max_age_seconds = max(
            int(
                env.get(
                    "PASTEURIZADOR_HEALTH_MAX_AGE_SECONDS",
                    DEFAULT_HEALTH_MAX_AGE_SECONDS,
                )
            ),
            1,
        )
    except (TypeError, ValueError):
        max_age_seconds = DEFAULT_HEALTH_MAX_AGE_SECONDS

    age_seconds = None
    stale = True
    last_run_at = payload.get("last_run_at")
    if last_run_at:
        try:
            last_run = datetime.fromisoformat(str(last_run_at))
            current = now or datetime.now(tz=last_run.tzinfo)
            if current.tzinfo is None and last_run.tzinfo is not None:
                current = current.replace(tzinfo=last_run.tzinfo)
            elif current.tzinfo is not None and last_run.tzinfo is None:
                last_run = last_run.replace(tzinfo=current.tzinfo)
            age_seconds = max((current - last_run).total_seconds(), 0.0)
            stale = age_seconds > max_age_seconds
        except (TypeError, ValueError):
            stale = True

    pending_count = len(list(pending_dir.glob("*.pending.json")))
    rejected_count = len(list(rejected_dir.glob("*.rejected.json")))
    reason_files = sorted(
        rejected_dir.glob("*.reason.json"),
        key=lambda item: item.stat().st_mtime,
    )
    last_rejected_reason = payload.get("last_rejected_reason")
    if reason_files:
        try:
            last_rejected_reason = json.loads(
                reason_files[-1].read_text(encoding="utf-8")
            ).get("reason")
        except Exception:
            last_rejected_reason = "motivo de rejeição ilegível"
    try:
        healthy_exit = int(payload.get("exit_code", 1)) == 0
    except (TypeError, ValueError):
        healthy_exit = False
    payload["health_file"] = health_path
    payload["pending_payloads"] = pending_count
    payload["rejected_payloads"] = rejected_count
    payload["available"] = available
    payload["age_seconds"] = age_seconds
    payload["max_age_seconds"] = max_age_seconds
    payload["stale"] = stale
    payload["last_rejected_reason"] = last_rejected_reason
    payload["ready"] = (
        available
        and payload.get("ok") is True
        and healthy_exit
        and pending_count == 0
        and not stale
    )
    return payload


def normalize_time(value, fallback):
    text = str(value or fallback).strip()
    if not text:
        return fallback
    parts = text.split(":")
    if len(parts) == 2:
        return f"{parts[0]}:{parts[1]}:00"
    if len(parts) == 3:
        return text
    return fallback


def command_from_payload(payload):
    command = BASE_COMMAND.copy()

    if payload.get("catch_up"):
        command.append("--catch-up")
    elif payload.get("previous_day"):
        command.append("--previous-day")
    else:
        start = payload.get("start")
        end = payload.get("end")

        if not start and payload.get("inicio"):
            start = f"{payload.get('inicio')} {normalize_time(payload.get('hora_inicio'), '00:00:00')}"
        if not end and payload.get("fim"):
            end = f"{payload.get('fim')} {normalize_time(payload.get('hora_fim'), '23:59:59')}"

        if start:
            command.extend(["--start", str(start)])
        if end:
            command.extend(["--end", str(end)])
        if not start and not end:
            command.append("--catch-up")

    timezone = payload.get("timezone")
    if timezone:
        command.extend(["--timezone", str(timezone)])

    return command


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_pdf(self, path):
        body = Path(path).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            collector = collector_health()
            ready = collector["ready"]
            self._send_json(200 if ready else 503, {
                "ok": ready,
                "service": "santilac-pasteurizador-trigger",
                "collector": collector,
            })
            return
        self._send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path == "/export-chart/pdf":
            try:
                payload = self._read_json()
                with tempfile.TemporaryDirectory(prefix="santilac_pasteurizador_pdf_") as tmp:
                    input_path = Path(tmp) / "payload.json"
                    output_path = Path(tmp) / "grafico.pdf"
                    input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                    result = subprocess.run(
                        [*PDF_COMMAND, "--input", str(input_path), "--output", str(output_path)],
                        cwd="/opt/santilac-pasteurizador-processor",
                        text=True,
                        capture_output=True,
                        timeout=120,
                    )
                    if result.returncode != 0 or not output_path.exists():
                        self._send_json(500, {
                            "ok": False,
                            "error": "pdf_export_failed",
                            "stdout": result.stdout[-3000:],
                            "stderr": result.stderr[-3000:],
                        })
                        return
                    self._send_pdf(output_path)
                return
            except subprocess.TimeoutExpired as exc:
                self._send_json(504, {"ok": False, "error": "pdf_timeout", "stdout": exc.stdout, "stderr": exc.stderr})
                return
            except Exception as exc:
                self._send_json(500, {"ok": False, "error": str(exc)})
                return

        if self.path != "/collect":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return
        if not LOCK.acquire(blocking=False):
            self._send_json(409, {"ok": False, "error": "collection_already_running"})
            return
        try:
            payload = self._read_json()
            command = command_from_payload(payload)
            result = subprocess.run(
                command,
                cwd="/opt/santilac-pasteurizador-processor",
                text=True,
                capture_output=True,
                timeout=collection_timeout_seconds(),
            )
            response_status = 200 if result.returncode == 0 else (
                409 if result.returncode == 75 else 500
            )
            self._send_json(response_status, {
                "ok": result.returncode == 0,
                "returncode": result.returncode,
                "command": command,
                "stdout": result.stdout[-6000:],
                "stderr": result.stderr[-3000:],
            })
        except subprocess.TimeoutExpired as exc:
            self._send_json(504, {"ok": False, "error": "timeout", "stdout": exc.stdout, "stderr": exc.stderr})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
        finally:
            LOCK.release()

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8095), Handler).serve_forever()
