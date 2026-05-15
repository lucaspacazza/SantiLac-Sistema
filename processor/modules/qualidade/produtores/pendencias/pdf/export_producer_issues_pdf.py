from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


OPERATION = "qualidade.exportar_produtor_pendencias_pdf"
CURRENT_DIR = Path(__file__).resolve().parent
GENERAL_EXPORTER = CURRENT_DIR.parents[2] / "relatorios" / "fora_padrao" / "geral" / "pdf"
sys.path.insert(0, str(GENERAL_EXPORTER))

from export_fora_padrao_pdf import build_pdf  # noqa: E402


def export_file(input_path: Path, output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    try:
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        result = build_pdf(payload, output_path, logo_path)
        result["operation"] = OPERATION
        return result
    except Exception as exc:
        return {
            "success": False,
            "operation": OPERATION,
            "errors": [{
                "code": "EXPORT_860",
                "message": "Falha ao exportar PDF de inconsistências do produtor.",
                "details": {"error": str(exc)},
            }],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta inconsistências de um produtor para PDF.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--logo", default="")
    args = parser.parse_args()

    logo_path = Path(args.logo) if args.logo else None
    result = export_file(Path(args.input), Path(args.output), logo_path)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
