import json
import sys
import tempfile
import unittest
import urllib.error
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

import collect_and_post as collector
import ensure_runtime_env
from fieldlogger_core import ChannelInfo, HistorySample


class RetryTests(unittest.TestCase):
    def test_retries_transient_network_error(self):
        with (
            patch.object(
                collector,
                "post_json",
                side_effect=[
                    urllib.error.URLError("rota indisponível"),
                    (201, '{"success":true}'),
                ],
            ) as post,
            patch.object(collector.time, "sleep", return_value=None),
            patch.object(collector.random, "uniform", return_value=0),
        ):
            result = collector.post_json_with_retry(
                "http://api.test/coletas",
                "token",
                {"samples": []},
                30,
                attempts=2,
                base_delay=1,
            )

        self.assertEqual((201, '{"success":true}'), result)
        self.assertEqual(2, post.call_count)


class CatchUpLedgerTests(unittest.TestCase):
    def test_failed_gap_is_retried_even_after_later_remote_watermark(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            collector.write_state(
                state_path,
                date(2026, 7, 20),
                "pasteurizador",
                completed_dates={date(2026, 7, 20)},
                failed_dates={date(2026, 7, 17)},
            )

            pending = collector.catch_up_dates(
                state_path,
                target_date=date(2026, 7, 21),
                lookback_days=14,
                authoritative_last_date=date(2026, 7, 20),
            )

        self.assertEqual([date(2026, 7, 17), date(2026, 7, 21)], pending)

    def test_remote_daily_coverage_does_not_mask_a_gap(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            pending = collector.catch_up_dates(
                state_path,
                target_date=date(2026, 7, 20),
                lookback_days=5,
                authoritative_last_date=date(2026, 7, 20),
                authoritative_covered_dates={
                    date(2026, 7, 16),
                    date(2026, 7, 18),
                    date(2026, 7, 20),
                },
            )

        self.assertEqual([date(2026, 7, 17)], pending)

    def test_remote_series_start_does_not_create_predeployment_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            covered = {
                current
                for current in collector.production_dates(
                    date(2026, 5, 26),
                    date(2026, 7, 16),
                )
            }

            pending = collector.catch_up_dates(
                state_path,
                target_date=date(2026, 7, 18),
                lookback_days=90,
                authoritative_covered_dates=covered,
            )

        self.assertEqual(
            [date(2026, 7, 17), date(2026, 7, 18)],
            pending,
        )

    def test_empty_coverage_revalidates_only_legacy_watermark_forward(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            pending = collector.catch_up_dates(
                state_path,
                target_date=date(2026, 7, 20),
                lookback_days=90,
                authoritative_last_date=date(2026, 7, 16),
                authoritative_covered_dates=set(),
                authoritative_series_start_date=date(2026, 5, 26),
            )

        self.assertEqual(
            [
                date(2026, 7, 16),
                date(2026, 7, 17),
                date(2026, 7, 18),
                date(2026, 7, 20),
            ],
            pending,
        )

    def test_sync_state_parses_explicit_series_start_anchor(self):
        response = json.dumps({
            "data": {
                "last_sample_date": "2026-07-16",
                "series_start_date": "2026-05-26",
                "covered_dates": [],
            },
        })
        with patch.object(
            collector,
            "get_json",
            return_value=(200, response),
        ):
            state = collector.fetch_remote_sync_state(
                "http://api.test/api/pasteurizador/coletas",
                "token",
                30,
            )

        self.assertEqual(date(2026, 5, 26), state["series_start_date"])
        self.assertEqual(date(2026, 7, 16), state["last_sample_date"])
        self.assertEqual(set(), state["covered_dates"])

    def test_sync_state_retries_with_short_independent_timeout(self):
        response = json.dumps({
            "data": {
                "last_sample_date": "2026-07-16",
                "covered_dates": ["2026-07-16"],
            },
        })
        with (
            patch.object(
                collector,
                "get_json",
                side_effect=[
                    urllib.error.URLError("timeout"),
                    (200, response),
                ],
            ) as get_json,
            patch.object(collector.time, "sleep", return_value=None) as sleep,
        ):
            state = collector.fetch_remote_sync_state(
                "http://api.test/api/pasteurizador/coletas",
                "token",
                45,
                attempts=3,
                retry_delay_seconds=2,
            )

        self.assertEqual(date(2026, 7, 16), state["last_sample_date"])
        self.assertEqual(2, get_json.call_count)
        self.assertEqual(45, get_json.call_args_list[0].args[2])
        sleep.assert_called_once_with(2.0)


class OpenPeriodTests(unittest.TestCase):
    def test_open_period_uses_equipment_timezone(self):
        now_utc = datetime(2026, 7, 29, 1, 0, tzinfo=timezone.utc)

        with patch.object(
            collector,
            "ZoneInfo",
            return_value=timezone(timedelta(hours=-3)),
        ):
            self.assertTrue(
                collector.is_open_period(
                    datetime(2026, 7, 28, 23, 59, 59),
                    "America/Sao_Paulo",
                    now=now_utc,
                )
            )
            self.assertFalse(
                collector.is_open_period(
                    datetime(2026, 7, 27, 23, 59, 59),
                    "America/Sao_Paulo",
                    now=now_utc,
                )
            )

    def test_process_period_does_not_queue_or_post_an_open_day(self):
        future_date = datetime.now().date() + timedelta(days=1)
        period_start, period_end = collector.day_range(future_date)
        channels = [ChannelInfo(name="Temp.Pasteuriza", unit="C")]
        samples = [
            HistorySample(
                sample_index=1,
                raw_offset=420,
                timestamp=period_start,
                values={"Temp.Pasteuriza": 72.5},
            )
        ]
        result = {
            "remote_file": "2:/24085425/MemFlash.fl",
            "downloaded_at": datetime.now().isoformat(timespec="seconds"),
            "data": b"snapshot",
        }
        env = {
            "equipment": "pasteurizador",
            "api_url": "http://api.test/coletas",
            "post_empty_periods": True,
        }

        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "raw" / "snapshot.fl"
            with (
                patch.object(collector, "ZoneInfo", return_value=timezone.utc),
                patch.object(collector, "queue_payload") as queue_payload,
                patch.object(collector, "deliver_pending_payload") as deliver_payload,
            ):
                outcome = collector.process_period(
                    result,
                    samples,
                    channels,
                    raw_path,
                    env,
                    period_start,
                    period_end,
                    "UTC",
                )

        self.assertEqual(collector.PERIOD_PENDING, outcome)
        queue_payload.assert_not_called()
        deliver_payload.assert_not_called()


class DurableOutboxTests(unittest.TestCase):
    def runtime_env(self):
        return {
            "api_url": "http://api.test/coletas",
            "api_token": "token",
            "timezone": "UTC",
            "http_timeout": 30,
            "post_retry_attempts": 2,
            "post_retry_base_delay": 0,
            "post_retry_max_delay": 0,
            "sent_payload_retention": 5,
            "post_interval": 0,
        }

    def replayable_payload(self):
        return {
            "ingestion_key": "abc",
            "period_start": "2026-07-17 00:00:00",
            "period_end": "2026-07-17 23:59:59",
            "downloaded_at": "2026-07-18 04:00:00",
            "status": "processada",
            "samples": [{"value": 1}],
        }

    def test_failed_delivery_keeps_payload_for_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(
                tmp,
                {"ingestion_key": "abc", "samples": [{"value": 1}]},
            )
            with patch.object(
                collector,
                "post_json_with_retry",
                side_effect=urllib.error.URLError("offline"),
            ):
                with self.assertRaises(urllib.error.URLError):
                    collector.deliver_pending_payload(
                        pending,
                        self.runtime_env(),
                    )

            self.assertTrue(pending.exists())

    def test_replay_reports_failure_and_keeps_queue_visible(self):
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(
                tmp,
                self.replayable_payload(),
            )
            with patch.object(
                collector,
                "deliver_pending_payload",
                side_effect=urllib.error.URLError("offline"),
            ), patch.object(
                collector,
                "ZoneInfo",
                return_value=timezone.utc,
            ):
                posted, failed = collector.replay_pending_payloads(
                    tmp,
                    self.runtime_env(),
                )

            self.assertEqual((0, 1), (posted, failed))
            self.assertTrue(pending.exists())

    def test_replay_quarantines_snapshot_captured_before_period_closed(self):
        payload = self.replayable_payload()
        payload["downloaded_at"] = "2026-07-17 12:00:00"
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(tmp, payload)
            with (
                patch.object(collector, "ZoneInfo", return_value=timezone.utc),
                patch.object(collector, "deliver_pending_payload") as deliver,
            ):
                posted, failed = collector.replay_pending_payloads(
                    tmp,
                    self.runtime_env(),
                )

            rejected = list((Path(tmp) / "rejected").glob("*.rejected.json"))
            reasons = list((Path(tmp) / "rejected").glob("*.reason.json"))

        self.assertEqual((0, 0), (posted, failed))
        self.assertFalse(pending.exists())
        self.assertEqual(1, len(rejected))
        self.assertEqual(1, len(reasons))
        deliver.assert_not_called()

    def test_quarantined_payload_keeps_referenced_raw_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw_dir = root / "raw"
            raw_dir.mkdir()
            preserved_raw = raw_dir / "pasteurizador_memflash_preserved.fl"
            disposable_raw = raw_dir / "pasteurizador_memflash_disposable.fl"
            preserved_raw.write_bytes(b"preserve")
            disposable_raw.write_bytes(b"discard")
            payload = self.replayable_payload()
            payload["raw_file_path"] = str(preserved_raw)
            payload["downloaded_at"] = "2026-07-17 12:00:00"
            pending = collector.queue_payload(root, payload)
            collector.quarantine_pending_payload(pending, "teste")

            collector.prune_raw_snapshots(root, retention=0)

            self.assertTrue(preserved_raw.exists())
            self.assertFalse(disposable_raw.exists())

    def test_replay_quarantines_legacy_payload_without_period(self):
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(
                tmp,
                {"ingestion_key": "legacy", "samples": [{"value": 1}]},
            )
            with patch.object(collector, "deliver_pending_payload") as deliver:
                posted, failed = collector.replay_pending_payloads(
                    tmp,
                    self.runtime_env(),
                )

            rejected = list((Path(tmp) / "rejected").glob("*.rejected.json"))

        self.assertEqual((0, 0), (posted, failed))
        self.assertFalse(pending.exists())
        self.assertEqual(1, len(rejected))
        deliver.assert_not_called()

    def test_replay_quarantines_old_error_payload_even_with_samples(self):
        payload = self.replayable_payload()
        payload["status"] = "erro"
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(tmp, payload)
            with patch.object(collector, "deliver_pending_payload") as deliver:
                posted, failed = collector.replay_pending_payloads(
                    tmp,
                    self.runtime_env(),
                )

            rejected = list((Path(tmp) / "rejected").glob("*.rejected.json"))

        self.assertEqual((0, 0), (posted, failed))
        self.assertFalse(pending.exists())
        self.assertEqual(1, len(rejected))
        deliver.assert_not_called()

    def test_replay_defers_current_or_future_period(self):
        payload = self.replayable_payload()
        future = datetime.now().date() + timedelta(days=1)
        period_start, period_end = collector.day_range(future)
        payload["period_start"] = period_start.strftime("%Y-%m-%d %H:%M:%S")
        payload["period_end"] = period_end.strftime("%Y-%m-%d %H:%M:%S")
        payload["downloaded_at"] = (
            period_end + timedelta(seconds=1)
        ).strftime("%Y-%m-%d %H:%M:%S")
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(tmp, payload)
            with (
                patch.object(collector, "ZoneInfo", return_value=timezone.utc),
                patch.object(collector, "deliver_pending_payload") as deliver,
            ):
                posted, failed = collector.replay_pending_payloads(
                    tmp,
                    self.runtime_env(),
                )

            self.assertTrue(pending.exists())
            self.assertEqual([], list((Path(tmp) / "rejected").glob("*")))

        self.assertEqual((0, 0), (posted, failed))
        deliver.assert_not_called()

    def test_successful_delivery_archives_payload_atomically(self):
        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(
                tmp,
                {"ingestion_key": "abc", "samples": [{"value": 1}]},
            )
            with patch.object(
                collector,
                "post_json_with_retry",
                return_value=(201, '{"success":true}'),
            ):
                collector.deliver_pending_payload(
                    pending,
                    self.runtime_env(),
                )

            self.assertFalse(pending.exists())
            self.assertEqual(
                1,
                len(list((Path(tmp) / "sent").glob("*.sent.json"))),
            )

    def test_queue_preserves_more_complete_pending_payload(self):
        richer = self.replayable_payload()
        richer["samples_count"] = 2
        richer["samples"] = [
            {
                "timestamp_record": "2026-07-17 08:00:00",
                "channel": "Temp.Pasteuriza",
                "value": 72.0,
            },
            {
                "timestamp_record": "2026-07-17 08:01:00",
                "channel": "Temp.Pasteuriza",
                "value": 73.0,
            },
        ]
        regressed = {**richer}
        regressed["samples_count"] = 1
        regressed["samples"] = richer["samples"][1:]

        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(tmp, richer)
            collector.queue_payload(tmp, regressed)
            stored = json.loads(pending.read_text(encoding="utf-8"))

        self.assertEqual(2, stored["samples_count"])
        self.assertEqual(2, len(stored["samples"]))

    def test_queue_merges_complementary_pending_payloads_without_loss(self):
        first = self.replayable_payload()
        first.update({
            "samples_count": 1,
            "raw_file_path": "/tmp/first.fl",
            "samples": [{
                "timestamp_record": "2026-07-17 08:00:00",
                "channel": "Temp.Pasteuriza",
                "value": 72.0,
            }],
        })
        second = {**first}
        second.update({
            "raw_file_path": "/tmp/second.fl",
            "samples": [{
                "timestamp_record": "2026-07-17 08:01:00",
                "channel": "Temp.Pasteuriza",
                "value": 73.0,
            }],
        })

        with tempfile.TemporaryDirectory() as tmp:
            pending = collector.queue_payload(tmp, first)
            collector.queue_payload(tmp, second)
            stored = json.loads(pending.read_text(encoding="utf-8"))

        self.assertEqual(2, stored["samples_count"])
        self.assertEqual(2, len(stored["samples"]))
        self.assertEqual(
            ["/tmp/first.fl", "/tmp/second.fl"],
            stored["raw_file_paths"],
        )


class PeriodCoverageTests(unittest.TestCase):
    def sample(self, timestamp, value=72.5):
        return HistorySample(
            sample_index=1,
            raw_offset=420,
            timestamp=timestamp,
            values={"Temp.Pasteuriza": value},
        )

    def test_accepts_small_boundary_delay_within_tolerance(self):
        start, end = collector.day_range(date(2026, 7, 17))
        samples = [
            self.sample(start + timedelta(seconds=44), value=30.0),
            self.sample(end - timedelta(minutes=2), value=28.0),
        ]

        status, error = collector.resolve_period_status(samples, start, end)

        self.assertEqual("processada", status)
        self.assertIsNone(error)

    def test_rejects_history_missing_start_beyond_tolerance(self):
        start, end = collector.day_range(date(2026, 7, 17))
        samples = [
            self.sample(start + timedelta(minutes=11)),
            self.sample(end),
        ]

        status, error = collector.resolve_period_status(samples, start, end)

        self.assertEqual("erro", status)
        self.assertIn("início integral", error)

    def test_rejects_history_missing_end_beyond_tolerance(self):
        start, end = collector.day_range(date(2026, 7, 17))
        samples = [
            self.sample(start),
            self.sample(end - timedelta(minutes=11)),
        ]

        status, error = collector.resolve_period_status(samples, start, end)

        self.assertEqual("erro", status)
        self.assertIn("fim integral", error)

    def test_rejects_closed_period_without_samples_even_when_file_spans_it(self):
        start, end = collector.day_range(date(2026, 8, 8))
        all_samples = [
            self.sample(start - timedelta(hours=8)),
            self.sample(end + timedelta(hours=8)),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[],
            require_period_samples=True,
            max_hot_gap_seconds=7 * 24 * 60 * 60,
        )

        self.assertEqual("erro", status)
        self.assertIn("nenhuma amostra", error.lower())

    def test_explicit_empty_period_policy_remains_available(self):
        start, end = collector.day_range(date(2026, 8, 8))
        all_samples = [
            self.sample(start - timedelta(hours=8)),
            self.sample(end + timedelta(hours=8)),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[],
            require_period_samples=False,
            max_hot_gap_seconds=7 * 24 * 60 * 60,
        )

        self.assertEqual("processada", status)
        self.assertIsNone(error)

    def test_rejects_multiday_hole_that_overlaps_variable_working_hours(self):
        start, end = collector.day_range(date(2026, 8, 7))
        last_before_failure = self.sample(datetime(2026, 8, 7, 8, 20, 32))
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            last_before_failure,
            self.sample(datetime(2026, 8, 10, 12, 44, 51)),
            self.sample(end + timedelta(days=4)),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[last_before_failure],
            require_period_samples=True,
        )

        self.assertEqual("erro", status)
        self.assertIn("lacuna", error.lower())
        self.assertIn("2026-08-07 08:20:32", error)
        self.assertIn("2026-08-10 12:44:51", error)

    def test_accepts_variable_hours_and_a_normal_overnight_gap(self):
        start, end = collector.day_range(date(2026, 8, 7))
        day_sample = self.sample(datetime(2026, 8, 7, 11, 0, 0), value=32.0)
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=28.0),
            day_sample,
            self.sample(datetime(2026, 8, 8, 9, 0, 0), value=25.0),
            self.sample(end + timedelta(days=1), value=25.0),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[day_sample],
            require_period_samples=True,
        )

        self.assertEqual("processada", status)
        self.assertIsNone(error)

    def test_rejects_shorter_gap_when_logging_stops_during_pasteurization(self):
        start, end = collector.day_range(date(2026, 8, 7))
        hot_sample = self.sample(datetime(2026, 8, 7, 8, 20, 32), value=74.27)
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            hot_sample,
            self.sample(datetime(2026, 8, 8, 9, 0, 0), value=30.0),
            self.sample(end + timedelta(days=2), value=25.0),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[hot_sample],
            require_period_samples=True,
        )

        self.assertEqual("erro", status)
        self.assertIn("74.27", error)

    def test_accepts_long_shutdown_when_last_record_is_cool(self):
        start, end = collector.day_range(date(2026, 8, 7))
        cool_sample = self.sample(datetime(2026, 8, 7, 14, 0, 0), value=30.0)
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            cool_sample,
            self.sample(datetime(2026, 8, 10, 15, 0, 0), value=28.0),
            self.sample(end + timedelta(days=4), value=25.0),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[cool_sample],
            require_period_samples=True,
        )

        self.assertEqual("processada", status)
        self.assertIsNone(error)

    def test_rejects_period_without_valid_pasteurization_values(self):
        start, end = collector.day_range(date(2026, 8, 7))
        null_sample = self.sample(datetime(2026, 8, 7, 10, 0, 0), value=None)
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            null_sample,
            self.sample(end + timedelta(minutes=1), value=25.0),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[null_sample],
            require_period_samples=True,
        )

        self.assertEqual("erro", status)
        self.assertIn("Temp.Pasteuriza", error)

    def test_null_channel_record_does_not_hide_gap_after_hot_value(self):
        start, end = collector.day_range(date(2026, 8, 7))
        hot_sample = self.sample(datetime(2026, 8, 7, 8, 15, 0), value=74.0)
        null_sample = self.sample(datetime(2026, 8, 7, 8, 20, 0), value=None)
        resumed_sample = self.sample(datetime(2026, 8, 8, 9, 0, 0), value=30.0)
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            hot_sample,
            null_sample,
            resumed_sample,
            self.sample(end + timedelta(days=2), value=25.0),
        ]

        status, error = collector.resolve_period_status(
            all_samples,
            start,
            end,
            period_samples=[hot_sample, null_sample],
            require_period_samples=True,
        )

        self.assertEqual("erro", status)
        self.assertIn("74.00", error)
        self.assertIn("2026-08-07 08:15:00", error)

    def test_multi_day_partial_range_splits_and_preserves_edge_times(self):
        requested_start = datetime(2026, 7, 17, 8, 15, 0)
        requested_end = datetime(2026, 7, 20, 14, 45, 0)

        periods = [
            (
                target,
                *collector.daily_period_bounds(
                    requested_start,
                    requested_end,
                    target,
                ),
            )
            for target in collector.production_dates(
                requested_start.date(),
                requested_end.date(),
            )
        ]

        self.assertEqual(
            [
                (
                    date(2026, 7, 17),
                    datetime(2026, 7, 17, 8, 15, 0),
                    datetime(2026, 7, 17, 23, 59, 59),
                ),
                (
                    date(2026, 7, 18),
                    datetime(2026, 7, 18, 0, 0, 0),
                    datetime(2026, 7, 18, 23, 59, 59),
                ),
                (
                    date(2026, 7, 20),
                    datetime(2026, 7, 20, 0, 0, 0),
                    datetime(2026, 7, 20, 14, 45, 0),
                ),
            ],
            periods,
        )

    def test_partial_overlap_is_diagnostic_only_and_never_queued(self):
        start, end = collector.day_range(date(2026, 7, 17))
        samples = [
            self.sample(start + timedelta(hours=2)),
            self.sample(end),
        ]
        result = {
            "remote_file": "2:/24085425/MemFlash.fl",
            "downloaded_at": "2026-07-18T04:00:00",
            "data": b"snapshot",
        }
        env = {
            "equipment": "pasteurizador",
            "api_url": "http://api.test/coletas",
            "post_empty_periods": True,
        }

        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "raw" / "snapshot.fl"
            with (
                patch.object(collector, "ZoneInfo", return_value=timezone.utc),
                patch.object(collector, "queue_payload") as queue_payload,
                patch.object(collector, "deliver_pending_payload") as deliver,
            ):
                outcome = collector.process_period(
                    result,
                    samples,
                    [ChannelInfo(name="Temp.Pasteuriza", unit="C")],
                    raw_path,
                    env,
                    start,
                    end,
                    "UTC",
                )

            diagnostic_files = list(
                (Path(tmp) / "diagnostics").glob("*.json")
            )

        self.assertEqual(collector.PERIOD_PENDING, outcome)
        self.assertEqual(1, len(diagnostic_files))
        queue_payload.assert_not_called()
        deliver.assert_not_called()

    def test_process_period_does_not_queue_a_day_crossed_by_multiday_hole(self):
        start, end = collector.day_range(date(2026, 8, 7))
        period_sample = self.sample(datetime(2026, 8, 7, 8, 20, 32))
        all_samples = [
            self.sample(start - timedelta(minutes=1), value=25.0),
            period_sample,
            self.sample(datetime(2026, 8, 10, 12, 44, 51)),
            self.sample(end + timedelta(days=4)),
        ]
        result = {
            "remote_file": "2:/24085425/MemFlash.fl",
            "downloaded_at": "2026-08-11T16:00:00",
            "data": b"snapshot",
        }
        env = {
            "equipment": "pasteurizador",
            "api_url": "http://api.test/coletas",
            "post_empty_periods": True,
            "require_period_samples": True,
            "max_hot_gap_seconds": 10 * 60,
            "operating_temperature_threshold": 60.0,
        }

        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "raw" / "snapshot.fl"
            with (
                patch.object(collector, "ZoneInfo", return_value=timezone.utc),
                patch.object(collector, "queue_payload") as queue_payload,
                patch.object(collector, "deliver_pending_payload") as deliver,
            ):
                outcome = collector.process_period(
                    result,
                    all_samples,
                    [ChannelInfo(name="Temp.Pasteuriza", unit="C")],
                    raw_path,
                    env,
                    start,
                    end,
                    "UTC",
                )

        self.assertEqual(collector.PERIOD_PENDING, outcome)
        queue_payload.assert_not_called()
        deliver.assert_not_called()


