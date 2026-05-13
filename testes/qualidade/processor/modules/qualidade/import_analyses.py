from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree


OPERATION = "qualidade.importar_analises"
NULL_TOKENS = {"", "--", "NULL", "N/A", "-"}
DECIMAL_NULL_TOKENS = NULL_TOKENS | {"0,0"}

METRIC_FIELDS = [
    "gordura",
    "proteina",
    "lactose",
    "solidos_totais",
    "caseina",
    "sng",
    "ureia",
    "temperatura",
]

FIELD_ALIASES = {
    "CODIGO": "produtor_codigo",
    "CODIGO PRODUTOR": "produtor_codigo",
    "IDPROD": "produtor_codigo",
    "IDPRODUTOR": "produtor_codigo",
    "PRODUTOR": "produtor_codigo",
    "ANALISE": "data_analise",
    "DATA": "data_analise",
    "DATA ANALISE": "data_analise",
    "COLETA": "data_coleta",
    "DATA COLETA": "data_coleta",
    "GORD": "gordura",
    "GORDURA": "gordura",
    "%GORDURA": "gordura",
    "PROT": "proteina",
    "PROTEINA": "proteina",
    "%PROTEINA": "proteina",
    "LACT": "lactose",
    "LACTOSE": "lactose",
    "%LACTOSE": "lactose",
    "SOL": "solidos_totais",
    "SOLIDOS": "solidos_totais",
    "SOLIDOS TOTAIS": "solidos_totais",
    "%SOL": "solidos_totais",
    "CCS": "ccs",
    "UFC": "ufc",
    "CASE": "caseina",
    "CASEINA": "caseina",
    "%CASEINA": "caseina",
    "SNG": "sng",
    "SNF": "sng",
    "UREI": "ureia",
    "UREIA": "ureia",
    "ATB": "antibiotico",
    "ANTIBIOTICO": "antibiotico",
    "INIBIDOR": "antibiotico",
    "BCL": "bacteria",
    "BACTERIA": "bacteria",
    "TEMPERATURA": "temperatura",
    "TEMP": "temperatura",
    "T C": "temperatura",
    "T(C)": "temperatura",
}

PRODUCER_CODE_PRIORITY_HEADERS = {"IDPROD", "IDPRODUTOR"}


def normalize_header(value: Any) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.upper().strip()
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    return text


def is_blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def null_token(value: Any, decimal: bool = False) -> bool:
    token = normalize_header(value)
    return token in (DECIMAL_NULL_TOKENS if decimal else NULL_TOKENS)


def parse_int(value: Any) -> int | None:
    if null_token(value):
        return None
    text = str(value).strip()
    text = text.replace(".", "").replace(",", "")
    text = re.sub(r"[^0-9]", "", text)
    return int(text) if text else None


def parse_float(value: Any) -> float | None:
    if null_token(value, decimal=True):
        return None
    text = str(value).strip()
    text = text.replace(".", "").replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", ".", "-", "-."}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_flag_or_float(value: Any) -> float | None:
    if null_token(value):
        return None
    token = normalize_header(value)
    if token in {"POS", "POSITIVO", "+", "P"}:
        return 1.0
    if token in {"NEG", "NEGATIVO", "-", "N", "0"}:
        return 0.0
    return parse_float(value)


def excel_serial_to_date(value: float) -> str | None:
    if value < 20000 or value > 80000:
        return None
    base = date(1899, 12, 30)
    return (base + timedelta(days=int(value))).isoformat()


def parse_date(value: Any) -> str | None:
    if null_token(value):
        return None
    text = str(value).strip()
    normalized_number = text.replace(",", ".")
    if re.fullmatch(r"\d+(?:\.\d+)?", normalized_number):
        parsed = excel_serial_to_date(float(normalized_number))
        if parsed:
            return parsed
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date().isoformat()
        except ValueError:
            pass
    return None


def map_headers(headers: list[Any]) -> dict[str, list[int]]:
    mapped: dict[str, list[int]] = {}
    for index, header in enumerate(headers):
        key = normalize_header(header)
        field = FIELD_ALIASES.get(key)
        if not field:
            continue
        mapped.setdefault(field, [])
        if field == "produtor_codigo" and key in PRODUCER_CODE_PRIORITY_HEADERS:
            mapped[field].insert(0, index)
            continue
        mapped[field].append(index)
    return mapped


