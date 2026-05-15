#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "work"
PROMPTS_DIR = ROOT / "prompts"
CONFIG_DIR = ROOT / "config"
DISPATCH_DIRNAME = "agents"

STAGE_PROMPTS = {
    "architect": "architect.md",
    "engineer": "engineer.md",
    "backend": "backend.md",
    "frontend": "frontend.md",
    "architect_review": "architect_review.md",
    "qa": "qa.md",
    "review": "review.md",
}

STAGE_REQUIRED = {
    "architect": ["00_user_request.md"],
    "engineer": ["00_user_request.md", "01_architect_brief.md"],
    "backend": ["03_backend_prompt.md"],
    "frontend": ["04_frontend_prompt.md"],
    "architect_review": ["06_backend_result.md", "07_frontend_result.md"],
    "qa": ["08_architect_dev_review.md"],
    "review": ["09_qa_result.md"],
}

TASK_FILES = [
    "00_user_request.md",
    "01_architect_brief.md",
    "02_engineer_plan.md",
    "03_backend_prompt.md",
    "04_frontend_prompt.md",
    "05_qa_prompt.md",
    "06_backend_result.md",
    "07_frontend_result.md",
    "08_architect_dev_review.md",
    "09_qa_result.md",
    "10_final_review.md",
]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:50] or "tarefa"


def next_task_id(title: str) -> str:
    date = datetime.now().strftime("%Y%m%d")
    existing = sorted(WORK_DIR.glob(f"task-{date}-*"))
    number = len(existing) + 1
    return f"task-{date}-{number:03d}-{slugify(title)}"


def title_from_markdown(path: Path) -> str:
    content = path.read_text(encoding="utf-8")
    for line in content.splitlines():
        line = line.lstrip("\ufeff")
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            return match.group(1).strip()
    return path.stem.replace("-", " ").replace("_", " ").strip().title()


def task_dir(task_id: str) -> Path:
    path = WORK_DIR / task_id
    if not path.exists():
        raise SystemExit(f"Tarefa nao encontrada: {task_id}")
    return path


def read_state(path: Path) -> dict[str, Any]:
    state_path = path / "state.json"
    if not state_path.exists():
        return {"task_id": path.name, "dispatches": []}
    return load_json(state_path)


def write_state(path: Path, state: dict[str, Any]) -> None:
    state["updated_at"] = datetime.now().isoformat(timespec="seconds")
    save_json(path / "state.json", state)


def non_empty(path: Path) -> bool:
    return path.exists() and path.read_text(encoding="utf-8", errors="ignore").strip() != ""


def render_prompt(stage: str, path: Path) -> Path:
    template_path = PROMPTS_DIR / STAGE_PROMPTS[stage]
    template = template_path.read_text(encoding="utf-8")
    rendered = template.format(
        root_dir=str(ROOT),
        task_dir=str(path),
    )
    dispatch_dir = path / DISPATCH_DIRNAME / stage
    dispatch_dir.mkdir(parents=True, exist_ok=True)
    prompt_file = dispatch_dir / "prompt.md"
    prompt_file.write_text(rendered, encoding="utf-8")
    return prompt_file


def ensure_required(stage: str, path: Path) -> None:
    missing = []
    for filename in STAGE_REQUIRED.get(stage, []):
        if not non_empty(path / filename):
            missing.append(filename)
    if missing:
        joined = ", ".join(missing)
        raise SystemExit(f"Nao da para despachar '{stage}'. Faltando: {joined}")


def run_tmux(session: str, command: str, dry_run: bool) -> None:
    tmux_command = ["tmux", "send-keys", "-t", session, command, "C-m"]
    if dry_run:
        print(" ".join(shlex.quote(part) for part in tmux_command))
        return
    completed = subprocess.run(tmux_command, check=False, text=True, capture_output=True)
    if completed.returncode != 0:
        raise SystemExit(completed.stderr.strip() or f"Falha ao enviar para tmux: {session}")


def dispatched(state: dict[str, Any], stage: str) -> bool:
    return any(item.get("stage") == stage for item in state.get("dispatches", []))


def dispatch_stage(task_id: str, stage: str, dry_run: bool) -> None:
    args = argparse.Namespace(task_id=task_id, stage=stage, dry_run=dry_run)
    cmd_dispatch(args)


def auto_step(task_id: str, dry_run: bool) -> bool:
    path = task_dir(task_id)
    state = read_state(path)

    if not dispatched(state, "architect"):
        dispatch_stage(task_id, "architect", dry_run)
        return True

    if non_empty(path / "01_architect_brief.md") and not dispatched(state, "engineer"):
        dispatch_stage(task_id, "engineer", dry_run)
        return True

    engineer_outputs_ready = all(
        non_empty(path / filename)
        for filename in ["02_engineer_plan.md", "03_backend_prompt.md", "04_frontend_prompt.md", "05_qa_prompt.md"]
    )
    moved = False
    if engineer_outputs_ready and not dispatched(state, "backend"):
        dispatch_stage(task_id, "backend", dry_run)
        moved = True
    state = read_state(path)
    if engineer_outputs_ready and not dispatched(state, "frontend"):
        dispatch_stage(task_id, "frontend", dry_run)
        moved = True
    if moved:
        return True

    dev_outputs_ready = non_empty(path / "06_backend_result.md") and non_empty(path / "07_frontend_result.md")
    state = read_state(path)
    if dev_outputs_ready and not dispatched(state, "architect_review"):
        dispatch_stage(task_id, "architect_review", dry_run)
        return True

    state = read_state(path)
    if non_empty(path / "08_architect_dev_review.md") and not dispatched(state, "qa"):
        dispatch_stage(task_id, "qa", dry_run)
        return True

    return False


