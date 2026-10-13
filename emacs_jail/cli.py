"""Command Line Interface for Emacs-Jail framework."""

import argparse
import json
import sys
from pathlib import Path

from emacs_jail.archive import UserArchiveManager, validate_uid
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager
from emacs_jail.exceptions import EmacsJailError


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="emacs-jail",
        description="Firejail framework for isolated Emacs & Org-Mode execution with single-file zip environments.",
    )
    parser.add_argument("--storage-dir", help="Override path to zip storage directory.")
    parser.add_argument("--network", action="store_true", help="Allow network access inside sandbox.")
    parser.add_argument("--profile", help="Path to custom Firejail profile.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = subparsers.add_parser("init", help="Initialize a new virtual user environment.")
    p_init.add_argument("uid", help="Virtual user identifier.")

    # list-users
    subparsers.add_parser("list-users", help="List all registered virtual user environments.")

    # info
    p_info = subparsers.add_parser("info", help="Show user environment details and statistics.")
    p_info.add_argument("uid", help="Virtual user identifier.")

    # export
    p_export = subparsers.add_parser("export", help="Export an Org-mode document.")
    p_export.add_argument("uid", help="Virtual user identifier.")
    p_export.add_argument("file", help="Org file path inside user workspace.")
    p_export.add_argument("--format", "-f", default="html", choices=["html", "md", "txt", "latex", "org"], help="Export format.")
    p_export.add_argument("--output", "-o", help="Destination file name in workspace.")
    p_export.add_argument("--print", "-p", action="store_true", help="Print exported content to stdout.")

    # babel
    p_babel = subparsers.add_parser("babel", help="Execute Org-Babel code blocks or tangle source.")
    p_babel.add_argument("uid", help="Virtual user identifier.")
    p_babel.add_argument("file", help="Org file path inside user workspace.")
    p_babel.add_argument("--tangle", "-t", action="store_true", help="Tangle (extract) code blocks instead of executing.")
    p_babel.add_argument("--output", "-o", help="Output file name for executed document.")

    # agenda
    p_agenda = subparsers.add_parser("agenda", help="Extract agenda tasks, deadlines, and headlines.")
    p_agenda.add_argument("uid", help="Virtual user identifier.")
    p_agenda.add_argument("--files", help="Comma-separated list of .org files.")
    p_agenda.add_argument("--json", action="store_true", help="Output raw JSON.")

    # eval
    p_eval = subparsers.add_parser("eval", help="Evaluate an Emacs Lisp expression in the sandbox.")
    p_eval.add_argument("uid", help="Virtual user identifier.")
    p_eval.add_argument("expression", help="Elisp expression string.")
    p_eval.add_argument("--no-org", action="store_true", help="Do not preload Org-mode.")

    # file
    p_file = subparsers.add_parser("file", help="Manage files inside user's single-file zip archive.")
    file_subparsers = p_file.add_subparsers(dest="file_command", required=True)

    # file ls
    f_ls = file_subparsers.add_parser("ls", help="List files in user archive.")
    f_ls.add_argument("uid", help="Virtual user identifier.")

    # file put
    f_put = file_subparsers.add_parser("put", help="Upload a file into user archive.")
    f_put.add_argument("uid", help="Virtual user identifier.")
    f_put.add_argument("local_file", help="Local file path on host.")
    f_put.add_argument("target_path", nargs="?", help="Target path inside archive (default: workspace/<basename>).")

    # file get
    f_get = file_subparsers.add_parser("get", help="Download a file from user archive.")
    f_get.add_argument("uid", help="Virtual user identifier.")
    f_get.add_argument("remote_path", help="Path inside archive.")
    f_get.add_argument("dest_file", nargs="?", help="Local destination file (default: stdout or filename).")

    # file cat
    f_cat = file_subparsers.add_parser("cat", help="Print a file from user archive to stdout.")
    f_cat.add_argument("uid", help="Virtual user identifier.")
    f_cat.add_argument("remote_path", help="Path inside archive.")

    # file rm
    f_rm = file_subparsers.add_parser("rm", help="Delete a file from user archive.")
    f_rm.add_argument("uid", help="Virtual user identifier.")
    f_rm.add_argument("remote_path", help="Path inside archive.")

    # run (interactive or batch)
    p_run = subparsers.add_parser("run", help="Run Emacs inside Firejail sandbox for user UID.")
    p_run.add_argument("uid", help="Virtual user identifier.")
    p_run.add_argument("args", nargs=argparse.REMAINDER, help="Arguments passed to Emacs.")

    return parser


def main() -> int:
    parser = create_parser()
    args = parser.parse_args()

    config = JailConfig()
    if args.storage_dir:
        config.storage_dir = Path(args.storage_dir).resolve()
    if args.network:
        config.enable_network = True
    if args.profile:
        config.profile_path = Path(args.profile).resolve()

    mgr = UserArchiveManager(config)
    emacs = EmacsOrgManager(config)

    try:
        if args.command == "init":
            archive_path = mgr.create_initial_archive(args.uid)
            print(f"Initialized environment for UID '{args.uid}': {archive_path}")

        elif args.command == "list-users":
            users = mgr.list_users()
            if not users:
                print("No user environments found.")
                return 0
            print(f"{'UID':<20} {'SIZE':<12} {'UPDATED':<25}")
            print("-" * 60)
            for u in sorted(users, key=lambda x: x.get("uid", "")):
                size_kb = u.get("archive_size_bytes", 0) / 1024
                updated = u.get("updated_at", "N/A")[:19].replace("T", " ")
                print(f"{u.get('uid', 'unknown'):<20} {size_kb:>8.1f} KB  {updated:<25}")

        elif args.command == "info":
            info = mgr.get_metadata(args.uid)
            print(json.dumps(info, indent=2))

        elif args.command == "export":
            res = emacs.export(
                uid=args.uid,
                org_file=args.file,
                export_format=args.format,
                output_file=args.output,
                return_content=True,
            )
            print(f"Exported successfully to '{res.output_filename}' in {res.execution_time:.2f}s")
            if args.print and res.content:
                print("\n" + res.content)

        elif args.command == "babel":
            if args.tangle:
                b_res = emacs.babel_tangle(uid=args.uid, org_file=args.file)
                print(f"Tangled successfully: {', '.join(b_res.tangled_files) or 'No files tangled'}")
            else:
                b_res = emacs.babel_execute(uid=args.uid, org_file=args.file, output_file=args.output)
                print(f"Babel executed successfully on '{b_res.target_file}' in {b_res.execution_time:.2f}s")

        elif args.command == "agenda":
            files = [f.strip() for f in args.files.split(",")] if args.files else None
            items = emacs.get_agenda(uid=args.uid, files=files)
            if args.json:
                print(json.dumps(items, indent=2))
            else:
                if not items:
                    print("No headlines or tasks found.")
                    return 0
                print(f"{'TODO':<8} {'PRIO':<6} {'TITLE':<40} {'DEADLINE/SCHEDULE'}")
                print("-" * 75)
                for item in items:
                    todo = item.get("todo") or ""
                    prio = f"[{item.get('priority')}]" if item.get("priority") else ""
                    title = item.get("title", "")[:38]
                    date_info = item.get("scheduled") or item.get("deadline") or ""
                    print(f"{todo:<8} {prio:<6} {title:<40} {date_info}")

        elif args.command == "eval":
            out = emacs.eval_elisp(uid=args.uid, elisp_expr=args.expression, load_org=not args.no_org)
            print(out)

        elif args.command == "file":
            if args.file_command == "ls":
                files = mgr.list_files(args.uid)
                print(f"{'SIZE':<10} {'DATE':<20} {'FILENAME'}")
                print("-" * 65)
                for f in files:
                    size = f"{f['file_size']} B" if not f["is_dir"] else "<DIR>"
                    print(f"{size:<10} {f['date_time']:<20} {f['filename']}")

            elif args.file_command == "put":
                local_path = Path(args.local_file)
                if not local_path.is_file():
                    print(f"Error: Local file '{local_path}' does not exist.", file=sys.stderr)
                    return 1
                target = args.target_path or f"workspace/{local_path.name}"
                mgr.write_file(args.uid, target, local_path.read_bytes())
                print(f"Saved '{local_path.name}' -> '{target}' in archive for UID '{args.uid}'")

            elif args.file_command == "get":
                data = mgr.read_file(args.uid, args.remote_path)
                dest = args.dest_file or Path(args.remote_path).name
                Path(dest).write_bytes(data)
                print(f"Downloaded '{args.remote_path}' -> '{dest}'")

            elif args.file_command == "cat":
                data = mgr.read_file(args.uid, args.remote_path)
                sys.stdout.buffer.write(data)

            elif args.file_command == "rm":
                mgr.delete_file(args.uid, args.remote_path)
                print(f"Deleted '{args.remote_path}' from archive for UID '{args.uid}'")

        elif args.command == "run":
            emacs_args = args.args
            if emacs_args and emacs_args[0] == "--":
                emacs_args = emacs_args[1:]
            rc = emacs.interactive(args.uid, emacs_args=emacs_args)
            return rc

        return 0

    except EmacsJailError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
