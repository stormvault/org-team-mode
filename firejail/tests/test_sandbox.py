"""Unit tests for Firejail command builder and options."""

from emacs_jail.config import JailConfig
from emacs_jail.sandbox import FirejailRunner


def test_command_builder(tmp_path):
    cfg = JailConfig(
        storage_dir=tmp_path / "storage",
        runtime_base_dir=tmp_path / "run",
        enable_network=False,
    )
    runner = FirejailRunner(cfg)
    runtime_dir = tmp_path / "runtime"

    cmd = runner.build_firejail_command(
        runtime_dir=runtime_dir,
        emacs_args=["-Q", "--batch"],
        uid="tester_1",
    )

    cmd_str = " ".join(cmd)
    assert "--quiet" in cmd_str
    assert f"--private={runtime_dir}" in cmd_str
    assert "--net=none" in cmd_str
    assert "--rlimit-cpu=" in cmd_str
    assert "--env=JAIL_USER_UID=tester_1" in cmd_str
    assert str(cfg.emacs_bin) in cmd_str
    assert "-Q" in cmd_str
    assert "--batch" in cmd_str


def test_command_builder_network_override(tmp_path):
    cfg = JailConfig(
        storage_dir=tmp_path / "storage",
        runtime_base_dir=tmp_path / "run",
        enable_network=False,
    )
    runner = FirejailRunner(cfg)
    runtime_dir = tmp_path / "runtime"

    cmd = runner.build_firejail_command(
        runtime_dir=runtime_dir,
        emacs_args=["-Q"],
        enable_network=True,
    )

    cmd_str = " ".join(cmd)
    assert "--net=none" not in cmd_str
    assert "emacs-network.profile" in cmd_str


def test_command_builder_prefers_bundled_static_emacs(tmp_path):
    cfg = JailConfig(
        storage_dir=tmp_path / "storage",
        runtime_base_dir=tmp_path / "run",
    )
    runner = FirejailRunner(cfg)
    runtime_dir = tmp_path / "runtime"
    bundled_bin = runtime_dir / ".emacs_jail" / "bin" / "emacs"
    bundled_bin.parent.mkdir(parents=True, exist_ok=True)
    bundled_bin.write_text("#!/bin/sh\nexit 0\n")
    bundled_bin.chmod(0o755)

    cmd = runner.build_firejail_command(
        runtime_dir=runtime_dir,
        emacs_args=["-Q"],
    )

    cmd_str = " ".join(cmd)
    assert str(bundled_bin) in cmd_str