def first_value(row: list[Any], indexes: Iterable[int]) -> Any:
    for index in indexes:
        if index >= len(row):
            continue
        value = row[index]
        if not is_blank(value):
            return value
    return None


def extract_record(row: list[Any], mapped: dict[str, list[int]], sheet: str, line: int) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    codigo_value = first_value(row, mapped.get("produtor_codigo", []))
    codigo = parse_int(codigo_value)
    data_value = first_value(row, mapped.get("data_analise", []))
    data = parse_date(data_value)
    if data is None:
        data_value = first_value(row, mapped.get("data_coleta", []))
        data = parse_date(data_value)

    if codigo is None or codigo <= 0:
        errors.append(row_error(sheet, line, "PRODUCER_411", "Código de produtor inválido.", {"value": codigo_value}))
    if data is None:
        errors.append(row_error(sheet, line, "ANALYSIS_510", "Data de analise inválida.", {"value": data_value}))
    if errors:
        return None, errors

    data_record: dict[str, Any] = {
        "produtor_codigo": codigo,
        "data": data,
    }
    for field in METRIC_FIELDS:
        data_record[field] = parse_float(first_value(row, mapped.get(field, [])))
    data_record["ccs"] = parse_int(first_value(row, mapped.get("ccs", [])))
    data_record["ufc"] = parse_int(first_value(row, mapped.get("ufc", [])))
    data_record["antibiotico"] = parse_flag_or_float(first_value(row, mapped.get("antibiotico", [])))
    data_record["bacteria"] = parse_flag_or_float(first_value(row, mapped.get("bacteria", [])))

    return {
        "source": {
            "sheet": sheet,
            "line": line,
        },
        "raw": {
            "produtor_codigo": codigo_value,
            "data_analise": first_value(row, mapped.get("data_analise", [])),
            "data_coleta": first_value(row, mapped.get("data_coleta", [])),
        },
        "data": data_record,
    }, []


def row_error(sheet: str, line: int, code: str, message: str, details: dict[str, Any]) -> dict[str, Any]:
    return {
        "sheet": sheet,
        "line": line,
        "code": code,
        "message": message,
        "details": details,
    }


