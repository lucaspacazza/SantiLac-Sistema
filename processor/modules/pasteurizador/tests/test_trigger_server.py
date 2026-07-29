import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch


MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

import trigger_server


class CollectionTimeoutTests(unittest.TestCase):
    def test_reads_expanded_collection_timeout_from_processor_environment(self):
        with (
            patch.object(
                trigger_server,
                "load_env",
                return_value={"PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS": "7200"},
            ),
            patch.dict(trigger_server.os.environ, {}, clear=True),
        ):
            self.assertEqual(7200, trigger_server.collection_timeout_seconds())

    def test_collector_uses_cross_process_flock(self):
        self.assertEqual("/usr/bin/flock", trigger_server.BASE_COMMAND[0])
        self.assertIn(
            "/run/lock/santilac-pasteurizador.lock",
            trigger_server.BASE_COMMAND,
        )

    def test_health_distinguishes_missing_collector_status(self):
        with (
            patch.object(trigger_server, "load_env", return_value={}),
            patch.object(trigger_server, "read_state", return_value={}),
            patch.dict(trigger_server.os.environ, {}, clear=True),
        ):
            health = trigger_server.collector_health()

        self.assertFalse(health["available"])
        self.assertFalse(health["ready"])

    def test_health_is_ready_only_for_fresh_success_without_pending_queue(self):
        now = datetime(2026, 7, 29, 12, 0, 0)
        with tempfile.TemporaryDirectory() as tmp:
            with (
                patch.object(trigger_server, "load_env", return_value={}),
                patch.object(
                    trigger_server,
                    "read_state",
                    return_value={
                        "ok": True,
                        "exit_code": 0,
                        "last_run_at": (now - timedelta(hours=2)).isoformat(),
                    },
                ),
                patch.dict(
                    trigger_server.os.environ,
                    {"OUTBOX_DIR": tmp},
                    clear=True,
                ),
            ):
                health = trigger_server.collector_health(now=now)

        self.assertTrue(health["ready"])
        self.assertFalse(health["stale"])
        self.assertEqual(0, health["pending_payloads"])

    def test_health_is_not_ready_when_timer_status_is_stale(self):
        now = datetime(2026, 7, 29, 12, 0, 0)
        with tempfile.TemporaryDirectory() as tmp:
            with (
                patch.object(trigger_server, "load_env", return_value={}),
                patch.object(
                    trigger_server,
                    "read_state",
                    return_value={
                        "ok": True,
                        "exit_code": 0,
                        "last_run_at": (now - timedelta(hours=4)).isoformat(),
                    },
                ),
                patch.dict(
                    trigger_server.os.environ,
                    {"OUTBOX_DIR": tmp},
                    clear=True,
                ),
            ):
                health = trigger_server.collector_health(now=now)

        self.assertFalse(health["ready"])
        self.assertTrue(health["stale"])

    def test_health_is_not_ready_when_payload_is_pending(self):
        now = datetime(2026, 7, 29, 12, 0, 0)
        with tempfile.TemporaryDirectory() as tmp:
            pending_dir = Path(tmp) / "pending"
            pending_dir.mkdir()
            (pending_dir / "payload.pending.json").write_text(
                "{}",
                encoding="utf-8",
            )
            with (
                patch.object(trigger_server, "load_env", return_value={}),
                patch.object(
                    trigger_server,
                    "read_state",
                    return_value={
                        "ok": True,
                        "exit_code": 0,
                        "last_run_at": now.isoformat(),
                    },
                ),
                patch.dict(
                    trigger_server.os.environ,
                    {"OUTBOX_DIR": tmp},
                    clear=True,
                ),
            ):
                health = trigger_server.collector_health(now=now)

        self.assertFalse(health["ready"])
        self.assertEqual(1, health["pending_payloads"])

    def test_empty_collection_request_defaults_to_safe_catch_up(self):
        command = trigger_server.command_from_payload({})

        self.assertIn("--catch-up", command)
        self.assertNotIn("--start", command)
        self.assertNotIn("--end", command)

    def test_health_endpoint_returns_503_when_collector_is_not_ready(self):
        handler = object.__new__(trigger_server.Handler)
        handler.path = "/health"
        with (
            patch.object(
                trigger_server,
                "collector_health",
                return_value={"ready": False},
            ),
            patch.object(handler, "_send_json") as send_json,
        ):
            handler.do_GET()

        status, payload = send_json.call_args.args
        self.assertEqual(503, status)
        self.assertFalse(payload["ok"])


if __name__ == "__main__":
    unittest.main()
