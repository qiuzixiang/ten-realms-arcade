from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from functools import partial
directory=str(Path(__file__).resolve().parents[1]/'dist'/'xhs')
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'")
  super().end_headers()
ThreadingHTTPServer(('127.0.0.1',4180),partial(Handler,directory=directory)).serve_forever()
