from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


OPERATION = "qualidade.exportar_produtores_analises_pdf"

HEADERS = [
    "Código",
    "Produtor",
    "Cidade",
    "Rota",
    "Status",
    "Data da análise",
    "CCS",
    "UFC",
    "Gord.",
    "Prot.",
    "Lact.",
    "Sólidos",
    "Caseína",
    "SNG",
    "Ureia",
    "ATB",
    "BCL",
    "Temp.",
]

METRIC_KEYS = [
    "ccs",
    "ufc",
    "gordura",
    "proteina",
    "lactose",
    "solidos_totais",
    "caseina",
    "sng",
    "ureia",
    "antibiotico",
    "bacteria",
    "temperatura",
]


def load_reportlab() -> dict[str, Any]:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
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
        "TA_CENTER": TA_CENTER,
        "TA_LEFT": TA_LEFT,
        "TA_RIGHT": TA_RIGHT,
        "colors": colors,
        "getSampleStyleSheet": getSampleStyleSheet,
        "landscape": landscape,
        "mm": mm,
    }


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def date_br(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return text


def decimal_value(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def decimal_br(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}".replace(".", ",")


def normalized_metric(key: str, value: Any) -> str:
    if key in {"antibiotico", "bacteria"}:
        if value is None or value == "":
            return ""
        try:
            return "POS" if float(value) > 0 else "NEG"
        except (TypeError, ValueError):
            return str(value)

    number = decimal_value(value)
    if number is None:
        return ""
    if key in {"ccs", "ufc"}:
        return str(int(number))
    return decimal_br(number)


def producer_row(produtor: dict[str, Any]) -> list[str]:
    analysis = produtor.get("ultima_analise") or {}
    status = "Com análise" if analysis else "Sem análise"

    row = [
        normalize_text(produtor.get("codigo")),
        normalize_text(produtor.get("nome")),
        normalize_text(produtor.get("cidade")),
        normalize_text(produtor.get("rota")),
        status,
        date_br(analysis.get("data")),
    ]
    row.extend(normalized_metric(key, analysis.get(key)) for key in METRIC_KEYS)
    return row


def make_styles(deps: dict[str, Any]) -> dict[str, Any]:
    ParagraphStyle = deps["ParagraphStyle"]
    getSampleStyleSheet = deps["getSampleStyleSheet"]
    TA_CENTER = deps["TA_CENTER"]
    TA_LEFT = deps["TA_LEFT"]
    TA_RIGHT = deps["TA_RIGHT"]

    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "SantiTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            textColor="#111827",
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "meta": ParagraphStyle(
            "SantiMeta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor="#4B5563",
            alignment=TA_LEFT,
        ),
        "cell": ParagraphStyle(
            "SantiCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=6.2,
            leading=7.4,
            textColor="#111827",
            alignment=TA_LEFT,
        ),
        "cell_center": ParagraphStyle(
            "SantiCellCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=6.2,
            leading=7.4,
            textColor="#111827",
            alignment=TA_CENTER,
        ),
        "cell_right": ParagraphStyle(
            "SantiCellRight",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=6.2,
            leading=7.4,
            textColor="#111827",
            alignment=TA_RIGHT,
        ),
    }


def add_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor("#6B7280")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 8, f"Página {doc.page}")
    canvas.restoreState()


def build_header(deps: dict[str, Any], styles: dict[str, Any], payload: dict[str, Any], logo_path: Path | None):
    Image = deps["Image"]
    Paragraph = deps["Paragraph"]
    Table = deps["Table"]
    TableStyle = deps["TableStyle"]
    Spacer = deps["Spacer"]
    colors = deps["colors"]
    mm = deps["mm"]

    logo = ""
    if logo_path and logo_path.exists():
        logo = Image(str(logo_path), width=46 * mm, height=18 * mm)

    title_block = [
        Paragraph("Relatório de produtores e análises", styles["title"]),
        Paragraph(f"Período de referência: {payload['periodo']['label']}", styles["meta"]),
        Paragraph(f"Gerado em: {date_br(payload.get('gerado_em', ''))} {normalize_text(payload.get('gerado_hora'))}", styles["meta"]),
    ]

    header = Table(
        [[logo, title_block]],
        colWidths=[72 * mm, 190 * mm],
        rowHeights=[24 * mm],
        hAlign="LEFT",
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))

    return [header, Spacer(1, 4 * mm)]


