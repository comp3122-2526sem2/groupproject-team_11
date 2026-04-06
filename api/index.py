import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/gemini-key" or self.path.startswith("/api/gemini-key?"):
            gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
            if gemini_key:
                self._send_json(200, {"key": gemini_key})
            else:
                self._send_json(404, {"error": "GEMINI_API_KEY not configured"})
            return

        self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        # ── Gemini proxy ──────────────────────────────────────────────────
        if self.path == "/api/gemini" or self.path.startswith("/api/gemini?"):
            self._handle_gemini()
            return

        self._send_json(404, {"error": "Not Found"})

    # ── Gemini Proxy Handler ───────────────────────────────────────────────
    def _handle_gemini(self):
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not gemini_key:
            self._send_json(500, {"error": "Server missing GEMINI_API_KEY environment variable."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            request_data = json.loads(raw_body.decode("utf-8"))

            model = request_data.get("model", "gemini-2.0-flash")
            payload = request_data.get("payload")
            if not payload:
                self._send_json(400, {"error": "Missing payload"})
                return

            url = f"{GEMINI_API_BASE}/{model}:generateContent?key={gemini_key}"
            gemini_req = urllib.request.Request(
                url=url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(gemini_req, timeout=60) as resp:
                gemini_data = json.loads(resp.read().decode("utf-8"))

            self._send_json(200, gemini_data)

        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="ignore")
            self._send_json(err.code, {"error": "Gemini API request failed", "detail": detail})
        except Exception as err:
            self._send_json(500, {"error": str(err)})
