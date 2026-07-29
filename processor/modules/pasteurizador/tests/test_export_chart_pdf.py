import sys
import unittest
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

from export_chart_pdf import exact_series_statistics


class ExactSeriesStatisticsTests(unittest.TestCase):
    def test_uses_exact_metadata_instead_of_reduced_points(self):
        payload = {
            "series_meta": {
                "source_total": 1000,
                "returned": 2,
                "channels": [
                    {
                        "canal": "Temp.Pasteuriza",
                        "total": 1000,
                        "minimo": 60.0,
                        "maximo": 80.0,
                        "media": 72.25,
                    }
                ],
            }
        }
        grouped = {
            "Temp.Pasteuriza": [
                (1.0, 60.0, None),
                (2.0, 80.0, None),
            ]
        }

        statistics = exact_series_statistics(
            payload,
            grouped,
            ["Temp.Pasteuriza"],
        )

        self.assertEqual((72.25, 60.0, 80.0, 1000), statistics)

    def test_combines_exact_visible_channel_averages_by_sample_count(self):
        payload = {
            "series_meta": {
                "channels": [
                    {
                        "canal": "A",
                        "total": 3,
                        "minimo": 1,
                        "maximo": 5,
                        "media": 3,
                    },
                    {
                        "canal": "B",
                        "total": 1,
                        "minimo": 9,
                        "maximo": 9,
                        "media": 9,
                    },
                ]
            }
        }

        statistics = exact_series_statistics(payload, {}, ["A", "B"])

        self.assertEqual((4.5, 1.0, 9.0, 4), statistics)


if __name__ == "__main__":
    unittest.main()
