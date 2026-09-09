from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

from pypdf import PdfReader


OPERATION = "coletas.importar_tickets"
REPORT_TITLE = "relacao de tiket de entrada"
PRODUCER_LINE = re.compile(r"^\s*(\d+)\s+(.+?)\s*$")
TICKET_LINE = re.compile(
    r"^\s*(\d{2}/\d{2}/\d{4})\s+([\d.]+(?:,\d+)?)\s+[-\d.,]+%\s+[-\d.,]+\s*$"
)
TOTAL_LINE = re.compile(r"^\s*Total\s+Recebido:\s*([\d.]+(?:,\d+)?)\s*$", re.IGNORECASE)


def normalize_text(value: str) -> str:
    return " ".join(value.casefold().replace("ç", "c").replace("ã", "a").split())


def parse_number(value: str) -> Decimal:
    normalized = value.strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"Quantidade invalida: {value}") from exc


def numeric_output(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)


def parse_page_texts(page_texts: Iterable[str]) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    current_producer: tuple[str, str] | None = None
    declared_liters: Decimal | None = None
    title_found = False
    pages = 0

    for pages, page_text in enumerate(page_texts, start=1):
        if REPORT_TITLE in normalize_text(page_text):
            title_found = True

        for line_number, raw_line in enumerate(page_text.splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue

            total_match = TOTAL_LINE.match(line)
            if total_match:
                declared_liters = parse_number(total_match.group(1))
                continue

            ticket_match = TICKET_LINE.match(line)
            if ticket_match:
                if current_producer is None:
                    errors.append({
                        "page": pages,
                        "line": line_number,
                        "code": "MILK_IMPORT_421",
                        "message": "Coleta encontrada sem produtor identificado.",
                        "details": {"content": line},
                    })
                    continue

                try:
                    collection_date = datetime.strptime(ticket_match.group(1), "%d/%m/%Y").date()
                    liters = parse_number(ticket_match.group(2))
                except ValueError as exc:
                    errors.append({
                        "page": pages,
                        "line": line_number,
                        "code": "MILK_IMPORT_420",
                        "message": "Data ou quantidade invalida.",
                        "details": {"content": line, "error": str(exc)},
                    })
                    continue

                if liters <= 0:
                    errors.append({
                        "page": pages,
                        "line": line_number,
                        "code": "MILK_IMPORT_420",
                        "message": "Quantidade deve ser maior que zero.",
                        "details": {"content": line},
                    })
                    continue

                records.append({
                    "source": {"page": pages},
                    "data": {
                        "produtor_codigo": current_producer[0],
                        "produtor_nome": current_producer[1],
                        "data": collection_date.isoformat(),
                        "litros": numeric_output(liters),
                    },
                })
                continue

            producer_match = PRODUCER_LINE.match(line)
            if producer_match and "/" not in producer_match.group(1):
                name = producer_match.group(2).strip()
                normalized_name = normalize_text(name)
                if normalized_name not in {"", "qtd desconto"}:
                    current_producer = (producer_match.group(1), name)

    if not title_found:
        errors.append({
            "code": "MILK_IMPORT_411",
            "message": "O PDF nao e o relatorio Leite - Relacao de Tiket de Entrada.",
            "details": {},
        })

    if not records:
        errors.append({
            "code": "MILK_IMPORT_412",
            "message": "Nenhuma coleta foi encontrada no PDF.",
            "details": {},
        })

    duplicate_keys: dict[tuple[str, str], list[int]] = {}
    for record in records:
        data = record["data"]
        key = (str(data["produtor_codigo"]), str(data["data"]))
        duplicate_keys.setdefault(key, []).append(int(record["source"]["page"]))
    duplicates = {key: page_list for key, page_list in duplicate_keys.items() if len(page_list) > 1}
    if duplicates:
        errors.append({
            "code": "MILK_IMPORT_423",
            "message": "O PDF possui mais de uma coleta para o mesmo produtor e dia.",
            "details": {
                "duplicates": [
                    {"produtor_codigo": key[0], "data": key[1], "pages": page_list}
                    for key, page_list in list(duplicates.items())[:50]
                ],
            },
        })

    liters_total = sum((Decimal(str(record["data"]["litros"])) for record in records), Decimal(0))
    if declared_liters is None:
        warnings.append({
            "code": "MILK_IMPORT_321",
            "message": "Total Recebido nao foi encontrado; a soma foi calculada pelas coletas.",
            "details": {},
        })
    elif declared_liters != liters_total:
        errors.append({
            "code": "MILK_IMPORT_422",
            "message": "O total extraido nao confere com o Total Recebido do PDF.",
            "details": {
                "extracted_liters": numeric_output(liters_total),
                "declared_liters": numeric_output(declared_liters),
            },
        })

    dates = [str(record["data"]["data"]) for record in records]
    success = not errors and bool(records)
    return {
        "success": success,
        "operation": OPERATION,
        "summary": {
            "pages": pages,
            "total": len(records),
            "valid": len(records) if success else 0,
            "errors": len(errors),
            "warnings": len(warnings),
            "liters": numeric_output(liters_total),
            "declared_liters": numeric_output(declared_liters) if declared_liters is not None else None,
            "date_start": min(dates) if dates else None,
            "date_end": max(dates) if dates else None,
        },
        "records": records if success else [],
        "errors": errors,
        "warnings": warnings,
    }


def process_file(path: Path, filename: str | None = None, file_hash: str | None = None) -> dict[str, Any]:
    try:
        reader = PdfReader(str(path), strict=False)
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception as exc:
                raise ValueError("PDF protegido por senha.") from exc
        max_pages = max(1, int(os.environ.get("PROCESSOR_IMPORT_MAX_PAGES", "20000")))
        if len(reader.pages) > max_pages:
            raise ValueError(f"PDF excede o limite de {max_pages} paginas.")
        result = parse_page_texts((page.extract_text() or "" for page in reader.pages))
    except Exception as exc:
        result = {
            "success": False,
            "operation": OPERATION,
            "summary": {"pages": 0, "total": 0, "valid": 0, "errors": 1, "warnings": 0, "liters": 0, "declared_liters": None, "date_start": None, "date_end": None},
            "records": [],
            "errors": [{"code": "MILK_IMPORT_410", "message": "Nao foi possivel ler o PDF.", "details": {"error": str(exc)}}],
            "warnings": [],
        }

    result["metadata"] = {"filename": filename or path.name, "file_hash": file_hash}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa tickets de entrada de leite do Santi'Lac.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--filename")
    parser.add_argument("--hash")
    args = parser.parse_args()

    result = process_file(Path(args.input), args.filename, args.hash)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
