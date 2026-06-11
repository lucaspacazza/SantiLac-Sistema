from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


@dataclass(frozen=True)
class Config:
    api_base: str
    printer_name: str
    poll_interval: int
    dry_run: bool
    spool_dir: Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Processador de etiquetas de palete da embalagem.")
    parser.add_argument("--once", action="store_true", help="Executa uma consulta e encerra.")
    args = parser.parse_args()

    config = load_config()
    config.spool_dir.mkdir(parents=True, exist_ok=True)

    print(f"API: {config.api_base}")
    print(f"Impressora: {config.printer_name or 'auto'}")
    print(f"Dry-run: {'sim' if config.dry_run else 'nao'}")

    while True:
        try:
            process_pending(config)
        except Exception as exc:  # noqa: BLE001 - processor precisa seguir vivo.
            print(f"[erro] {exc}", file=sys.stderr)

        if args.once:
            break

        time.sleep(config.poll_interval)

    return 0


def load_config() -> Config:
    api_base = os.getenv("EMBALAGEM_API_BASE", "https://embalagem.santilac.com.br/api/embalagem").rstrip("/")
    printer_name = os.getenv("ZEBRA_PRINTER_NAME", "GC420t")
    poll_interval = int(os.getenv("EMBALAGEM_LABEL_INTERVAL", "10"))
    dry_run = os.getenv("EMBALAGEM_LABEL_DRY_RUN", "0").strip().lower() in {"1", "true", "sim", "yes"}
    spool_dir = Path(os.getenv("EMBALAGEM_LABEL_SPOOL", str(Path.cwd() / "spool")))

    return Config(
        api_base=api_base,
        printer_name=printer_name,
        poll_interval=max(3, poll_interval),
        dry_run=dry_run,
        spool_dir=spool_dir,
    )


def process_pending(config: Config) -> None:
    pending = api_get(config, "/etiquetas/pendentes")
    if not pending:
        print("sem etiquetas pendentes")
        return

    for pallet in pending:
        pallet_id = int(pallet["palete_id"])
        try:
            zpl = build_zpl(pallet)
            send_zpl(config, pallet_id, zpl)
            if config.dry_run:
                print(f"palete {pallet_id}: etiqueta gerada em modo teste")
            else:
                api_post(config, f"/paletes/{pallet_id}/etiqueta", {"impressa": True})
                print(f"palete {pallet_id}: etiqueta impressa")
        except Exception as exc:  # noqa: BLE001
            api_post(config, f"/paletes/{pallet_id}/etiqueta", {"impressa": False, "erro": str(exc)})
            print(f"palete {pallet_id}: falha ao imprimir: {exc}", file=sys.stderr)


def api_get(config: Config, path: str) -> Any:
    response = requests.get(config.api_base + path, timeout=20)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(payload.get("error", {}).get("message", "Falha na API."))
    return payload["data"]


def api_post(config: Config, path: str, data: dict[str, Any]) -> Any:
    response = requests.post(config.api_base + path, json=data, timeout=20)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(payload.get("error", {}).get("message", "Falha na API."))
    return payload["data"]


def build_zpl(pallet: dict[str, Any]) -> str:
    numero = zpl_text(f"PALETE {pallet['numero']}")
    queijo = zpl_text(str(pallet.get("queijo", ""))[:32])
    lote = zpl_text(str(pallet.get("lote", "")))
    fabricacao = zpl_text(str(pallet.get("data_fabricacao", "-")))
    validade = zpl_text(str(pallet.get("data_validade", "-")))
    caixas = zpl_text(str(pallet.get("caixas_total", "0")))
    peso = zpl_text(format_weight(float(pallet.get("peso_total", 0))))
    qr_url = str(pallet["qr_url"])

    return f"""^XA
^CI28
^PW640
^LL400
^LH0,0
^FO18,14^A0N,40,40^FD{numero}^FS
^FO18,60^A0N,27,27^FD{queijo}^FS
^FO18,94^GB350,2,2^FS
^FO18,116^A0N,25,25^FDLOTE:^FS
^FO128,116^A0N,25,25^FD{lote}^FS
^FO18,152^A0N,25,25^FDFAB.:^FS
^FO128,152^A0N,25,25^FD{fabricacao}^FS
^FO18,188^A0N,25,25^FDVAL.:^FS
^FO128,188^A0N,25,25^FD{validade}^FS
^FO18,224^A0N,25,25^FDCAIXAS:^FS
^FO128,224^A0N,25,25^FD{caixas}^FS
^FO18,260^A0N,25,25^FDPESO:^FS
^FO128,260^A0N,25,25^FD{peso} KG^FS
^FO18,306^GB350,2,2^FS
^FO18,326^A0N,23,23^FDESCANEIE O QR^FS
^FO392,30^BQN,2,5^FDLA,{qr_url}^FS
^XZ
"""


def send_zpl(config: Config, pallet_id: int, zpl: str) -> None:
    spool_file = config.spool_dir / f"palete_{pallet_id}.zpl"
    spool_file.write_text(zpl, encoding="utf-8")

    if config.dry_run:
        print(f"palete {pallet_id}: ZPL salvo em {spool_file}")
        return

    if os.name != "nt":
        raise RuntimeError(f"Impressao RAW so esta habilitada no Windows. ZPL salvo em {spool_file}")

    try:
        import win32print  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("Instale o pywin32 para imprimir na Zebra: pip install pywin32") from exc

    printer_name = find_printer(win32print, config.printer_name)
    handle = win32print.OpenPrinter(printer_name)
    try:
        job = win32print.StartDocPrinter(handle, 1, (f"Palete {pallet_id}", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, zpl.encode("utf-8"))
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
        print(f"palete {pallet_id}: job {job} enviado para {printer_name}")
    finally:
        win32print.ClosePrinter(handle)


def find_printer(win32print: Any, wanted: str) -> str:
    printers = [item[2] for item in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
    if wanted:
        wanted_lower = wanted.lower()
        for printer in printers:
            if wanted_lower in printer.lower():
                return printer

    for printer in printers:
        name = printer.lower()
        if "zebra" in name or "gc420" in name:
            return printer

    raise RuntimeError("Impressora Zebra nao encontrada. Configure ZEBRA_PRINTER_NAME.")


def format_weight(value: float) -> str:
    return f"{value:.3f}".replace(".", ",")


def zpl_text(value: str) -> str:
    return value.replace("^", "").replace("~", "").strip()


if __name__ == "__main__":
    raise SystemExit(main())