class IdempotencyTests(unittest.TestCase):
    def test_ingestion_key_is_stable_when_raw_file_grows(self):
        channels = [ChannelInfo(name="Temp.Pasteuriza", unit="C")]
        samples = [
            HistorySample(
                sample_index=1,
                raw_offset=420,
                timestamp=datetime(2026, 7, 17, 8, 0, 0),
                values={"Temp.Pasteuriza": 72.5},
            )
        ]
        start = datetime(2026, 7, 17, 0, 0, 0)
        end = datetime(2026, 7, 17, 23, 59, 59)
        first = collector.build_payload(
            {
                "remote_file": "MemFlash.fl",
                "downloaded_at": "2026-07-18T04:00:00",
                "data": b"old",
            },
            samples,
            channels,
            "pasteurizador",
            Path("/tmp/old.fl"),
            start,
            end,
        )
        second = collector.build_payload(
            {
                "remote_file": "MemFlash.fl",
                "downloaded_at": "2026-07-18T05:00:00",
                "data": b"new-and-larger",
            },
            samples,
            channels,
            "pasteurizador",
            Path("/tmp/new.fl"),
            start,
            end,
        )

        self.assertEqual(first["ingestion_key"], second["ingestion_key"])
        self.assertNotEqual(first["raw_sha256"], second["raw_sha256"])