def build_summary(deps: dict[str, Any], payload: dict[str, Any]):
    Table = deps["Table"]
    TableStyle = deps["TableStyle"]
    colors = deps["colors"]
    mm = deps["mm"]

    totais = payload["totais"]
    data = [
        ["Produtores exportados", str(totais["produtores"])],
        ["Com análise no mês", str(totais["com_analise"])],
        ["Sem análise no mês", str(totais["sem_analise"])],
        ["Mês de referência", payload["periodo"]["label"]],
    ]
    table = Table(data, colWidths=[48 * mm, 28 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def build_data_table(deps: dict[str, Any], styles: dict[str, Any], payload: dict[str, Any]):
    Paragraph = deps["Paragraph"]
    Table = deps["Table"]
    TableStyle = deps["TableStyle"]
    colors = deps["colors"]
    mm = deps["mm"]

    rows = [producer_row(produtor) for produtor in payload.get("produtores", [])]
    data = [HEADERS]
    for row in rows:
        data.append([
            Paragraph(row[0], styles["cell_center"]),
            Paragraph(row[1], styles["cell"]),
            Paragraph(row[2], styles["cell"]),
            Paragraph(row[3], styles["cell_center"]),
            Paragraph(row[4], styles["cell_center"]),
            Paragraph(row[5], styles["cell_center"]),
            *[Paragraph(value, styles["cell_right"]) for value in row[6:]],
        ])

    widths = [
        12 * mm,
        42 * mm,
        30 * mm,
        9 * mm,
        17 * mm,
        17 * mm,
        11 * mm,
        11 * mm,
        11 * mm,
        11 * mm,
        11 * mm,
        13 * mm,
        13 * mm,
        10 * mm,
        11 * mm,
        9 * mm,
        9 * mm,
        11 * mm,
    ]

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 6.2),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 1), (-1, -1), 6.2),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def build_pdf(payload: dict[str, Any], output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    deps = load_reportlab()
    SimpleDocTemplate = deps["SimpleDocTemplate"]
    Spacer = deps["Spacer"]
    A4 = deps["A4"]
    landscape = deps["landscape"]
    mm = deps["mm"]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles(deps)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(A4),
        leftMargin=7 * mm,
        rightMargin=7 * mm,
        topMargin=7 * mm,
        bottomMargin=7 * mm,
        title="Relatório de produtores e análises",
        author="Santi'Lac Laticínios",
    )

    story = [
        *build_header(deps, styles, payload, logo_path),
        build_summary(deps, payload),
        Spacer(1, 4 * mm),
        build_data_table(deps, styles, payload),
    ]
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)

    return {
        "success": True,
        "operation": OPERATION,
        "output": str(output_path),
        "summary": payload["totais"],
    }


def export_file(input_path: Path, output_path: Path, logo_path: Path | None) -> dict[str, Any]:
    try:
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        return build_pdf(payload, output_path, logo_path)
    except Exception as exc:
        return {
            "success": False,
            "operation": OPERATION,
            "output": str(output_path),
            "errors": [
                {
                    "code": "EXPORT_820",
                    "message": "Falha ao gerar PDF.",
                    "details": {"error": str(exc)},
                }
            ],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta PDF de produtores e análises do Santi'Lac.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--logo")
    args = parser.parse_args()

    result = export_file(
        Path(args.input),
        Path(args.output),
        Path(args.logo) if args.logo else None,
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