def cmd_new(args: argparse.Namespace) -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    title = args.title.strip()
    task_id = next_task_id(title)
    path = WORK_DIR / task_id
    path.mkdir(parents=True)

    request = f"# Pedido Do Humano\n\n{title}\n"
    if args.body:
        request += f"\n## Detalhes\n\n{args.body.strip()}\n"
    (path / "00_user_request.md").write_text(request, encoding="utf-8")

    for filename in TASK_FILES[1:]:
        (path / filename).write_text("", encoding="utf-8")

    state = {
        "task_id": task_id,
        "title": title,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "dispatches": [],
    }
    write_state(path, state)
    print(task_id)
    print(path)


def cmd_new_md(args: argparse.Namespace) -> None:
    source = Path(args.markdown_file).resolve()
    if not source.exists():
        raise SystemExit(f"Arquivo Markdown nao encontrado: {source}")
    body = source.read_text(encoding="utf-8")
    title = args.title.strip() if args.title else title_from_markdown(source)
    cmd_new(argparse.Namespace(title=title, body=body))


def cmd_list(_: argparse.Namespace) -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    tasks = sorted([p for p in WORK_DIR.iterdir() if p.is_dir() and p.name.startswith("task-")])
    if not tasks:
        print("Nenhuma tarefa criada.")
        return
    for path in tasks:
        state = read_state(path)
        title = state.get("title", "")
        print(f"{path.name}  {title}")


def cmd_status(args: argparse.Namespace) -> None:
    path = task_dir(args.task_id)
    state = read_state(path)
    print(f"Tarefa: {path.name}")
    print(f"Titulo: {state.get('title', '')}")
    print()
    for filename in TASK_FILES:
        marker = "ok" if non_empty(path / filename) else "--"
        print(f"{marker}  {filename}")
    print()
    print("Dispatches:")
    for item in state.get("dispatches", []):
        print(f"- {item.get('at')} {item.get('stage')} -> {item.get('agent')}")


def cmd_dispatch(args: argparse.Namespace) -> None:
    agents = load_json(CONFIG_DIR / "agents.json")
    paths = load_json(CONFIG_DIR / "paths.json")
    stage = args.stage
    if stage not in agents:
        valid = ", ".join(agents)
        raise SystemExit(f"Stage invalido: {stage}. Validos: {valid}")

    path = task_dir(args.task_id)
    ensure_required(stage, path)
    prompt_file = render_prompt(stage, path)

    agent = agents[stage]
    command = agent["command"].format(
        project_dir=shlex.quote(paths["project_dir"]),
        prompt_file=shlex.quote(str(prompt_file)),
    )
    run_tmux(agent["tmux_session"], command, args.dry_run)

    state = read_state(path)
    state.setdefault("dispatches", []).append(
        {
            "at": datetime.now().isoformat(timespec="seconds"),
            "stage": stage,
            "agent": agent["label"],
            "tmux_session": agent["tmux_session"],
            "prompt_file": str(prompt_file),
        }
    )
    write_state(path, state)
    print(f"Despachado: {stage} -> {agent['label']}")
    print(f"Prompt: {prompt_file}")


def cmd_watch(args: argparse.Namespace) -> None:
    path = task_dir(args.task_id)
    print(f"Observando: {path.name}")
    while True:
        moved = auto_step(args.task_id, args.dry_run)
        if non_empty(path / "09_qa_result.md"):
            print("Fluxo concluido: 09_qa_result.md encontrado.")
            return
        if args.once:
            if not moved:
                print("Nenhuma etapa nova pronta para despacho.")
            return
        time.sleep(args.interval)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Orquestrador local do Agent Lab.")
    sub = parser.add_subparsers(dest="command", required=True)

    new = sub.add_parser("new", help="Criar nova tarefa.")
    new.add_argument("title")
    new.add_argument("--body", default="")
    new.set_defaults(func=cmd_new)

    new_md = sub.add_parser("new-md", help="Criar nova tarefa a partir de um Markdown.")
    new_md.add_argument("markdown_file")
    new_md.add_argument("--title", default="")
    new_md.set_defaults(func=cmd_new_md)

    list_cmd = sub.add_parser("list", help="Listar tarefas.")
    list_cmd.set_defaults(func=cmd_list)

    status = sub.add_parser("status", help="Mostrar status de uma tarefa.")
    status.add_argument("task_id")
    status.set_defaults(func=cmd_status)

    dispatch = sub.add_parser("dispatch", help="Enviar uma etapa para um agente via tmux.")
    dispatch.add_argument("task_id")
    dispatch.add_argument("stage", choices=sorted(STAGE_PROMPTS))
    dispatch.add_argument("--dry-run", action="store_true")
    dispatch.set_defaults(func=cmd_dispatch)

    watch = sub.add_parser("watch", help="Observar arquivos e despachar proximas etapas.")
    watch.add_argument("task_id")
    watch.add_argument("--interval", type=int, default=15)
    watch.add_argument("--once", action="store_true")
    watch.add_argument("--dry-run", action="store_true")
    watch.set_defaults(func=cmd_watch)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
