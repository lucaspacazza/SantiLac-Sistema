import unittest

from embalagem_label_processor import build_zpl


def pallet_payload(**overrides):
    payload = {
        "palete_id": 42,
        "codigo_barras": "PAL-000042",
        "numero": 1,
        "queijo": "Mussarela",
        "lote": "15",
        "data_fabricacao": "16/07/26",
        "data_validade": "16/10/26",
        "caixas_total": 45,
        "peso_total": 315.5,
        "qr_url": "https://example.invalid/palete/token",
    }
    payload.update(overrides)
    return payload


class EmbalagemLabelProcessorTest(unittest.TestCase):
    def test_uses_barcode_sent_by_api(self):
        zpl = build_zpl(pallet_payload())

        self.assertIn("^FDPAL-000042^FS", zpl)

    def test_keeps_legacy_fallback_when_api_has_no_barcode_field(self):
        payload = pallet_payload()
        payload.pop("codigo_barras")

        zpl = build_zpl(payload)

        self.assertIn("^FDPAL-42^FS", zpl)


if __name__ == "__main__":
    unittest.main()
