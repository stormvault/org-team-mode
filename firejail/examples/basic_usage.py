#!/usr/bin/env python3
"""Basic usage example for the Emacs-Jail framework."""

from emacs_jail.archive import UserArchiveManager
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager


def main():
    config = JailConfig()
    archive_mgr = UserArchiveManager(config)
    emacs = EmacsOrgManager(config)

    uid = "demo_user"
    print(f"1. Initializing isolated environment for non-system UID: '{uid}'...")
    archive_path = archive_mgr.create_initial_archive(uid)
    print(f"   Created single-file archive: {archive_path}")

    # Inspect files in archive
    print("\n2. Archive contents:")
    for f in archive_mgr.list_files(uid):
        print(f"   - {f['filename']} ({f['file_size']} bytes)")

    # Evaluate Emacs Lisp inside Firejail
    print("\n3. Evaluating Elisp inside Firejail sandbox:")
    org_ver = emacs.eval_elisp(uid, "(org-version)")
    print(f"   Org-mode version in sandbox: {org_ver}")

    # Export starter notes.org to HTML and Markdown
    print("\n4. Exporting Org document:")
    html_res = emacs.export(uid, "notes.org", export_format="html")
    print(f"   HTML exported to: {html_res.output_filename} in {html_res.execution_time:.2f}s")

    md_res = emacs.export(uid, "notes.org", export_format="md")
    print(f"   Markdown exported to: {md_res.output_filename} in {md_res.execution_time:.2f}s")

    # Extract agenda items
    print("\n5. Querying structured Org agenda tasks:")
    tasks = emacs.get_agenda(uid)
    for task in tasks:
        print(f"   [{task.get('todo') or 'NOTE'}] {task['title']} ({task.get('scheduled') or task.get('deadline') or 'No date'})")

    # Run Org-Babel block inside sandbox
    print("\n6. Executing Org-Babel code blocks in zero-trust sandbox:")
    b_res = emacs.babel_execute(uid, "notes.org")
    print(f"   Babel completed in {b_res.execution_time:.2f}s")

    print("\nEnvironment state is fully saved back to the single-file zip archive!")


if __name__ == "__main__":
    main()
