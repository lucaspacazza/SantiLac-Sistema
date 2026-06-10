import math
import socket
import struct
import time
from dataclasses import dataclass
from datetime import datetime


DEFAULT_HOST = "192.168.0.101"
DEFAULT_PORT = 502
DEFAULT_UNIT_ID = 1
REMOTE_HISTORY_DIR = "2:/24085425"
REMOTE_HISTORY_FILE = f"{REMOTE_HISTORY_DIR}/MemFlash.fl"
DOWNLOAD_CHUNK_SIZE = 1232
RECORD_START = 420
RECORD_STRIDE = 36


@dataclass
class ChannelInfo:
    name: str
    unit: str


@dataclass
class HistorySample:
    sample_index: int
    raw_offset: int
    timestamp: datetime
    values: dict[str, float | None]


class FieldLoggerModbus:
    def __init__(self, host=DEFAULT_HOST, port=DEFAULT_PORT, unit_id=DEFAULT_UNIT_ID, timeout=5):
        self.host = host
        self.port = port
        self.unit_id = unit_id
        self.timeout = timeout
        self.tid = 1
        self.sock = None

    def connect(self):
        if self.sock is None:
            self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            self.sock.settimeout(self.timeout)

    def close(self):
        if self.sock is not None:
            try:
                self.sock.close()
            finally:
                self.sock = None

    def _recv_exact(self, sock, count):
        data = b""
        while len(data) < count:
            chunk = sock.recv(count - len(data))
            if not chunk:
                break
            data += chunk
        return data

    def request(self, function, payload, timeout=None):
        last_error = None
        for attempt in range(3):
            try:
                self.tid = (self.tid + 1) & 0xFFFF or 1
                pdu = bytes([function]) + payload
                packet = struct.pack(">HHHB", self.tid, 0, len(pdu) + 1, self.unit_id) + pdu
                if self.sock is not None:
                    sock = self.sock
                    sock.settimeout(timeout or self.timeout)
                    sock.sendall(packet)
                    header = self._recv_exact(sock, 7)
                    if len(header) != 7:
                        raise RuntimeError(f"Cabecalho Modbus incompleto: {header.hex(' ')}")
                    _, _, length, unit = struct.unpack(">HHHB", header)
                    body = self._recv_exact(sock, length - 1)
                else:
                    with socket.create_connection((self.host, self.port), timeout=timeout or self.timeout) as sock:
                        sock.settimeout(timeout or self.timeout)
                        sock.sendall(packet)
                        header = self._recv_exact(sock, 7)
                        if len(header) != 7:
                            raise RuntimeError(f"Cabecalho Modbus incompleto: {header.hex(' ')}")
                        _, _, length, unit = struct.unpack(">HHHB", header)
                        body = self._recv_exact(sock, length - 1)
                break
            except (OSError, TimeoutError) as exc:
                last_error = exc
                if self.sock is not None:
                    self.close()
                    self.connect()
                time.sleep(0.25 * (attempt + 1))
        else:
            raise last_error

        if unit != self.unit_id:
            raise RuntimeError(f"Unit id inesperado: {unit}")
        if not body:
            raise RuntimeError("Resposta Modbus vazia")
        if body[0] & 0x80:
            raise RuntimeError(f"Funcao 0x{function:02X} retornou excecao 0x{body[1]:02X}")
        return body

    def read_words(self, address, count):
        body = self.request(0x03, struct.pack(">HH", address, count))
        raw = body[2 : 2 + body[1]]
        return [int.from_bytes(raw[index : index + 2], "big") for index in range(0, len(raw), 2)]

    def write_single(self, address, value):
        self.request(0x06, struct.pack(">HH", address, value & 0xFFFF))

    def write_words(self, address, words):
        payload = struct.pack(">HHB", address, len(words), len(words) * 2)
        payload += b"".join(struct.pack(">H", word & 0xFFFF) for word in words)
        self.request(0x10, payload)

    def write_path(self, path):
        raw = (path.encode("ascii", errors="replace")[:33] + b"\x00").ljust(34, b"\x00")
        words = [(raw[index + 1] << 8) | raw[index] for index in range(0, 34, 2)]
        self.write_words(0x0597, words)

    def command(self, value):
        self.write_single(0x05E5, value)
        for _ in range(300):
            status = self.read_words(0x05E5, 1)[0]
            if status == 0:
                return True
            if status == 0xFFFF:
                return False
            time.sleep(0.05)
        raise TimeoutError(f"Comando {value} nao finalizou")

    def read_file(self, offset, count):
        body = self.request(0x50, struct.pack(">IH", offset, count), timeout=10)
        if len(body) < 3:
            return b""
        byte_count = int.from_bytes(body[1:3], "big")
        return body[3 : 3 + byte_count]


def _words_to_little_bytes(words):
    out = bytearray()
    for word in words:
        out.extend(word.to_bytes(2, "little"))
    return bytes(out)


