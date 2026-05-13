from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
MAX_BODY_BYTES = 80 * 1024 * 1024


class ProcessorHandler(BaseHTTPRequestHandler):
    server_version = "SantiLacProcessor/1.0"

    def do_GET(self) -> None:
        if self.path == "/health":
            self.respond_json(200, {"success": True, "service": "processor"})
            return
        self.respond_json(404, error("PROCESSOR_404", "Rota nao encontrada."))

    def do_POST(self) -> None:
        if not self.authorized():
            self.respond_json(401, error("PROCESSOR_401", "Processor nao autorizado."))
            return

        try:
            payload = self.read_json()
        except ValueError as exc:
            self.respond_json(400, error("PROCESSOR_400", "JSON invalido.", {"error": str(exc)}))
            return

        if self.path == "/qualidade/import-analises":
            self.handle_import_analyses(payload)
            return

        if self.path == "/qualidade/export-produtores-analises/excel":
            self.handle_export(payload, "xlsx")
            return

        if self.path == "/qualidade/export-produtores-analises/pdf":
            self.handle_export(payload, "pdf")
            return

        self.respond_json(404, error("PROCESSOR_404", "Rota nao encontrada."))

    def authorized(self) -> bool:
        token = os.environ.get("PROCESSOR_TOKEN", "")
        return token == "" or self.headers.get("X-Processor-Token") == token

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            raise ValueError("Corpo da requisicao ausente.")
        if length > MAX_BODY_BYTES:
            raise ValueError("Corpo da requisicao maior que o limite permitido.")

        raw = self.rfile.read(length)
        decoded = json.loads(raw.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ValueError("Corpo JSON deve ser um objeto.")
        return decoded

    def handle_import_analyses(self, payload: dict[str, Any]) -> None:
        filename = str(payload.get("filename") or "analises.xlsx")
        file_hash = str(payload.get("hash") or "")
        content_base64 = str(payload.get("content_base64") or "")
        suffix = Path(filename).suffix.lower()
        if suffix not in [".xlsx", ".xls", ".csv"]:
            suffix = ".xlsx"

        try:
            content = base64.b64decode(content_base64, validate=True)
        except ValueError as exc:
            self.respond_json(400, error("PROCESSOR_413", "Arquivo em base64 invalido.", {"error": str(exc)}))
            return

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            input_path = Path(temp_file.name)

        try:
            script = BASE_DIR / "modules" / "qualidade" / "import_analyses.py"
            result = run_json_script([
                sys.executable,
                str(script),
                "--input",
                str(input_path),
                "--filename",
                filename,
                "--hash",
                file_hash,
            ])
        finally:
            input_path.unlink(missing_ok=True)

        self.respond_json(200 if isinstance(result, dict) else 500, result)

    def handle_export(self, payload: dict[str, Any], kind: str) -> None:
        data = payload.get("payload")
        if not isinstance(data, dict):
            self.respond_json(400, error("PROCESSOR_414", "Payload da exportacao invalido."))
            return

        script = BASE_DIR / "modules" / "qualidade" / "produtores" / "excel" / "export_producer_analyses.py"
        if kind == "pdf":
            script = BASE_DIR / "modules" / "qualidade" / "produtores" / "pdf" / "export_producer_analyses_pdf.py"

        logo = BASE_DIR / "assets" / "logo.png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json", mode="w", encoding="utf-8") as input_file:
            json.dump(data, input_file, ensure_ascii=False)
            input_path = Path(input_file.name)

        output_fd, output_name = tempfile.mkstemp(suffix=f".{kind}")
        os.close(output_fd)
        output_path = Path(output_name)

        try:
            result = run_json_script([
                sys.executable,
                str(script),
                "--input",
                str(input_path),
                "--output",
                str(output_path),
                "--logo",
                str(logo),
            ])

            if not isinstance(result, dict) or not result.get("success"):
                self.respond_json(500, result)
                return

            self.respond_json(200, {
                "success": True,
                "processor": result,
                "file_base64": base64.b64encode(output_path.read_bytes()).decode("ascii"),
            })
        finally:
            input_path.unlink(missing_ok=True)
            output_path.unlink(missing_ok=True)

    def respond_json(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def run_json_script(command: list[str]) -> dict[str, Any]:
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=120, check=False)
    try:
        decoded = json.loads(completed.stdout.strip() or "{}")
    except json.JSONDecodeError:
        return error("PROCESSOR_711", "Retorno do processor invalido.", {
            "stdout": completed.stdout,
            "stderr": completed.stderr,
            "returncode": completed.returncode,
        })

    if isinstance(decoded, dict):
        return decoded

    return error("PROCESSOR_711", "Retorno do processor invalido.", {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    })


def error(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "success": False,
        "errors": [{
            "code": code,
            "message": message,
            "details": details or {},
        }],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Servidor interno do processor Santi'Lac.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), ProcessorHandler)
    print(f"Processor HTTP ouvindo em {args.host}:{args.port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
