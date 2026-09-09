#!/usr/bin/env python3
# Copyright (c) 2024-2027 Nervosys LLC
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
"""Test suite for IronBridge.vim.

Run with:  python3 test/run_tests.py

The plugin talks to the server by shelling out to curl, and Vim will not let a
test replace a builtin like system(). So rather than stub the transport, this
serves a real HTTP server on a loopback port, points the plugin at it, drives
the plugin through Vim in ex mode, and then asserts on what the server was
actually asked for.

That covers the failure this suite was written for: `ironbridge#health()` asked
for `/health`, which the server does not route, so a perfectly healthy server
reported itself unreachable. Nothing but a request-path assertion catches that
class of bug — the plugin's own error handling turns the 404 into a message and
carries on.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PLUGIN_DIR = Path(__file__).resolve().parent.parent

# What the server answers, by path. Bodies are the shapes the real API returns.
RESPONSES = {
    "/api/health": {"status": "ok", "version": "2.0.1"},
    "/api/harvest": {"sessions_count": 3, "messages_count": 30, "providers": ["copilot"]},
    "/api/sessions": {
        "sessions": [
            {
                "id": "s-1",
                "title": "Recovering a lost session",
                "provider": "copilot",
                "message_count": 2,
                "updated_at": "2026-01-15T10:00:00Z",
            }
        ]
    },
    "/api/stats": {
        "total_sessions": 10,
        "total_messages": 200,
        "total_workspaces": 4,
        "providers": 3,
    },
    "/api/search": {
        "sessions": [
            {"id": "s-9", "title": "auth bypass", "provider": "claude", "message_count": 3}
        ]
    },
    # Served deliberately as a non-JSON body, to prove s:request reports it.
    "/not-json": "<html>a proxy error page</html>",
    "/api/sessions/s-1": {
        "id": "s-1",
        "title": "Recovering a lost session",
        "provider": "copilot",
        "messages": [
            {"role": "user", "content": "How do I recover an orphaned session?"},
            {"role": "assistant", "content": "Run ironbridge detect orphaned."},
        ],
    },
}

requests_seen: list[tuple[str, str]] = []
_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def _serve(self) -> None:
        parsed = urlparse(self.path)
        with _lock:
            requests_seen.append((self.command, self.path))
        body = RESPONSES.get(parsed.path)
        if isinstance(body, str):
            payload = body.encode()
        else:
            payload = json.dumps(body if body is not None else {"error": "not found"}).encode()
        self.send_response(200 if body is not None else 404)
        self.send_header("Content-Type", "text/html" if isinstance(body, str) else "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = _serve
    do_POST = _serve

    def log_message(self, *_args) -> None:  # keep the test output clean
        pass


DRIVER = Path(__file__).resolve().parent / "driver.vim"


def check_declared_paths() -> list[str]:
    """Every path the plugin asks for must be one the server routes.

    The dynamic half of this suite can only drive the functions that do not
    open a window. This reads the request paths straight out of the source so
    the rest are covered as well, which is what catches a path drifting out of
    the `/api` scope.
    """
    source = (PLUGIN_DIR / "autoload" / "ironbridge.vim").read_text(encoding="utf-8")
    declared = set(re.findall(r"s:request\(\s*'(?:GET|POST)'\s*,\s*'([^']+)'", source))
    problems = []
    for path in sorted(declared):
        # Paths are sometimes concatenated with an id; compare the fixed part.
        base = path.rstrip("/")
        if base in RESPONSES:
            continue
        if any(route.startswith(base) for route in RESPONSES):
            continue
        problems.append(f"the plugin requests {path!r}, which the API does not route")
    if not declared:
        problems.append("found no request paths in the plugin source; the scan is broken")
    return problems


def main() -> int:
    vim = shutil.which("vim")
    if not vim:
        print("SKIP: vim is not installed", file=sys.stderr)
        return 0
    if not shutil.which("curl"):
        print("SKIP: curl is not installed; the plugin uses it for every request", file=sys.stderr)
        return 0

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    failures: list[str] = []
    try:
        with tempfile.TemporaryDirectory() as tmp:
            results = Path(tmp) / "errors.txt"
            script = Path(tmp) / "run.vim"
            script.write_text(
                DRIVER.read_text(encoding="utf-8")
                .replace("@@PLUGIN@@", str(PLUGIN_DIR).replace("\\", "/"))
                .replace("@@PORT@@", str(port))
                .replace("@@RESULTS@@", str(results).replace("\\", "/")),
                encoding="utf-8",
            )

            proc = subprocess.run(
                # Git for Windows ships a Vim that does not accept a backslashed path
                # here; forward slashes work on every platform.
                [vim, "-es", "-u", "NONE", "-N", "-S", str(script).replace("\\", "/")],
                capture_output=True,
                text=True,
                # `vim -es` reads ex commands from stdin, so an inherited stdin
                # leaves it waiting forever if the script ever exits early.
                stdin=subprocess.DEVNULL,
                timeout=120,
            )
            if proc.returncode != 0:
                failures.append(f"vim exited {proc.returncode}: {proc.stderr.strip()[:500]}")

            if results.exists():
                failures.extend(
                    line for line in results.read_text(encoding="utf-8").splitlines() if line.strip()
                )
            else:
                failures.append("vim wrote no results file; the script did not run to the end")
    finally:
        server.shutdown()

    # Every path the plugin asked for must be one the server routes. A 404 here
    # is the bug this suite exists to catch.
    paths = [(method, urlparse(path).path) for method, path in requests_seen]
    # Two requests are deliberate misses, exercising the error paths.
    deliberate = {"/api/sessions/nope"}
    for method, path in paths:
        if path not in RESPONSES and path not in deliberate:
            failures.append(f"{method} {path} is not a route the server serves")

    expected = [
        ("GET", "/api/health"),
        ("POST", "/api/harvest"),
        ("GET", "/api/sessions"),
        ("GET", "/api/stats"),
        ("GET", "/api/search"),
        ("GET", "/api/sessions/s-1"),
    ]
    failures.extend(check_declared_paths())
    for want in expected:
        if want not in paths:
            failures.append(f"expected the plugin to make a {want[0]} to {want[1]}; saw {paths}")

    # The query has to arrive encoded, or the server sees a truncated search.
    search = [raw for method, raw in requests_seen if urlparse(raw).path == "/api/search"]
    if search and "%20" not in search[0]:
        failures.append(f"the search query was not URL-encoded: {search[0]}")
    if search and "%26" not in search[0]:
        failures.append(f"the ampersand in the query was not encoded: {search[0]}")

    if failures:
        print(f"FAIL: {len(failures)} problem(s)", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"ok - {len(paths)} requests checked, vim assertions passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