def _decode_swapped_text(raw):
    out = bytearray()
    for index in range(0, len(raw), 2):
        pair = raw[index : index + 2]
        out.extend(pair[::-1] if len(pair) == 2 else pair)
    return out.split(b"\x00", 1)[0].decode("latin-1", errors="replace").strip()


def _normalize_channel_name(name):
    replacements = {
        "Vazăo": "Vazao",
        "Vazão": "Vazao",
        "Válvula Desvio": "Valvula Desvio",
    }
    return replacements.get(name, name)


def _normalize_unit(channel_name, unit):
    if channel_name.startswith("Temp."):
        return "C"
    if channel_name == "Vazao":
        return "m3/h"
    if channel_name in {"Bomba Leite", "Tan.Equilibrio", "Agua Quente", "Valvula Desvio"}:
        return "Status"
    return unit


def _read_word_swapped_float(raw):
    return struct.unpack("<f", raw[2:4] + raw[0:2])[0]


def _decode_record_timestamp(record):
    date_word = int.from_bytes(record[8:10], "little")
    time_word = int.from_bytes(record[10:12], "little")

    day = (date_word & 0x003E) // 2
    month = (date_word >> 6) & 0x0F
    year = 2008 + (date_word >> 10)

    second = time_word & 0x3F
    minute = (time_word >> 6) & 0x3F
    hour = (time_word >> 12) & 0x1F

    return datetime(year, month, day, hour, minute, second)


def list_history_file(link, remote_dir=REMOTE_HISTORY_DIR):
    link.write_path(remote_dir)
    if not link.command(1):
        raise RuntimeError(f"Equipamento nao abriu o diretorio {remote_dir}")
    if not link.command(2):
        raise RuntimeError(f"Equipamento nao retornou arquivo no diretorio {remote_dir}")
    words = link.read_words(0x05AB, 13)
    raw = _words_to_little_bytes(words)
    name = raw[:16].split(b"\x00", 1)[0].decode("ascii", errors="replace")
    size_hint = int.from_bytes(raw[16:20], "little", signed=False)
    return name, size_hint


def download_history_file(host=DEFAULT_HOST, port=DEFAULT_PORT, unit_id=DEFAULT_UNIT_ID, max_bytes=2_000_000):
    link = FieldLoggerModbus(host, port, unit_id)
    try:
        link.connect()
        link.write_single(0x035C, 3)
        size_hint = 0
        link.write_path(REMOTE_HISTORY_FILE)
        data = bytearray()
        # Keep one TCP session open while reading MemFlash.fl; the equipment
        # serves newer blocks only while the file context stays alive.
        target_size = max_bytes
        while len(data) < target_size:
            requested = min(DOWNLOAD_CHUNK_SIZE, target_size - len(data))
            chunk = b""
            for attempt in range(4):
                chunk = link.read_file(len(data), requested)
                if chunk:
                    break
                time.sleep(0.2 * (attempt + 1))
            if not chunk:
                break
            data.extend(chunk)
            if len(chunk) < requested:
                break
        return {
            "remote_file": REMOTE_HISTORY_FILE,
            "directory_size_hint": size_hint,
            "downloaded_at": datetime.now().isoformat(timespec="seconds"),
            "data": bytes(data),
        }
    finally:
        try:
            link.write_single(0x035C, 0)
        except Exception:
            pass
        link.close()


def extract_channels(data):
    channels = []
    for offset in range(228, 420, 28):
        name = _normalize_channel_name(_decode_swapped_text(data[offset : offset + 16]))
        unit = _normalize_unit(name, _decode_swapped_text(data[offset + 16 : offset + 24]))
        if name:
            channels.append(ChannelInfo(name=name, unit=unit))
    return channels


def extract_history_samples(data):
    channels = extract_channels(data)
    value_offsets = range(12, 36, 4)
    samples = []
    for offset in range(RECORD_START, len(data) - RECORD_STRIDE + 1, RECORD_STRIDE):
        record = data[offset : offset + RECORD_STRIDE]
        if record[4:8] != b"\x80\xff\x00\x00":
            continue
        if int.from_bytes(record[8:10], "little") & 0x0001:
            continue

        try:
            timestamp = _decode_record_timestamp(record)
        except ValueError:
            continue

        values = {}
        for channel, value_offset in zip(channels, value_offsets):
            value = _read_word_swapped_float(record[value_offset : value_offset + 4])
            if not math.isfinite(value) or value == -1.0:
                values[channel.name] = None
            else:
                values[channel.name] = value

        for channel in channels[len(values) :]:
            values[channel.name] = None

        samples.append(
            HistorySample(
                sample_index=len(samples) + 1,
                raw_offset=offset,
                timestamp=timestamp,
                values=values,
            )
        )

    samples.sort(key=lambda sample: (sample.timestamp, sample.raw_offset))
    return [
        HistorySample(
            sample_index=index,
            raw_offset=sample.raw_offset,
            timestamp=sample.timestamp,
            values=sample.values,
        )
        for index, sample in enumerate(samples, start=1)
    ], channels
