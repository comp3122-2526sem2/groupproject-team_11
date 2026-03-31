import json
import os
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


CHAT_MODELS = [
    "CohereLabs/tiny-aya-global:cohere",
    "CohereLabs/c4ai-command-r7b-12-2024:cohere",
    "CohereLabs/aya-expanse-32b:cohere",
]

VISION_MODELS = [
    "Qwen/Qwen3.5-9B:fastest",
    "meta-llama/Llama-3.2-11B-Vision-Instruct:fastest",
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_dotenv(dotenv_path=".env"):
    if not os.path.exists(dotenv_path):
        return
    with open(dotenv_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


class AppHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            token = os.getenv("HF_API_TOKEN", "").strip()
            self._send_json(200, {"ok": True, "tokenConfigured": bool(token)})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/hf":
            self._send_json(404, {"error": "Not Found"})
            return

        token = os.getenv("HF_API_TOKEN", "").strip()
        if not token:
            self._send_json(500, {"error": "Server missing HF_API_TOKEN environment variable."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            request_data = json.loads(raw_body.decode("utf-8"))
            prompt = (request_data.get("prompt") or "").strip()
            image_data_url = (request_data.get("imageDataUrl") or "").strip()
            if not prompt:
                self._send_json(400, {"error": "Missing prompt"})
                return

            last_error = None
            model_pool = VISION_MODELS if image_data_url else CHAT_MODELS
            for model in model_pool:
                if image_data_url:
                    content = [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ]
                else:
                    content = prompt

                hf_req = urllib.request.Request(
                    url="https://router.huggingface.co/v1/chat/completions",
                    data=json.dumps(
                        {
                            "model": model,
                            "messages": [{"role": "user", "content": content}],
                            "stream": False,
                        }
                    ).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )

                try:
                    with urllib.request.urlopen(hf_req, timeout=60) as resp:
                        hf_data = json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as model_err:
                    if model_err.code in (404, 410):
                        last_error = {
                            "model": model,
                            "code": model_err.code,
                            "detail": model_err.read().decode("utf-8", errors="ignore"),
                        }
                        continue
                    raise

                if isinstance(hf_data, dict):
                    choices = hf_data.get("choices")
                    if isinstance(choices, list) and choices:
                        message = choices[0].get("message", {})
                        generated_text = message.get("content")
                        if generated_text:
                            self._send_json(200, {"generated_text": generated_text, "model": model})
                            return

                last_error = {"model": model, "detail": hf_data}

            self._send_json(502, {"error": "No available model succeeded", "lastError": last_error})
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="ignore")
            self._send_json(err.code, {"error": "Hugging Face request failed", "detail": detail})
        except Exception as err:
            self._send_json(500, {"error": str(err)})


def main():
    load_dotenv(os.path.join(BASE_DIR, ".env"))
    port = int(os.getenv("PORT", "8000"))
    handler = partial(AppHandler, directory=BASE_DIR)
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    token_configured = bool(os.getenv("HF_API_TOKEN", "").strip())
    print(f"Server running on http://localhost:{port}")
    print(f"HF_API_TOKEN configured: {token_configured}")
    server.serve_forever()


if __name__ == "__main__":
    main()