import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "testes" / "qualidade" / "processor" / "modules" / "qualidade"))

from import_analyses import (  # noqa: E402
    map_headers,
    normalize_header,
    parse_date,
    parse_float,
    parse_rows,
    process_file,
)


class ImportAnalysesTest(unittest.TestCase):
    def test_normalizes_headers(self):
        self.assertEqual(normalize_header(" C\u00d3DIGO "), "CODIGO")
        self.assertEqual(normalize_header("DATA_ANALISE"), "DATA ANALISE")

    def test_prefers_idprod_over_other_code_columns(self):
        mapped = map_headers(["CODIGO", "NOME", "IDPROD"])
        self.assertEqual(mapped["produtor_codigo"], [2, 0])

    def test_ignores_sheet_without_analysis_fields(self):
        records, errors, warnings = parse_rows("Resumo", [["Nome", "Valor"], ["Total", "10"]])
        self.assertEqual(records, [])
        self.assertEqual(errors, [])
        self.assertEqual(warnings[0]["code"], "IMPORT_315")

    def test_parses_brazilian_decimal_like_v3(self):
        self.assertEqual(parse_float("3,61"), 3.61)
        self.assertIsNone(parse_float("--"))
        self.assertIsNone(parse_float("0,0"))

    def test_parses_dates(self):
        self.assertEqual(parse_date("19/03/2026"), "2026-03-19")
        self.assertEqual(parse_date("2026-03-19"), "2026-03-19")

    def test_reads_real_laboratory_fixture(self):
        fixture = ROOT / "referencias" / "planilhas" / "importacao" / "SantiLac Laticinios LTDA_145136.xlsx"
        try:
            with fixture.open("rb"):
                pass
        except OSError as exc:
            self.skipTest(f"Fixture indisponivel localmente: {exc}")

        result = process_file(fixture, fixture.name, "fixture-hash")

        self.assertTrue(result["success"])
        self.assertEqual(result["summary"]["valid"], 63)
        self.assertEqual(result["summary"]["errors"], 0)

        first = result["records"][0]["data"]
        self.assertEqual(first["produtor_codigo"], 1098)
        self.assertEqual(first["data"], "2026-03-19")
        self.assertEqual(first["gordura"], 3.61)
        self.assertEqual(first["proteina"], 3.19)
        self.assertEqual(first["ccs"], 1034)
        self.assertIsNone(first["caseina"])
        self.assertIsNone(first["antibiotico"])
        self.assertEqual(first["temperatura"], 3.4)


if __name__ == "__main__":
    unittest.main()
