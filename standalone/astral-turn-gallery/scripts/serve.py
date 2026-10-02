from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1]/'dist'/'xhs')
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/?safe=1":
            page=Path("index.html").read_text().replace("</head>","<style>:root{--safe-area-inset-top:44px;--safe-area-inset-bottom:34px}</style></head>")
            data=page.encode();self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Content-Length",str(len(data)));self.end_headers();self.wfile.write(data)
        else: super().do_GET()
    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'")
        self.send_header('Cache-Control','no-store')
        super().end_headers()
ThreadingHTTPServer(('127.0.0.1',8770),Handler).serve_forever()
