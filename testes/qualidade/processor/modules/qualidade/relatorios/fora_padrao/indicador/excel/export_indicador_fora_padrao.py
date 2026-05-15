from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


CURRENT_DIR = Path(__file__).resolve().parent
GENERAL_EXPORTER = CURRENT_DIR.parents[1] / "geral" / "excel"
sys.path.insert(0, str(GENERAL_EXPORTER))

from export_fora_padrao import build_workbook  # noqa: E402


OPERATION = "qualidade.relatorios.fora_padrao.indicador.excel"


def export_file(input_path: Path, output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    try:
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        indicador = payload.get("indicador") or {}
        label = indicador.get("label") or "Indicador"
        payload["items"] = [
            {**item, "indicador_label": label}
            for item in payload.get("items", [])
        ]
        result = build_workbook(payload, output_path, logo_path)
        result["operation"] = OPERATION
        return result
    except Exception as exc:
        return {
            "success": False,
            "operation": OPERATION,
            "output": str(output_path),
            "errors": [{"code": "EXPORT_920", "message": "Falha ao gerar planilha.", "details": {"error": str(exc)}}],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta relatório de fora do padrão por indicador.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--logo")
    args = parser.parse_args()

    result = export_file(Path(args.input), Path(args.output), Path(args.logo) if args.logo else None)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
