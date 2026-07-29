import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch


MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

import fieldlogger_core as core


def history_record(timestamp: datetime) -> bytes:
    record = bytearray(core.RECORD_STRIDE)
    record[4:8] = b"\x80\xff\x00\x00"
    date_word = (
        ((timestamp.year - 2008) << 10)
        | (timestamp.month << 6)
        | (timestamp.day * 2)
    )
    time_word = (
        (timestamp.hour << 12)
        | (timestamp.minute << 6)
        | timestamp.second
    )
    record[8:10] = date_word.to_bytes(2, "little")
    record[10:12] = time_word.to_bytes(2, "little")
    return bytes(record)


class FakeFieldLogger:
    def __init__(
        self,
        payload: bytes,
        transient_empty_offset: int | None = None,
        permanent_empty_offset: int | None = None,
        max_chunk_size: int | None = None,
    ):
        self.payload = payload
        self.transient_empty_offset = transient_empty_offset
        self.permanent_empty_offset = permanent_empty_offset
        self.max_chunk_size = max_chunk_size
        self.read_attempts: dict[int, int] = {}
        self.connect_calls = 0
        self.close_calls = 0

    def connect(self):
        self.connect_calls += 1

    def close(self):
        self.close_calls += 1

    def write_single(self, _address, _value):
        return None

    def write_path(self, _path):
        return None

    def read_file(self, offset, count):
        self.read_attempts[offset] = self.read_attempts.get(offset, 0) + 1
        if self.permanent_empty_offset == offset:
            return b""
        if (
            self.transient_empty_offset == offset
            and self.read_attempts[offset] == 1
        ):
            return b""
        if self.max_chunk_size is not None:
            count = min(count, self.max_chunk_size)
        return self.payload[offset : offset + count]


class ExtractHistorySamplesTests(unittest.TestCase):
    def test_keeps_legacy_record_alignment(self):
        expected = [
            datetime(2026, 7, 16, 12, 30, 0),
            datetime(2026, 7, 16, 12, 31, 0),
        ]
        payload = (
            bytes(core.RECORD_START)
            + history_record(expected[0])
            + history_record(expected[1])
        )

        samples, _channels = core.extract_history_samples(payload)

        self.assertEqual(expected, [sample.timestamp for sample in samples])
        self.assertEqual(
            [core.RECORD_START, core.RECORD_START + core.RECORD_STRIDE],
            [sample.raw_offset for sample in samples],
        )

    def test_realigns_after_fieldlogger_history_rotation(self):
        rotated_start = core.RECORD_START + 24
        expected = [
            datetime(2026, 7, 17, 8, 0, 0),
            datetime(2026, 7, 17, 8, 1, 0),
        ]
        payload = (
            bytes(rotated_start)
            + history_record(expected[0])
            + history_record(expected[1])
        )

        samples, _channels = core.extract_history_samples(payload)

        self.assertEqual(expected, [sample.timestamp for sample in samples])
        self.assertEqual(
            [rotated_start, rotated_start + core.RECORD_STRIDE],
            [sample.raw_offset for sample in samples],
        )

    def test_prefers_monotonic_record_run_over_false_legacy_markers(self):
        rotated_start = core.RECORD_START + 24
        expected = [
            datetime(2026, 7, 17, 8, 0, 0),
            datetime(2026, 7, 17, 8, 1, 0),
        ]
        payload = bytearray(
            bytes(rotated_start)
            + history_record(expected[0])
            + history_record(expected[1])
        )

        false_timestamps = [
            datetime(2026, 7, 20, 8, 0, 0),
            datetime(2026, 7, 19, 8, 0, 0),
        ]
        for index, timestamp in enumerate(false_timestamps):
            false_start = core.RECORD_START + (index * core.RECORD_STRIDE)
            payload[false_start : false_start + 12] = history_record(timestamp)[:12]

        samples, _channels = core.extract_history_samples(bytes(payload))

        self.assertEqual(expected, [sample.timestamp for sample in samples])
        self.assertEqual(
            [rotated_start, rotated_start + core.RECORD_STRIDE],
            [sample.raw_offset for sample in samples],
        )


class DownloadHistoryFileTests(unittest.TestCase):
    def run_download(self, link, payload):
        with (
            patch.object(core, "FieldLoggerModbus", return_value=link),
            patch.object(
                core,
                "list_history_file",
                return_value=("MemFlash.fl", len(payload)),
            ),
            patch.object(core.time, "sleep", return_value=None),
        ):
            return core.download_history_file(max_bytes=len(payload))

    def test_retries_same_offset_after_transient_empty_chunk(self):
        payload = bytes((index % 251 for index in range(3_000)))
        link = FakeFieldLogger(
            payload,
            transient_empty_offset=core.DOWNLOAD_CHUNK_SIZE,
        )

        result = self.run_download(link, payload)

        self.assertEqual(payload, result["data"])
        self.assertGreaterEqual(
            link.read_attempts[core.DOWNLOAD_CHUNK_SIZE],
            2,
        )

    def test_rejects_silently_truncated_download(self):
        payload = bytes((index % 251 for index in range(3_000)))
        link = FakeFieldLogger(
            payload,
            permanent_empty_offset=core.DOWNLOAD_CHUNK_SIZE,
        )

        with self.assertRaisesRegex(RuntimeError, "incompleto"):
            self.run_download(link, payload)

    def test_resumes_after_valid_short_non_empty_chunks_without_gaps(self):
        payload = bytes((index % 251 for index in range(3_000)))
        link = FakeFieldLogger(payload, max_chunk_size=317)

        result = self.run_download(link, payload)

        self.assertEqual(payload, result["data"])
        self.assertGreater(len(link.read_attempts), 3)


class FieldLoggerRequestTimeoutTests(unittest.TestCase):
    def test_history_chunk_uses_configured_socket_timeout(self):
        link = core.FieldLoggerModbus(timeout=30)

        with patch.object(
            link,
            "request",
            return_value=b"\x50\x00\x00",
        ) as request:
            link.read_file(0, 1)

        self.assertEqual(30, request.call_args.kwargs["timeout"])

    def test_rejects_modbus_body_shorter_than_declared_byte_count(self):
        link = core.FieldLoggerModbus(timeout=30)

        with patch.object(
            link,
            "request",
            return_value=b"\x50\x00\x05abc",
        ):
            with self.assertRaisesRegex(RuntimeError, "incompleto"):
                link.read_file(0, 5)


if __name__ == "__main__":
    unittest.main()
