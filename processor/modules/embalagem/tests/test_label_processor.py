from __future__ import annotations

import sys
import unittest
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

from embalagem_label_processor import build_zpl  # noqa: E402


class LabelProcessorTest(unittest.TestCase):
    def test_label_keeps_qr_for_phone_and_adds_code128_for_scanner(self) -> None:
        pallet = {
            "palete_id": 42,
            "numero": 3,
            "queijo": "Mussarela",
            "lote": "15",
            "data_fabricacao": "16/07/2026",
            "data_validade": "13/11/2026",
            "caixas_total": 45,
            "peso_total": 1132.2,
            "token": "abc123token",
            "qr_url": "https://embalagem.santilac.com.br/api/embalagem/paletes/abc123token/visualizar",
        }

        zpl = build_zpl(pallet)

        self.assertIn("^BQN,2,5", zpl)
        self.assertIn(pallet["qr_url"], zpl)
        self.assertIn("^BY2,2,48", zpl)
        self.assertIn("^BCN,48,Y,N,N^FDPAL-42^FS", zpl)


if __name__ == "__main__":
    unittest.main()
