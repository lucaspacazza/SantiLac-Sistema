from __future__ import annotations

from pathlib import Path

from pypdf import PdfWriter

from modules.coletas.import_tickets_pdf import parse_page_texts, process_file


def test_extracts_tickets_and_keeps_producer_across_page_breaks() -> None:
    result = parse_page_texts([
        """SANTI'LAC LATICINIOS LTDA
Relacao de Tiket de Entrada
Periodo de 01/09/26 ate 02/09/26
Cliente Nome do Cliente
1403 MARINICE ANA SMANIOTTO
Data Quantidade Des% Qtd Desconto
01/09/2026 476 0,00% 0,00
SubTotal: 476 0,00
1412 DIRCEU SMANIOTTO
""",
        """SANTI'LAC LATICINIOS LTDA
Relacao de Tiket de Entrada
Data Quantidade Des% Qtd Desconto
02/09/2026 1.579 0,00% 0,00
SubTotal: 1.579 0,00
Total Recebido: 2.055
Total Desconto: 0
Total Liquido: 2.055
""",
    ])

    assert result["success"] is True
    assert result["summary"] == {
        "pages": 2,
        "total": 2,
        "valid": 2,
        "errors": 0,
        "warnings": 0,
        "liters": 2055,
        "declared_liters": 2055,
        "date_start": "2026-09-01",
        "date_end": "2026-09-02",
    }
    assert result["records"] == [
        {
            "source": {"page": 1},
            "data": {
                "produtor_codigo": "1403",
                "produtor_nome": "MARINICE ANA SMANIOTTO",
                "data": "2026-09-01",
                "litros": 476,
            },
        },
        {
            "source": {"page": 2},
            "data": {
                "produtor_codigo": "1412",
                "produtor_nome": "DIRCEU SMANIOTTO",
                "data": "2026-09-02",
                "litros": 1579,
            },
        },
    ]


def test_rejects_report_when_declared_total_differs_from_extracted_total() -> None:
    result = parse_page_texts([
        """Relacao de Tiket de Entrada
20 CLAUDEMIR PANDOLFO
Data Quantidade Des% Qtd Desconto
09/09/2026 339 0,00% 0,00
SubTotal: 339 0,00
Total Recebido: 340
""",
    ])

    assert result["success"] is False
    assert result["records"] == []
    assert result["errors"][0]["code"] == "MILK_IMPORT_422"


def test_rejects_duplicate_producer_and_day_inside_same_pdf() -> None:
    result = parse_page_texts([
        """Relacao de Tiket de Entrada
20 CLAUDEMIR PANDOLFO
Data Quantidade Des% Qtd Desconto
09/09/2026 339 0,00% 0,00
SubTotal: 339 0,00
20 CLAUDEMIR PANDOLFO
Data Quantidade Des% Qtd Desconto
09/09/2026 339 0,00% 0,00
SubTotal: 339 0,00
Total Recebido: 678
""",
    ])

    assert result["success"] is False
    assert result["records"] == []
    assert result["errors"][0]["code"] == "MILK_IMPORT_423"


def test_rejects_pdf_above_configured_page_limit(tmp_path: Path, monkeypatch) -> None:
    pdf_path = tmp_path / "large.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)
    with pdf_path.open("wb") as output:
        writer.write(output)

    monkeypatch.setenv("PROCESSOR_IMPORT_MAX_PAGES", "1")
    result = process_file(pdf_path)

    assert result["success"] is False
    assert result["errors"][0]["code"] == "MILK_IMPORT_410"
    assert "limite de 1 paginas" in result["errors"][0]["details"]["error"]
