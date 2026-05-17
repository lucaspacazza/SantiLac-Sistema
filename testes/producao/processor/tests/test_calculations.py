from __future__ import annotations

import sys
import unittest
from pathlib import Path


PROCESSOR_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROCESSOR_DIR))

from modules.producao import calculate_daily_production, calculate_stock_balance  # noqa: E402


class ProductionCalculationsTest(unittest.TestCase):
    def test_daily_production_handles_zero_division(self) -> None:
        result = calculate_daily_production({"liters_processed": 0, "items": []})

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total_produced_kg"], 0)
        self.assertIsNone(result["data"]["yield_liters_per_kg"])
        self.assertIsNone(result["data"]["yield_kg_per_liter"])
        self.assertIsNone(result["data"]["average_piece_weight"])

    def test_daily_production_calculates_yield_and_stock_suggestions(self) -> None:
        result = calculate_daily_production({
            "liters_processed": 1000,
            "items": [
                {"id": 1, "product_id": 1, "production_type": "produced", "pieces_count": 10, "weight_kg": 400},
                {"id": 2, "product_id": 1, "production_type": "packed", "pieces_count": 5, "weight_kg": 100},
            ],
        })

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total_produced_kg"], 500)
        self.assertEqual(result["data"]["yield_liters_per_kg"], 2)
        self.assertEqual(result["data"]["yield_kg_per_liter"], 0.5)
        self.assertEqual(result["data"]["average_piece_weight"], 33.333333)
        self.assertEqual(result["data"]["stock_movements"], [{
            "product_id": 1,
            "movement_type": "in",
            "origin_type": "production",
            "quantity_kg": 500,
            "quantity_pieces": 15,
        }])

    def test_stock_balance_uses_real_movements(self) -> None:
        result = calculate_stock_balance({
            "movements": [
                {"product_id": 1, "movement_type": "in", "quantity_kg": 10, "quantity_pieces": 2},
                {"product_id": 1, "movement_type": "loss", "quantity_kg": 1, "quantity_pieces": 0},
                {"product_id": 2, "movement_type": "return", "quantity_kg": 3, "quantity_pieces": 1},
            ],
        })

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["items"], [
            {"product_id": 1, "balance_kg": 9, "balance_pieces": 2},
            {"product_id": 2, "balance_kg": 3, "balance_pieces": 1},
        ])


if __name__ == "__main__":
    unittest.main()