class RuntimeEnvMigrationTests(unittest.TestCase):
    def test_upgrades_limits_without_touching_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / "processor.env"
            env_path.write_text(
                "\n".join([
                    "SANTILAC_API_TOKEN=segredo",
                    "SANTILAC_API_URL=http://192.168.0.202/api/pasteurizador/coletas",
                    "FIELDLOGGER_HOST=192.168.0.101",
                    "FIELDLOGGER_MAX_BYTES=8000000",
                    "PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS=300",
                    "",
                ]),
                encoding="utf-8",
            )

            ensure_runtime_env.ensure_env(env_path, production=True)
            contents = env_path.read_text(encoding="utf-8")

        self.assertIn("SANTILAC_API_TOKEN=segredo", contents)
        self.assertIn(
            "SANTILAC_API_URL=http://192.168.5.202/api/pasteurizador/coletas",
            contents,
        )
        self.assertIn("FIELDLOGGER_HOST=192.168.5.101", contents)
        self.assertIn("FIELDLOGGER_MAX_BYTES=0", contents)
        self.assertIn(
            "PASTEURIZADOR_COLLECTION_TIMEOUT_SECONDS=10800",
            contents,
        )
        self.assertIn("SANTILAC_HTTP_TIMEOUT=10800", contents)
        self.assertIn("SANTILAC_SYNC_TIMEOUT_SECONDS=45", contents)
        self.assertIn("SANTILAC_SYNC_RETRY_ATTEMPTS=3", contents)
        self.assertIn("PASTEURIZADOR_REQUIRE_PERIOD_SAMPLES=1", contents)
        self.assertIn(
            "PASTEURIZADOR_MAX_HOT_GAP_SECONDS=600",
            contents,
        )
        self.assertIn("PASTEURIZADOR_OPERATING_TEMPERATURE_C=60", contents)

    def test_forces_the_single_production_ingestion_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / "processor.env"
            env_path.write_text(
                "\n".join([
                    "SANTILAC_API_URL=http://192.168.5.121/api/pasteurizador/coletas",
                    "FIELDLOGGER_HOST=192.168.0.101",
                    "",
                ]),
                encoding="utf-8",
            )

            ensure_runtime_env.ensure_env(env_path, production=True)
            contents = env_path.read_text(encoding="utf-8")

        self.assertIn(
            "SANTILAC_API_URL=http://192.168.5.202/api/pasteurizador/coletas",
            contents,
        )
        self.assertIn("FIELDLOGGER_HOST=192.168.5.101", contents)

    def test_imports_backend_api_key_without_exposing_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / "processor.env"
            token_path = Path(tmp) / "token"
            env_path.write_text("SANTILAC_API_TOKEN=antigo\n", encoding="utf-8")
            token_path.write_text(
                'SANTILAC_API_KEY="segredo-producao"\n',
                encoding="utf-8",
            )

            token = ensure_runtime_env._read_token_file(token_path)
            changed = ensure_runtime_env.ensure_env(
                env_path,
                api_token=token,
                production=True,
            )
            contents = env_path.read_text(encoding="utf-8")

        self.assertIn("SANTILAC_API_TOKEN=segredo-producao", contents)
        self.assertIn("SANTILAC_API_TOKEN", changed)
        self.assertNotIn("segredo-producao", changed)

    @unittest.skipIf(sys.platform == "win32", "permissoes POSIX indisponiveis")
    def test_persists_a_mode_600_recovery_token(self):
        with tempfile.TemporaryDirectory() as tmp:
            token_path = Path(tmp) / "api-token"
            ensure_runtime_env._persist_token_file(
                token_path,
                "segredo-producao",
            )

            contents = token_path.read_text(encoding="utf-8").strip()
            mode = token_path.stat().st_mode & 0o777

        self.assertEqual("segredo-producao", contents)
        self.assertEqual(0o600, mode)


