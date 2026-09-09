from __future__ import annotations

import json
import sys

from server import run_json_script


def test_run_json_script_reports_child_without_json() -> None:
    result = run_json_script([sys.executable, "-c", "raise RuntimeError('boom')"])

    assert result["success"] is False
    assert result["errors"][0]["code"] == "PROCESSOR_711"
    assert result["errors"][0]["details"]["returncode"] == 1


def test_run_json_script_accepts_structured_failure() -> None:
    payload = {"success": False, "errors": [{"code": "EXPECTED", "message": "falha"}]}
    result = run_json_script([sys.executable, "-c", f"print({json.dumps(json.dumps(payload))})"])

    assert result == payload
