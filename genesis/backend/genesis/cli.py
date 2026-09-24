"""Command line: `python -m genesis.cli <command>` (or `genesis <command>` when installed).

serve              run the API server
chat               talk to Genesis in the terminal
schema             print the SQL schema
run-job NAME       run an automation job now (reindex, consolidate, reflect, journal, backup, ...)
backup             back up the database
"""

from __future__ import annotations

import argparse
import sys


def _services():
    from genesis.config import get_config
    from genesis.logging_setup import setup_logging
    from genesis.services import Services

    cfg = get_config()
    setup_logging("WARNING", as_json=False)
    svc = Services(cfg)
    svc.startup(start_scheduler=False)
    return svc


def cmd_serve(args: argparse.Namespace) -> None:
    import uvicorn

    from genesis.config import get_config

    cfg = get_config()
    uvicorn.run("genesis.main:app", host=args.host or cfg.host, port=args.port or cfg.port, reload=args.reload)


def cmd_chat(args: argparse.Namespace) -> None:
    svc = _services()
    greet = svc.conversation.greeting()
    conv_id = greet["conversation_id"]
    print(f"\nGenesis: {greet['reply']}\n(type /quit to leave, /mood for emotions, /memories to list what I remember)\n")
    while True:
        try:
            text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue
        if text in ("/quit", "/exit"):
            break
        if text == "/mood":
            with svc.db.session() as s:
                cur = svc.emotion.current(s)
            print("  " + ", ".join(f"{k} {round(v)}" for k, v in sorted(cur.items(), key=lambda kv: -kv[1])))
            continue
        if text == "/memories":
            with svc.db.session() as s:
                for m in svc.memory.recent(s, days=3650, limit=20):
                    print(f"  - [{m.memory_type}] {m.content}")
            continue
        resp = svc.conversation.chat(text, conv_id, learn=True)
        print(f"\nGenesis: {resp['reply']}\n")
    svc.shutdown()


def cmd_schema(args: argparse.Namespace) -> None:
    from sqlalchemy import create_mock_engine
    from sqlalchemy.schema import CreateIndex, CreateTable

    from genesis.db.models import Base

    engine = create_mock_engine("sqlite://", lambda *a, **k: None)
    out = ["-- Genesis SQLite schema (generated from genesis/db/models.py; do not edit by hand)", ""]
    for table in Base.metadata.sorted_tables:
        out.append(str(CreateTable(table).compile(engine)).strip() + ";")
        for idx in sorted(table.indexes, key=lambda i: i.name or ""):
            out.append(str(CreateIndex(idx).compile(engine)).strip() + ";")
        out.append("")
    sys.stdout.write("\n".join(out))


def cmd_run_job(args: argparse.Namespace) -> None:
    svc = _services()
    print(svc.scheduler.run(args.name))


def cmd_backup(args: argparse.Namespace) -> None:
    svc = _services()
    print(svc.scheduler.run("backup"))


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="genesis", description="Genesis: a local-first AI companion")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve", help="run the API server")
    s.add_argument("--host")
    s.add_argument("--port", type=int)
    s.add_argument("--reload", action="store_true")
    s.set_defaults(fn=cmd_serve)
    sub.add_parser("chat", help="chat in the terminal").set_defaults(fn=cmd_chat)
    sub.add_parser("schema", help="print the SQL schema").set_defaults(fn=cmd_schema)
    j = sub.add_parser("run-job", help="run an automation job now")
    j.add_argument("name")
    j.set_defaults(fn=cmd_run_job)
    sub.add_parser("backup", help="back up the database").set_defaults(fn=cmd_backup)
    args = p.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
