#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


CHANNEL_COLORS = {
    "Temp.Pasteuriza": "#f06b2f",
    "Temp.Retardador": "#19a7c8",
    "Agua Quente": "#c59f35",
    "Bomba Leite": "#00a878",
    "Tan.Equilibrio": "#8155bd",
    "Valvula Desvio": "#d94d78",
    "Vazao": "#3498db",
}

CHANNEL_ORDER = [
    "Agua Quente",
    "Bomba Leite",
    "Tan.Equilibrio",
    "Temp.Pasteuriza",
    "Temp.Retardador",   
    "Valvula Desvio",
    "Vazao",
]


def load_reportlab() -> dict[str, Any]:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise RuntimeError("Dependencia reportlab nao instalada para exportacao PDF.") from exc

    return {
        "A4": A4,
        "canvas": canvas,
        "colors": colors,
        "landscape": landscape,
        "mm": mm,
    }


def parse_dt(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue
    return None


def br_date_time(value: Any) -> str:
    dt = parse_dt(value)
    if dt is None:
        return str(value or "-")
    return dt.strftime("%d/%m/%Y %H:%M:%S")


def decimal_br(value: float | None, suffix: str = "") -> str:
    if value is None or not math.isfinite(value):
        return "-"
    return f"{value:.2f}".replace(".", ",") + suffix


def sorted_channels(channels: list[str]) -> list[str]:
    known = [channel for channel in CHANNEL_ORDER if channel in channels]
    extra = sorted(channel for channel in channels if channel not in CHANNEL_ORDER)
    return known + extra


def downsample(points: list[tuple[float, float, datetime | None]], max_points: int = 1400) -> list[tuple[float, float, datetime | None]]:
    if len(points) <= max_points:
        return points
    step = len(points) / max_points
    return [points[min(int(index * step), len(points) - 1)] for index in range(max_points)]


def value_bounds(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 1.0
    minimum = min(values)
    maximum = max(values)
    if math.isclose(minimum, maximum):
        return minimum - 1.0, maximum + 1.0
    padding = (maximum - minimum) * 0.08
    return minimum - padding, maximum + padding


def draw_pdf(payload: dict[str, Any], output: Path) -> None:
    deps = load_reportlab()
    colors = deps["colors"]
    mm = deps["mm"]
    page_size = deps["landscape"](deps["A4"])
    pdf = deps["canvas"].Canvas(str(output), pagesize=page_size)
    width, height = page_size

    samples = payload.get("samples") or []
    filters = payload.get("filtros") or {}
    periodo = payload.get("periodo") or {}
    generated_at = payload.get("gerado_em") or datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    selected_channel = str(filters.get("canal") or "Todos")

    grouped: dict[str, list[tuple[float, float, datetime | None]]] = defaultdict(list)
    for index, sample in enumerate(samples):
        channel = str(sample.get("canal") or "Canal")
        try:
            value = float(sample.get("valor"))
        except (TypeError, ValueError):
            continue
        dt = parse_dt(sample.get("timestamp_registro"))
        x_value = dt.timestamp() if dt is not None else float(index)
        grouped[channel].append((x_value, value, dt))

    all_channels = sorted_channels(list(grouped.keys()))
    if selected_channel != "Todos":
        visible_channels = [selected_channel] if selected_channel in grouped else []
    elif "Temp.Pasteuriza" in grouped:
        visible_channels = ["Temp.Pasteuriza"]
    else:
        visible_channels = all_channels

    visible_points = [point for channel in visible_channels for point in grouped.get(channel, [])]
    x_values = [point[0] for point in visible_points]
    y_values = [point[1] for point in visible_points]
    x_min = min(x_values) if x_values else 0.0
    x_max = max(x_values) if x_values else 1.0
    if math.isclose(x_min, x_max):
        x_max = x_min + 1.0
    y_min, y_max = value_bounds(y_values)

    temp_values = [point[1] for point in grouped.get("Temp.Pasteuriza", [])] or y_values
    avg_temp = sum(temp_values) / len(temp_values) if temp_values else None
    min_value = min(y_values) if y_values else None
    max_value = max(y_values) if y_values else None

    margin_x = 16 * mm
    top = height - 15 * mm
    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 17)
    pdf.drawString(margin_x, top, "Historico do pasteurizador")
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#5b677a"))
    pdf.drawString(margin_x, top - 13, f"Periodo: {periodo.get('label') or '-'}")
    pdf.drawRightString(width - margin_x, top - 13, f"Gerado em: {generated_at}")

    stat_y = top - 36
    stats = [
        ("Media temp.", decimal_br(avg_temp, " C")),
        ("Minima", decimal_br(min_value)),
        ("Maxima", decimal_br(max_value)),
        ("Pontos", f"{len(samples):,}".replace(",", ".")),
    ]
    stat_x = margin_x
    for label, value in stats:
        pdf.setStrokeColor(colors.HexColor("#d6dde8"))
        pdf.setFillColor(colors.HexColor("#f5f8fc"))
        pdf.roundRect(stat_x, stat_y - 25, 35 * mm, 23, 5, stroke=1, fill=1)
        pdf.setFillColor(colors.HexColor("#5b677a"))
        pdf.setFont("Helvetica", 7)
        pdf.drawString(stat_x + 7, stat_y - 10, label)
        pdf.setFillColor(colors.HexColor("#111827"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(stat_x + 7, stat_y - 22, value)
        stat_x += 39 * mm

    chart_x = margin_x
    chart_y = 25 * mm
    chart_w = width - margin_x * 2
    chart_h = height - 78 * mm

    pdf.setStrokeColor(colors.HexColor("#d6dde8"))
    pdf.setFillColor(colors.HexColor("#ffffff"))
    pdf.roundRect(chart_x, chart_y, chart_w, chart_h, 6, stroke=1, fill=1)

    plot_x = chart_x + 18 * mm
    plot_y = chart_y + 18 * mm
    plot_w = chart_w - 27 * mm
    plot_h = chart_h - 34 * mm

    def sx(value: float) -> float:
        return plot_x + ((value - x_min) / (x_max - x_min)) * plot_w

    def sy(value: float) -> float:
        return plot_y + ((value - y_min) / (y_max - y_min)) * plot_h

    pdf.setStrokeColor(colors.HexColor("#eef2f7"))
    pdf.setLineWidth(0.45)
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(colors.HexColor("#5b677a"))
    for i in range(6):
        y = plot_y + (plot_h / 5) * i
        value = y_min + ((y_max - y_min) / 5) * i
        pdf.line(plot_x, y, plot_x + plot_w, y)
        pdf.drawRightString(plot_x - 5, y - 2, decimal_br(value))

    for i in range(6):
        x = plot_x + (plot_w / 5) * i
        value = x_min + ((x_max - x_min) / 5) * i
        pdf.line(x, plot_y, x, plot_y + plot_h)
        label = datetime.fromtimestamp(value).strftime("%d/%m %H:%M") if x_values else ""
        pdf.drawCentredString(x, plot_y - 12, label)

    pdf.setStrokeColor(colors.HexColor("#b9c3d0"))
    pdf.setLineWidth(0.8)
    pdf.line(plot_x, plot_y, plot_x, plot_y + plot_h)
    pdf.line(plot_x, plot_y, plot_x + plot_w, plot_y)
    pdf.drawCentredString(plot_x + plot_w / 2, chart_y + 9, "Data/hora")
    pdf.saveState()
    pdf.translate(chart_x + 8 * mm, plot_y + plot_h / 2)
    pdf.rotate(90)
    pdf.drawCentredString(0, 0, "Valor")
    pdf.restoreState()

    legend_x = plot_x
    legend_y = chart_y + chart_h - 16
    pdf.setFont("Helvetica", 7)
    for channel in all_channels:
        color = colors.HexColor(CHANNEL_COLORS.get(channel, "#64748b"))
        pdf.setStrokeColor(color)
        pdf.setLineWidth(1.4 if channel in visible_channels else 0.7)
        pdf.line(legend_x, legend_y, legend_x + 18, legend_y)
        pdf.setFillColor(colors.HexColor("#111827") if channel in visible_channels else colors.HexColor("#8a94a6"))
        pdf.drawString(legend_x + 22, legend_y - 3, channel)
        legend_x += max(58, len(channel) * 4.2 + 28)

    pdf.setLineJoin(1)
    for channel in visible_channels:
        points = downsample(sorted(grouped.get(channel, []), key=lambda item: item[0]))
        if len(points) < 2:
            continue
        pdf.setStrokeColor(colors.HexColor(CHANNEL_COLORS.get(channel, "#111827")))
        pdf.setLineWidth(1.1 if channel == "Temp.Pasteuriza" else 0.9)
        path = pdf.beginPath()
        path.moveTo(sx(points[0][0]), sy(points[0][1]))
        for x_value, y_value, _ in points[1:]:
            path.lineTo(sx(x_value), sy(y_value))
        pdf.drawPath(path, stroke=1, fill=0)

    if not visible_points:
        pdf.setFont("Helvetica", 12)
        pdf.setFillColor(colors.HexColor("#64748b"))
        pdf.drawCentredString(plot_x + plot_w / 2, plot_y + plot_h / 2, "Sem amostras para exibir.")

    first = min((point[2] for point in visible_points if point[2] is not None), default=None)
    last = max((point[2] for point in visible_points if point[2] is not None), default=None)
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(colors.HexColor("#667085"))
    pdf.drawString(margin_x, 12 * mm, f"Primeira amostra: {br_date_time(first)}")
    pdf.drawRightString(width - margin_x, 12 * mm, f"Ultima amostra: {br_date_time(last)}")

    pdf.showPage()
    pdf.save()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--logo")
    args = parser.parse_args()

    try:
        payload = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
        draw_pdf(payload, Path(args.output))
        print(json.dumps({"success": True, "output": args.output}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "errors": [{"code": "PAST_PDF_500", "message": str(exc)}]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
