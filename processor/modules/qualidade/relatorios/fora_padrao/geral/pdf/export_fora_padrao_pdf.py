from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


OPERATION = "qualidade.relatorios.fora_padrao.geral.pdf"


def load_reportlab() -> dict[str, Any]:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError("Dependência reportlab não instalada para exportação PDF.") from exc

    return {
        "A4": A4,
        "Image": Image,
        "Paragraph": Paragraph,
        "ParagraphStyle": ParagraphStyle,
        "SimpleDocTemplate": SimpleDocTemplate,
        "Spacer": Spacer,
        "Table": Table,
        "TableStyle": TableStyle,
        "TA_LEFT": TA_LEFT,
        "TA_RIGHT": TA_RIGHT,
        "colors": colors,
        "getSampleStyleSheet": getSampleStyleSheet,
        "landscape": landscape,
        "mm": mm,
    }


def text(value: Any) -> str:
    return "" if value is None else str(value)


def date_br(value: Any) -> str:
    raw = text(value)
    if not raw:
        return ""
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return raw


def decimal_br(value: Any) -> str:
    if value is None or value == "":
        return ""
    try:
        return f"{float(value):.2f}".replace(".", ",")
    except (TypeError, ValueError):
        return text(value)


def make_styles(deps: dict[str, Any]) -> dict[str, Any]:
    ParagraphStyle = deps["ParagraphStyle"]
    base = deps["getSampleStyleSheet"]()
    return {
        "title": ParagraphStyle("Title", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor="#111827"),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor="#4B5563"),
        "cell": ParagraphStyle("Cell", parent=base["Normal"], fontName="Helvetica", fontSize=7, leading=8.2, textColor="#111827"),
        "cell_right": ParagraphStyle("CellRight", parent=base["Normal"], fontName="Helvetica", fontSize=7, leading=8.2, textColor="#111827", alignment=deps["TA_RIGHT"]),
        "head": ParagraphStyle("Head", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=8, textColor="#FFFFFF"),
    }


def p(deps: dict[str, Any], value: Any, style) -> Any:
    return deps["Paragraph"](text(value), style)


def build_pdf(payload: dict[str, Any], output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    deps = load_reportlab()
    styles = make_styles(deps)
    SimpleDocTemplate = deps["SimpleDocTemplate"]
    Table = deps["Table"]
    TableStyle = deps["TableStyle"]
    Spacer = deps["Spacer"]
    Image = deps["Image"]
    colors = deps["colors"]
    mm = deps["mm"]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=deps["landscape"](deps["A4"]), leftMargin=10 * mm, rightMargin=10 * mm, topMargin=8 * mm, bottomMargin=8 * mm)
    story: list[Any] = []

    logo = Image(str(logo_path), width=45 * mm, height=17 * mm) if logo_path and logo_path.exists() else ""
    title_block = [
        p(deps, text(payload.get("titulo")) or "Relatório de produtores fora do padrão", styles["title"]),
        p(deps, f"Período de referência: {payload['periodo']['label']}", styles["meta"]),
        p(deps, f"Gerado em: {date_br(payload.get('gerado_em'))} {text(payload.get('gerado_hora'))}", styles["meta"]),
    ]
    header = Table([[logo, title_block]], colWidths=[58 * mm, 205 * mm])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.extend([header, Spacer(1, 5 * mm)])

    rows = [[
        p(deps, "Indicador", styles["head"]),
        p(deps, "Código", styles["head"]),
        p(deps, "Produtor", styles["head"]),
        p(deps, "Cidade", styles["head"]),
        p(deps, "Rota", styles["head"]),
        p(deps, "Data", styles["head"]),
        p(deps, "Valor", styles["head"]),
        p(deps, "Referência", styles["head"]),
    ]]

    for item in payload.get("items", []):
        unit = text(item.get("unidade"))
        valor = decimal_br(item.get("valor"))
        rows.append([
            p(deps, item.get("indicador_label"), styles["cell"]),
            p(deps, item.get("codigo"), styles["cell"]),
            p(deps, item.get("nome"), styles["cell"]),
            p(deps, item.get("cidade"), styles["cell"]),
            p(deps, item.get("rota"), styles["cell"]),
            p(deps, date_br(item.get("data")), styles["cell"]),
            p(deps, f"{valor} {unit}".strip(), styles["cell_right"]),
            p(deps, item.get("referencia"), styles["cell"]),
        ])

    table = Table(rows, repeatRows=1, colWidths=[37 * mm, 16 * mm, 54 * mm, 38 * mm, 13 * mm, 18 * mm, 22 * mm, 34 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)
    doc.build(story)

    return {"success": True, "operation": OPERATION, "output": str(output_path), "summary": payload.get("totais", {})}


def export_file(input_path: Path, output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    try:
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        return build_pdf(payload, output_path, logo_path)
    except Exception as exc:
        return {
            "success": False,
            "operation": OPERATION,
            "output": str(output_path),
            "errors": [{"code": "EXPORT_930", "message": "Falha ao gerar PDF.", "details": {"error": str(exc)}}],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta PDF geral de produtores fora do padrão.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--logo")
    args = parser.parse_args()

    result = export_file(Path(args.input), Path(args.output), Path(args.logo) if args.logo else None)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
