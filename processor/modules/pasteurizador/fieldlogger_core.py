import math
import socket
import struct
import time
from dataclasses import dataclass
from datetime import datetime


DEFAULT_HOST = "192.168.5.101"
DEFAULT_PORT = 502
DEFAULT_UNIT_ID = 1
REMOTE_HISTORY_DIR = "2:/24085425"
REMOTE_HISTORY_FILE = f"{REMOTE_HISTORY_DIR}/MemFlash.fl"
DOWNLOAD_CHUNK_SIZE = 1232
DOWNLOAD_PAUSE_EVERY_CHUNKS = 50
DOWNLOAD_PAUSE_SECONDS = 0.35
# Zero means "use the complete size advertised by the FieldLogger".  A
# positive value is only a safety ceiling and must never turn into a silent
# prefix download, otherwise the graph freezes forever at the cutoff point.
DEFAULT_MAX_BYTES = 0
DEFAULT_REQUEST_TIMEOUT_SECONDS = 30
DEFAULT_READ_RETRY_ATTEMPTS = 10
DEFAULT_READ_RETRY_DELAY_SECONDS = 1.0
DEFAULT_SNAPSHOT_SYNC_ATTEMPTS = 5
RECORD_START = 420
RECORD_STRIDE = 36
RECORD_MARKER = b"\x80\xff\x00\x00"


class IncompleteHistoryDownload(RuntimeError):
    pass


class HistoryFileTooLarge(RuntimeError):
    pass


class InvalidHistoryFile(RuntimeError):
    pass


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
                request_tid = self.tid
                pdu = bytes([function]) + payload
                packet = struct.pack(">HHHB", self.tid, 0, len(pdu) + 1, self.unit_id) + pdu
                if self.sock is not None:
                    sock = self.sock
                    sock.settimeout(timeout or self.timeout)
                    sock.sendall(packet)
                    header = self._recv_exact(sock, 7)
                    if len(header) != 7:
                        raise RuntimeError(f"Cabeçalho Modbus incompleto: {header.hex(' ')}")
                    response_tid, protocol_id, length, unit = struct.unpack(">HHHB", header)
                    body = self._recv_exact(sock, length - 1)
                else:
                    with socket.create_connection((self.host, self.port), timeout=timeout or self.timeout) as sock:
                        sock.settimeout(timeout or self.timeout)
                        sock.sendall(packet)
                        header = self._recv_exact(sock, 7)
                        if len(header) != 7:
                            raise RuntimeError(f"Cabeçalho Modbus incompleto: {header.hex(' ')}")
                        response_tid, protocol_id, length, unit = struct.unpack(">HHHB", header)
                        body = self._recv_exact(sock, length - 1)
                if response_tid != request_tid:
                    raise RuntimeError(
                        "Transaction id Modbus inesperado: "
                        f"esperado {request_tid}, recebido {response_tid}"
                    )
                if protocol_id != 0:
                    raise RuntimeError(f"Protocol id Modbus inesperado: {protocol_id}")
                if length < 2:
                    raise RuntimeError(f"Tamanho MBAP Modbus inválido: {length}")
                if len(body) != length - 1:
                    raise RuntimeError(
                        "Corpo Modbus incompleto: "
                        f"recebidos {len(body)} de {length - 1} bytes"
                    )
                if unit != self.unit_id:
                    raise RuntimeError(f"Unit id inesperado: {unit}")
                if not body:
                    raise RuntimeError("Resposta Modbus vazia")
                if body[0] & 0x80:
                    if len(body) < 2:
                        raise RuntimeError(
                            f"Exceção Modbus 0x{function:02X} incompleta"
                        )
                    raise RuntimeError(
                        f"Função 0x{function:02X} retornou exceção 0x{body[1]:02X}"
                    )
                if body[0] != function:
                    raise RuntimeError(
                        "Função Modbus inesperada: "
                        f"esperada 0x{function:02X}, recebida 0x{body[0]:02X}"
                    )
                return body
            except (OSError, TimeoutError, RuntimeError) as exc:
                last_error = exc
                if self.sock is not None:
                    self.close()
                    if attempt < 2:
                        try:
                            self.connect()
                        except (OSError, TimeoutError) as reconnect_error:
                            last_error = reconnect_error
                if attempt < 2:
                    time.sleep(0.25 * (attempt + 1))

        raise last_error

    def read_words(self, address, count):
        body = self.request(0x03, struct.pack(">HH", address, count))
        if len(body) < 2:
            raise RuntimeError("Resposta Modbus de registradores incompleta")
        byte_count = body[1]
        expected = count * 2
        raw = body[2:]
        if byte_count != expected or len(raw) != expected:
            raise RuntimeError(
                "Quantidade de registradores Modbus inesperada: "
                f"esperados {expected} bytes, declarados {byte_count}, recebidos {len(raw)}"
            )
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
        raise TimeoutError(f"Comando {value} não finalizou")

    def read_file(self, offset, count):
        body = self.request(
            0x50,
            struct.pack(">IH", offset, count),
            timeout=self.timeout,
        )
        if len(body) < 3:
            return b""
        byte_count = int.from_bytes(body[1:3], "big")
        payload = body[3:]
        if byte_count > count:
            raise RuntimeError(
                "Tamanho Modbus inesperado: "
                f"declarados {byte_count} bytes para leitura de {count}"
            )
        if len(payload) != byte_count:
            raise RuntimeError(
                "Corpo Modbus incompleto: "
                f"declarados {byte_count}, recebidos {len(payload)} bytes"
            )
        return payload


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
        raise RuntimeError(f"Equipamento não abriu o diretório {remote_dir}")
    if not link.command(2):
        raise RuntimeError(f"Equipamento não retornou arquivo no diretório {remote_dir}")
    words = link.read_words(0x05AB, 13)
    raw = _words_to_little_bytes(words)
    name = raw[:16].split(b"\x00", 1)[0].decode("ascii", errors="replace")
    # The directory entry text is word-swapped, but the file size is exposed as
    # two big-endian Modbus words. Reading it from the swapped byte string turns
    # sizes like 0x000CC9DC into nonsense such as 0x0C00DCC9, making the
    # downloader ignore the real end of MemFlash.fl.
    size_hint = ((words[8] & 0xFFFF) << 16) | (words[9] & 0xFFFF)
    return name, size_hint


