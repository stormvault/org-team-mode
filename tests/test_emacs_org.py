"""Integration tests for Emacs and Org-Mode inside Firejail sandbox."""

import pytest
from pathlib import Path

from emacs_jail.archive import UserArchiveManager
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager
from emacs_jail.exceptions import FileNotFoundInEnvironmentError


@pytest.fixture
def jail_setup(tmp_path):
    storage = tmp_path / "storage"
    runtime = tmp_path / "runtime"
    cfg = JailConfig(storage_dir=storage, runtime_base_dir=runtime)
    archive_mgr = UserArchiveManager(cfg)
    emacs_mgr = EmacsOrgManager(cfg)
    return cfg, archive_mgr, emacs_mgr


def test_eval_elisp(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    uid = "test_eval_user"

    output = emacs_mgr.eval_elisp(uid, "(+ 100 42)")
    assert "142" in output

    version = emacs_mgr.eval_elisp(uid, "(org-version)")
    assert "9." in version


def test_org_export_html_and_md(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    uid = "export_user"

    doc = (
        "#+TITLE: Integration Test Document\n"
        "#+AUTHOR: Virtual Tenant\n\n"
        "* Section One\n"
        "This is paragraph one.\n\n"
        "** Subsection A\n"
        "- Item 1\n"
        "- Item 2\n"
    )

    archive_mgr.write_file(uid, "workspace/doc.org", doc)

    # Export to HTML
    html_res = emacs_mgr.export(uid, "doc.org", export_format="html")
    assert html_res.success
    assert html_res.output_filename == "doc.html"
    assert "<title>Integration Test Document</title>" in html_res.content
    assert "Section One" in html_res.content

    # Export to Markdown
    md_res = emacs_mgr.export(uid, "doc.org", export_format="md")
    assert md_res.success
    assert md_res.output_filename == "doc.md"
    assert "# Section One" in md_res.content


def test_org_babel_execution(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    uid = "babel_user"

    doc = (
        "#+TITLE: Babel Test\n\n"
        "* Math with Elisp\n"
        "#+begin_src elisp :results value\n"
        "(* 6 7)\n"
        "#+end_src\n\n"
        "* Scripting with Python\n"
        "#+begin_src python :results output\n"
        "print('Execution in firejail: success')\n"
        "#+end_src\n"
    )

    archive_mgr.write_file(uid, "workspace/babel.org", doc)

    res = emacs_mgr.babel_execute(uid, "babel.org")
    assert res.success
    assert ": 42" in res.content
    assert "Execution in firejail: success" in res.content


def test_org_babel_tangle(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    uid = "tangle_user"

    doc = (
        "#+TITLE: Literate Module\n\n"
        "#+begin_src python :tangle generated.py\n"
        "def compute():\n"
        "    return 42\n"
        "#+end_src\n"
    )

    archive_mgr.write_file(uid, "workspace/literate.org", doc)

    res = emacs_mgr.babel_tangle(uid, "literate.org")
    assert res.success
    assert any("generated.py" in f for f in res.tangled_files)

    # Check tangled file in zip archive
    tangled_content = archive_mgr.read_file(uid, "workspace/generated.py").decode("utf-8")
    assert "def compute():" in tangled_content


def test_org_agenda_parsing(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    uid = "agenda_user"

    doc = (
        "#+TITLE: Tasks\n\n"
        "* TODO [#A] Deploy Firejail cluster :ops:\n"
        "SCHEDULED: <2026-10-20 Tue>\n"
        "* DONE Write documentation\n"
        "DEADLINE: <2026-10-18 Sun>\n"
    )

    archive_mgr.write_file(uid, "workspace/tasks.org", doc)

    items = emacs_mgr.get_agenda(uid, files=["tasks.org"])
    assert len(items) >= 2

    task1 = next(item for item in items if item["title"] == "Deploy Firejail cluster")
    assert task1["todo"] == "TODO"
    assert task1["priority"] == "A"
    assert "ops" in task1["tags"]
    assert "2026-10-20" in task1["scheduled"]

    task2 = next(item for item in items if item["title"] == "Write documentation")
    assert task2["todo"] == "DONE"
    assert "2026-10-18" in task2["deadline"]


def test_multi_tenant_isolation(jail_setup):
    cfg, archive_mgr, emacs_mgr = jail_setup
    user_a = "tenant_alpha"
    user_b = "tenant_beta"

    archive_mgr.write_file(user_a, "workspace/secret_a.txt", "Alpha Secret Key 9999")
    archive_mgr.write_file(user_b, "workspace/secret_b.txt", "Beta Secret Key 8888")

    # User B tries to read User A's file via User B's archive
    with pytest.raises(FileNotFoundInEnvironmentError):
        archive_mgr.read_file(user_b, "workspace/secret_a.txt")

    # User B runs Emacs Elisp to check if secret_a exists in its sandbox
    file_exists_in_b = emacs_mgr.eval_elisp(user_b, '(file-exists-p "secret_a.txt")')
    assert "nil" in file_exists_in_b
