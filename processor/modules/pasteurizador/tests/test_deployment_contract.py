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
        production_redundancy = (
            MODULE_DIR
            / "systemd"
            / "santilac-pasteurizador-production-redundancy.conf"
        ).read_text(encoding="utf-8")

        self.assertIn("OnCalendar=*-*-* *:05:00", timer)
        self.assertIn("OnBootSec=2min", production_redundancy)
        self.assertIn("OnUnitInactiveSec=10min", production_redundancy)
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
        self.assertIn("PASTEURIZADOR_API_BACKEND_CT", publish)
        self.assertIn("SANTILAC_API_KEY", publish)
        self.assertIn("--token-file", publish)
        self.assertIn("--persist-token-file", publish)
        self.assertIn("PROCESSOR_TOKEN_BACKUP", publish)
        self.assertIn("santilac-pasteurizador-production-redundancy.conf", publish)
        self.assertIn('[ "$PROCESSOR_CT" = "102" ]', publish)
        self.assertIn(
            "systemctl restart --no-block santilac-pasteurizador-daily.service",
            publish,
        )
        self.assertNotIn(
            "systemctl restart santilac-pasteurizador-daily.service;",
            publish,
        )
        self.assertNotIn('echo "$SANTILAC_API_TOKEN"', publish)

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
        self.assertIn(
            "SANTILAC_API_TOKEN_FILE=/etc/santilac-pasteurizador/api-token",
            example,
        )


if __name__ == "__main__":
    unittest.main()
