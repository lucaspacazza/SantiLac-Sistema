@echo off
setlocal
cd /d "%~dp0"
set EMBALAGEM_API_BASE=https://embalagem.santilac.com.br/api/embalagem
set ZEBRA_PRINTER_NAME=Zebra GC420t
set EMBALAGEM_LABEL_INTERVAL=10
set EMBALAGEM_LABEL_DRY_RUN=1
python embalagem_label_processor.py --once
