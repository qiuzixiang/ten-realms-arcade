#!/usr/bin/env python3
"""Serve dist/xhs with a restrictive local test CSP."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

root = Path(__file__).resolve().parents[1] / "dist" / "xhs"
os.chdir(root)

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; "
            "frame-src 'none'; base-uri 'none'; form-action 'none'",
        )
        super().end_headers()

ThreadingHTTPServer(("127.0.0.1", 4174), Handler).serve_forever()
