import sys
import unittest
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
                return_value={"PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS": "3600"},
            ),
            patch.dict(trigger_server.os.environ, {}, clear=True),
        ):
            self.assertEqual(3600, trigger_server.collection_timeout_seconds())


if __name__ == "__main__":
    unittest.main()
