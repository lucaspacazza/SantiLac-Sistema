import unittest
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = MODULE_DIR.parents[2]


class DeploymentContractTests(unittest.TestCase):
    def test_timer_reconciles_hourly_and_service_restarts_failures(self):
        timer = (
            MODULE_DIR
            / "systemd"
            / "santilac-pasteurizador-daily.timer"
        ).read_text(encoding="utf-8")
        service = (
            MODULE_DIR
            / "systemd"
            / "santilac-pasteurizador-daily.service"
        ).read_text(encoding="utf-8")

        self.assertIn("OnCalendar=*-*-* *:05:00", timer)
        self.assertIn("Persistent=true", timer)
        self.assertIn("Restart=on-failure", service)
        self.assertIn("TimeoutStartSec=3h", service)
        self.assertIn("/usr/bin/flock", service)
        trigger_service = (
            MODULE_DIR
            / "systemd"
            / "santilac-pasteurizador-trigger.service"
        ).read_text(encoding="utf-8")
        self.assertIn("Environment=TZ=America/Sao_Paulo", trigger_service)

    def test_deploy_migrates_preserved_runtime_limits(self):
        publish = (
            REPO_ROOT / "deploy" / "scripts" / "publish-processor.sh"
        ).read_text(encoding="utf-8")

        self.assertIn("ensure_runtime_env.py", publish)
        self.assertIn(
            "/etc/santilac-pasteurizador/processor.env",
            publish,
        )

    def test_example_never_reintroduces_silent_size_cap(self):
        example = (
            REPO_ROOT / "processor" / ".env.example"
        ).read_text(encoding="utf-8")

        self.assertIn("FIELDLOGGER_MAX_BYTES=0", example)
        self.assertIn("FIELDLOGGER_HOST=192.168.5.101", example)
        self.assertIn(
            "PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS=10800",
            example,
        )
        self.assertIn("SANTILAC_HTTP_TIMEOUT=10800", example)
        self.assertIn("SANTILAC_SYNC_TIMEOUT_SECONDS=45", example)


if __name__ == "__main__":
    unittest.main()
