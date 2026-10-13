#!/usr/bin/env python3
"""Multi-tenant isolation demonstration for non-system user UIDs."""

import concurrent.futures
from emacs_jail.archive import UserArchiveManager
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager


def process_tenant(uid: str, project_title: str) -> str:
    config = JailConfig()
    archive_mgr = UserArchiveManager(config)
    emacs = EmacsOrgManager(config)

    # Each tenant creates their own custom Org file in their isolated workspace
    org_content = f"""#+TITLE: {project_title}
#+AUTHOR: Tenant {uid}

* Goals for {uid}
- Task A for {uid}
- Task B for {uid}

* Python Computation
#+begin_src python :results output
import os
print(f"I am user UID: {{os.environ.get('JAIL_USER_UID', 'unknown')}}")
#+end_src
"""
    archive_mgr.write_file(uid, "workspace/project.org", org_content)

    # Run Babel and Export concurrently
    emacs.babel_execute(uid, "project.org")
    res = emacs.export(uid, "project.org", export_format="html")
    return f"Tenant {uid} generated {res.output_filename} ({len(res.content)} chars) in {res.execution_time:.2f}s"


def main():
    print("Simulating concurrent execution across 3 non-system virtual users...")
    tenants = [
        ("tenant_alice", "Project Alpha by Alice"),
        ("tenant_bob", "Project Beta by Bob"),
        ("tenant_charlie", "Project Gamma by Charlie"),
    ]

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(process_tenant, uid, title) for uid, title in tenants]
        for f in concurrent.futures.as_completed(futures):
            print(" -", f.result())

    print("\nVerifying separate single-file zip archives in storage:")
    archive_mgr = UserArchiveManager()
    for uid, _ in tenants:
        meta = archive_mgr.get_metadata(uid)
        print(f" - {uid}.zip: {meta['archive_size_bytes']} bytes (Updated: {meta['updated_at'][:19]})")


if __name__ == "__main__":
    main()