def _reposition_history_file(link):
    try:
        link.write_single(0x035C, 3)
        link.write_path(REMOTE_HISTORY_FILE)
    except (OSError, TimeoutError, RuntimeError):
        link.close()
        link.connect()
        link.write_single(0x035C, 3)
        link.write_path(REMOTE_HISTORY_FILE)


def _read_history_chunk(
    link,
    offset,
    count,
    target_size,
    retry_attempts,
    retry_delay_seconds,
):
    last_error = None
    attempts = max(int(retry_attempts), 1)
    for attempt in range(attempts):
        try:
            chunk = link.read_file(offset, count)
            if chunk:
                return chunk[:count]
            last_error = RuntimeError("bloco vazio retornado pelo FieldLogger")
        except (OSError, TimeoutError, RuntimeError) as exc:
            last_error = exc

        if attempt >= attempts - 1:
            break

        _reposition_history_file(link)
        if retry_delay_seconds > 0:
            time.sleep(float(retry_delay_seconds) * (attempt + 1))

    raise IncompleteHistoryDownload(
        "Download incompleto do histórico do FieldLogger: "
        f"recebidos {offset} de {target_size} bytes; "
        f"falha no offset {offset}: {last_error}"
    )


def download_history_file(
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    unit_id=DEFAULT_UNIT_ID,
    max_bytes=DEFAULT_MAX_BYTES,
    request_timeout=DEFAULT_REQUEST_TIMEOUT_SECONDS,
    read_retry_attempts=DEFAULT_READ_RETRY_ATTEMPTS,
    read_retry_delay_seconds=DEFAULT_READ_RETRY_DELAY_SECONDS,
    snapshot_sync_attempts=DEFAULT_SNAPSHOT_SYNC_ATTEMPTS,
):
    max_bytes = int(max_bytes)
    snapshot_sync_attempts = max(int(snapshot_sync_attempts), 1)

    link = FieldLoggerModbus(host, port, unit_id, timeout=float(request_timeout))
    try:
        link.connect()
        link.write_single(0x035C, 3)
        name, size_hint = list_history_file(link)
        if name.lower() != "memflash.fl":
            raise RuntimeError(f"Arquivo interno inesperado: {name!r}")
        if size_hint < RECORD_START:
            raise InvalidHistoryFile(
                f"Tamanho inválido de {REMOTE_HISTORY_FILE}: {size_hint} bytes"
            )
        if max_bytes > 0 and size_hint > max_bytes:
            raise HistoryFileTooLarge(
                f"{REMOTE_HISTORY_FILE} possui {size_hint} bytes e excede "
                f"FIELDLOGGER_MAX_BYTES={max_bytes}; o download não será truncado."
            )
        link.write_path(REMOTE_HISTORY_FILE)
        data = bytearray()
        target_size = size_hint
        chunk_index = 0
        size_changed_during_download = False
        sync_attempt = 0
        while True:
            while len(data) < target_size:
                requested = min(DOWNLOAD_CHUNK_SIZE, target_size - len(data))
                chunk = _read_history_chunk(
                    link,
                    len(data),
                    requested,
                    target_size,
                    read_retry_attempts,
                    read_retry_delay_seconds,
                )
                data.extend(chunk)
                chunk_index += 1
                if DOWNLOAD_PAUSE_EVERY_CHUNKS > 0 and chunk_index % DOWNLOAD_PAUSE_EVERY_CHUNKS == 0:
                    time.sleep(DOWNLOAD_PAUSE_SECONDS)

            sync_attempt += 1
            latest_name, latest_size = list_history_file(link)
            if latest_name.lower() != "memflash.fl":
                raise RuntimeError(f"Arquivo interno inesperado: {latest_name!r}")
            if max_bytes > 0 and latest_size > max_bytes:
                raise HistoryFileTooLarge(
                    f"{REMOTE_HISTORY_FILE} cresceu para {latest_size} bytes e excede "
                    f"FIELDLOGGER_MAX_BYTES={max_bytes}; o download não será truncado."
                )
            if latest_size < len(data):
                raise IncompleteHistoryDownload(
                    "O histórico do FieldLogger rotacionou durante o download: "
                    f"tamanho inicial {size_hint}, baixados {len(data)}, tamanho atual {latest_size}."
                )
            if latest_size == len(data):
                break

            size_changed_during_download = True
            if sync_attempt >= snapshot_sync_attempts:
                raise IncompleteHistoryDownload(
                    "O histórico do FieldLogger continuou crescendo durante o download: "
                    f"baixados {len(data)} de {latest_size} bytes após "
                    f"{snapshot_sync_attempts} sincronizações."
                )
            target_size = latest_size
            link.write_path(REMOTE_HISTORY_FILE)

        if len(data) != target_size:
            raise IncompleteHistoryDownload(
                "Download incompleto do histórico do FieldLogger: "
                f"recebidos {len(data)} de {target_size} bytes."
            )
        return {
            "remote_file": REMOTE_HISTORY_FILE,
            "directory_size_hint": size_hint,
            "snapshot_size": target_size,
            "size_changed_during_download": size_changed_during_download,
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


def _record_run_score(run):
    longest_monotonic_run = 1
    current_monotonic_run = 1
    monotonic_transitions = 0

    for previous, current in zip(run, run[1:]):
        if current[1] >= previous[1]:
            monotonic_transitions += 1
            current_monotonic_run += 1
            longest_monotonic_run = max(
                longest_monotonic_run,
                current_monotonic_run,
            )
        else:
            current_monotonic_run = 1

    return (
        longest_monotonic_run,
        monotonic_transitions,
        len(run),
    )


def _best_record_run(candidates):
    runs = []
    current_run = []

    for candidate in candidates:
        if (
            current_run
            and candidate[0] != current_run[-1][0] + RECORD_STRIDE
        ):
            runs.append(current_run)
            current_run = []
        current_run.append(candidate)

    if current_run:
        runs.append(current_run)

    return max(runs, key=_record_run_score)


def locate_record_start(data):
    candidates_by_residue = {}
    marker_offset = data.find(RECORD_MARKER, RECORD_START + 4)
    while marker_offset >= 0:
        record_start = marker_offset - 4
        record_end = record_start + RECORD_STRIDE
        if record_start >= RECORD_START and record_end <= len(data):
            record = data[record_start:record_end]
            if not (int.from_bytes(record[8:10], "little") & 0x0001):
                try:
                    timestamp = _decode_record_timestamp(record)
                    residue = record_start % RECORD_STRIDE
                    candidates_by_residue.setdefault(residue, []).append(
                        (record_start, timestamp)
                    )
                except ValueError:
                    pass
        marker_offset = data.find(RECORD_MARKER, marker_offset + 1)

    if not candidates_by_residue:
        return RECORD_START

    legacy_residue = RECORD_START % RECORD_STRIDE
    scored_runs = [
        (
            _record_run_score(_best_record_run(candidates)),
            residue == legacy_residue,
            candidates[0][0],
        )
        for residue, candidates in candidates_by_residue.items()
    ]
    _score, _legacy, first_start = max(
        scored_runs,
        key=lambda item: (item[0], item[1]),
    )
    return first_start


def extract_history_samples(data):
    channels = extract_channels(data)
    value_offsets = range(12, 36, 4)
    samples = []
    record_start = locate_record_start(data)
    for offset in range(record_start, len(data) - RECORD_STRIDE + 1, RECORD_STRIDE):
        record = data[offset : offset + RECORD_STRIDE]
        if record[4:8] != RECORD_MARKER:
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
