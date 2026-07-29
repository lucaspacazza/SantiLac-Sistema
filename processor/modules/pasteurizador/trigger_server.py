#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from collect_and_post import DEFAULT_ENV_FILE, load_env

LOCK = threading.Lock()
BASE_COMMAND = ["/usr/bin/python3", "/opt/santilac-pasteurizador-processor/collect_and_post.py"]
PDF_COMMAND = ["/usr/bin/python3", "/opt/santilac-pasteurizador-processor/export_chart_pdf.py"]
DEFAULT_COLLECTION_TIMEOUT_SECONDS = 7200


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
            self._send_json(200, {"ok": True, "service": "santilac-pasteurizador-trigger"})
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
            self._send_json(200 if result.returncode == 0 else 500, {
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
