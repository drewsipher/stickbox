#!/usr/bin/env python3
"""Serve the game locally with caching disabled, so every reload picks up the latest files.

Usage: python3 tools/serve.py [port]   (default 8000; binds all interfaces so phones/tablets on the LAN can play)
"""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    print('Stickbox on http://localhost:%d (Ctrl+C to stop)' % port)
    ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler).serve_forever()