class RuntimeCredentialRedundancyTests(unittest.TestCase):
    def test_direct_token_has_priority(self):
        with tempfile.TemporaryDirectory() as tmp:
            token_path = Path(tmp) / "api-token"
            token_path.write_text("backup\n", encoding="utf-8")

            token = collector.resolve_api_token({
                "SANTILAC_API_TOKEN": "primario",
                "SANTILAC_API_TOKEN_FILE": str(token_path),
            })

        self.assertEqual("primario", token)

    def test_uses_protected_backup_when_primary_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            token_path = Path(tmp) / "api-token"
            token_path.write_text("backup\n", encoding="utf-8")

            token = collector.resolve_api_token({
                "SANTILAC_API_TOKEN": "",
                "SANTILAC_API_TOKEN_FILE": str(token_path),
            })

        self.assertEqual("backup", token)


class SafeDefaultModeTests(unittest.TestCase):
    def test_cli_without_period_uses_catch_up_and_never_downloads_full_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {
                "OUTBOX_DIR": str(Path(tmp) / "outbox"),
                "PASTEURIZADOR_STATE_FILE": str(Path(tmp) / "state.json"),
            }
            with (
                patch.object(sys, "argv", ["collect_and_post.py"]),
                patch.dict(collector.os.environ, env, clear=True),
                patch.object(collector, "load_env", return_value={}),
                patch.object(collector, "replay_pending_payloads", return_value=(0, 0)),
                patch.object(collector, "fetch_remote_sync_state", return_value=None),
                patch.object(collector, "catch_up_dates", return_value=[]) as catch_up,
                patch.object(
                    collector,
                    "previous_production_day",
                    return_value=date(2026, 7, 28),
                ),
                patch.object(collector, "download_history_file") as download,
            ):
                exit_code = collector.main()

        self.assertEqual(0, exit_code)
        catch_up.assert_called_once()
        download.assert_not_called()

    def test_cli_rejects_one_sided_period_before_replay_or_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {
                "OUTBOX_DIR": str(Path(tmp) / "outbox"),
                "PASTEURIZADOR_STATE_FILE": str(Path(tmp) / "state.json"),
            }
            with (
                patch.object(
                    sys,
                    "argv",
                    ["collect_and_post.py", "--start", "2026-07-17 00:00:00"],
                ),
                patch.dict(collector.os.environ, env, clear=True),
                patch.object(collector, "load_env", return_value={}),
                patch.object(collector, "replay_pending_payloads") as replay,
                patch.object(collector, "download_history_file") as download,
            ):
                exit_code = collector.main()

        self.assertEqual(2, exit_code)
        replay.assert_not_called()
        download.assert_not_called()


if __name__ == "__main__":
    unittest.main()
