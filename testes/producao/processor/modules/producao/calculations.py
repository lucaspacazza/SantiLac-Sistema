from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


POSITIVE_STOCK_TYPES = {"in", "adjustment", "return", "inventory_adjustment"}
NEGATIVE_STOCK_TYPES = {"out", "loss"}


def number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    return float(value)


def nullable_ratio(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 6)


def calculate_daily_production(payload: dict[str, Any]) -> dict[str, Any]:
    liters_processed = number(payload.get("liters_processed"))
    items = payload.get("items") or []
    if not isinstance(items, list):
        raise ValueError("items deve ser uma lista.")

    formatted_items: list[dict[str, Any]] = []
    total_weight = 0.0
    total_pieces = 0.0
    movement_totals: dict[int, dict[str, float]] = defaultdict(lambda: {"quantity_kg": 0.0, "quantity_pieces": 0.0})

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("cada item deve ser um objeto.")

        product_id = int(item.get("product_id") or 0)
        pieces_count = number(item.get("pieces_count"))
        weight_kg = number(item.get("weight_kg"))
        production_type = str(item.get("production_type") or "produced")

        total_weight += weight_kg
        total_pieces += pieces_count

        average_piece_weight = nullable_ratio(weight_kg, pieces_count)
        formatted_items.append({
            "item_id": item.get("id"),
            "product_id": product_id,
            "production_type": production_type,
            "pieces_count": round(pieces_count, 3),
            "weight_kg": round(weight_kg, 3),
            "average_piece_weight": average_piece_weight,
        })

        if product_id > 0 and weight_kg > 0:
            movement_totals[product_id]["quantity_kg"] += weight_kg
            movement_totals[product_id]["quantity_pieces"] += pieces_count

    total_weight = round(total_weight, 3)
    total_pieces = round(total_pieces, 3)

    stock_movements = [
        {
            "product_id": product_id,
            "movement_type": "in",
            "origin_type": "production",
            "quantity_kg": round(values["quantity_kg"], 3),
            "quantity_pieces": round(values["quantity_pieces"], 3),
        }
        for product_id, values in sorted(movement_totals.items())
    ]

    return {
        "success": True,
        "data": {
            "liters_processed": round(liters_processed, 3),
            "total_produced_kg": total_weight,
            "yield_liters_per_kg": nullable_ratio(liters_processed, total_weight),
            "yield_kg_per_liter": nullable_ratio(total_weight, liters_processed),
            "average_piece_weight": nullable_ratio(total_weight, total_pieces),
            "items": formatted_items,
            "stock_movements": stock_movements,
        },
        "errors": [],
    }


def calculate_stock_balance(payload: dict[str, Any]) -> dict[str, Any]:
    movements = payload.get("movements") or []
    if not isinstance(movements, list):
        raise ValueError("movements deve ser uma lista.")

    balances: dict[int, dict[str, float]] = defaultdict(lambda: {"balance_kg": 0.0, "balance_pieces": 0.0})

    for movement in movements:
        if not isinstance(movement, dict):
            raise ValueError("cada movimento deve ser um objeto.")

        product_id = int(movement.get("product_id") or 0)
        movement_type = str(movement.get("movement_type") or "")
        quantity_kg = number(movement.get("quantity_kg"))
        quantity_pieces = number(movement.get("quantity_pieces"))

        if product_id <= 0:
            continue

        if movement_type in POSITIVE_STOCK_TYPES:
            balances[product_id]["balance_kg"] += quantity_kg
            balances[product_id]["balance_pieces"] += quantity_pieces
        elif movement_type in NEGATIVE_STOCK_TYPES:
            balances[product_id]["balance_kg"] -= quantity_kg
            balances[product_id]["balance_pieces"] -= quantity_pieces

    items = [
        {
            "product_id": product_id,
            "balance_kg": round(values["balance_kg"], 3),
            "balance_pieces": round(values["balance_pieces"], 3),
        }
        for product_id, values in sorted(balances.items())
    ]

    return {
        "success": True,
        "data": {
            "items": items,
        },
        "errors": [],
    }


def read_payload(input_path: str) -> dict[str, Any]:
    if input_path == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(input_path).read_text(encoding="utf-8")
    payload = json.loads(raw or "{}")
    if not isinstance(payload, dict):
        raise ValueError("payload deve ser um objeto JSON.")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Calculos de Producao Industrial.")
    parser.add_argument("--function", choices=["daily-production", "stock-balance"], required=True)
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    try:
        payload = read_payload(args.input)
        if args.function == "daily-production":
            result = calculate_daily_production(payload)
        else:
            result = calculate_stock_balance(payload)
    except Exception as exc:
        result = {
            "success": False,
            "data": None,
            "errors": [{
                "code": "PRODUCAO_PROCESSOR_400",
                "message": str(exc),
                "details": {},
            }],
        }

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