def parse_rows(sheet: str, rows: list[list[Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if not rows:
        warnings.append({"sheet": sheet, "code": "IMPORT_312", "message": "Planilha vazia ou sem dados.", "details": {}})
        return records, errors, warnings

    headers = rows[0]
    mapped = map_headers(headers)
    has_analysis_fields = any(field in mapped for field in [
        "produtor_codigo",
        "data_analise",
        "data_coleta",
        "gordura",
        "proteina",
        "lactose",
        "solidos_totais",
        "ccs",
        "ufc",
        "caseina",
        "sng",
        "ureia",
        "antibiotico",
        "bacteria",
        "temperatura",
    ])
    if not has_analysis_fields:
        warnings.append({"sheet": sheet, "code": "IMPORT_315", "message": "Aba sem campos reconhecidos.", "details": {}})
        return records, errors, warnings
    if "produtor_codigo" not in mapped:
        errors.append({"sheet": sheet, "code": "IMPORT_313", "message": "Coluna obrigatória ausente.", "details": {"column": "IDPROD"}})
        return records, errors, warnings
    if "data_analise" not in mapped and "data_coleta" not in mapped:
        errors.append({"sheet": sheet, "code": "IMPORT_313", "message": "Coluna obrigatória ausente.", "details": {"column": "ANALISE/COLETA"}})
        return records, errors, warnings

    useful_rows = 0
    for offset, row in enumerate(rows[1:], start=2):
        if all(is_blank(value) for value in row):
            continue
        useful_rows += 1
        record, row_errors = extract_record(row, mapped, sheet, offset)
        records.extend([record] if record else [])
        errors.extend(row_errors)

    if useful_rows == 0:
        warnings.append({"sheet": sheet, "code": "IMPORT_315", "message": "Aba sem campos reconhecidos.", "details": {}})
    return records, errors, warnings


def read_xlsx(path: Path) -> dict[str, list[list[Any]]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive)
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        rels = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        sheets: dict[str, list[list[Any]]] = {}
        ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
        for sheet in workbook.findall("x:sheets/x:sheet", ns):
            name = sheet.attrib["name"]
            rel_id = sheet.attrib[f"{{{ns['r']}}}id"]
            target = rel_map[rel_id]
            entry = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
            sheets[name] = read_worksheet(archive, entry, shared_strings)
        return sheets


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    values: list[str] = []
    for item in root.findall("x:si", ns):
        values.append("".join(text.text or "" for text in item.findall(".//x:t", ns)))
    return values


def read_worksheet(archive: zipfile.ZipFile, entry: str, shared_strings: list[str]) -> list[list[Any]]:
    root = ElementTree.fromstring(archive.read(entry))
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows: list[list[Any]] = []
    for row in root.findall(".//x:sheetData/x:row", ns):
        values: dict[int, Any] = {}
        max_col = 0
        for cell in row.findall("x:c", ns):
            ref = cell.attrib.get("r", "")
            col = column_index(ref)
            max_col = max(max_col, col)
            values[col] = cell_value(cell, shared_strings, ns)
        rows.append([values.get(index) for index in range(1, max_col + 1)])
    return rows


def column_index(ref: str) -> int:
    letters = re.match(r"^[A-Z]+", ref)
    if not letters:
        return 1
    total = 0
    for char in letters.group(0):
        total = total * 26 + (ord(char) - ord("A") + 1)
    return total


def cell_value(cell: ElementTree.Element, shared_strings: list[str], ns: dict[str, str]) -> Any:
    value = cell.find("x:v", ns)
    if cell.attrib.get("t") == "s" and value is not None:
        return shared_strings[int(value.text or 0)]
    if cell.attrib.get("t") == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//x:t", ns))
    return value.text if value is not None else None


def read_csv(path: Path) -> dict[str, list[list[Any]]]:
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig", errors="replace")
    sample = text[:4096]
    delimiter = ";"
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=";,\t").delimiter
    except csv.Error:
        pass
    return {"CSV": list(csv.reader(text.splitlines(), delimiter=delimiter))}


def read_xls(path: Path) -> dict[str, list[list[Any]]]:
    try:
        import xlrd  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Dependência xlrd não instalada para leitura de XLS.") from exc
    workbook = xlrd.open_workbook(str(path))
    sheets: dict[str, list[list[Any]]] = {}
    for sheet in workbook.sheets():
        sheets[sheet.name] = [sheet.row_values(row_index) for row_index in range(sheet.nrows)]
    return sheets


def read_workbook(path: Path) -> dict[str, list[list[Any]]]:
    extension = path.suffix.lower()
    if extension == ".xlsx":
        return read_xlsx(path)
    if extension == ".xls":
        return read_xls(path)
    if extension == ".csv":
        return read_csv(path)
    raise ValueError("Formato de arquivo não suportado.")


def process_file(path: Path, filename: str | None = None, file_hash: str | None = None) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    try:
        sheets = read_workbook(path)
    except ValueError as exc:
        return response(False, [], [{"code": "IMPORT_311", "message": str(exc), "details": {"filename": filename or path.name}}], [], filename, file_hash)
    except Exception as exc:
        return response(False, [], [{"code": "PROCESSOR_710", "message": "Falha ao executar processador.", "details": {"error": str(exc)}}], [], filename, file_hash)

    for sheet, rows in sheets.items():
        sheet_records, sheet_errors, sheet_warnings = parse_rows(sheet, rows)
        records.extend(sheet_records)
        errors.extend(sheet_errors)
        warnings.extend(sheet_warnings)

    return response(len(records) > 0, records, errors, warnings, filename, file_hash)


def response(success: bool, records: list[dict[str, Any]], errors: list[dict[str, Any]], warnings: list[dict[str, Any]], filename: str | None, file_hash: str | None) -> dict[str, Any]:
    return {
        "success": success,
        "operation": OPERATION,
        "summary": {
            "total": len(records) + len(errors),
            "valid": len(records),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "records": records,
        "errors": errors,
        "warnings": warnings,
        "metadata": {
            "filename": filename,
            "file_hash": file_hash,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa analises laboratoriais do Santi'Lac.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--filename")
    parser.add_argument("--hash")
    args = parser.parse_args()

    result = process_file(Path(args.input), args.filename, args.hash)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())