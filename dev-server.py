"""Server de previzualizare pentru GiftMe! (doar pe calculatorul tău, nu se publică).

Servește site-ul și primește confirmările de test de la /confirma-prezenta/
în rsvp-test-local.csv, ca să poți încerca formularul înainte de Google Apps Script.
Nu trimite emailuri.

Pornire:  python3 dev-server.py   →  http://localhost:8765/confirma-prezenta/
"""

import csv
import json
import re
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "rsvp-test-local.csv"
HEADERS = ["Trimis la", "Nume, prenume", "Email", "Prezent(ă)", "Nr. invitat"]
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/__rsvp-test":
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 10_000)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self.reply({"ok": False, "error": "validation"})

        if body.get("website"):
            return self.reply({"ok": True})

        nume = " ".join(str(body.get("nume", "")).split())
        email = str(body.get("email", "")).strip().lower()
        prezenta = body.get("prezenta")
        errors = {}
        if not (2 <= len(nume) <= 80 and nume[0].isalpha() and all(c.isalpha() or c in " .'’-" for c in nume)):
            errors["nume"] = "Numele poate conține doar litere, spații, cratimă și apostrof (2–80 de caractere)."
        if not (len(email) <= 120 and EMAIL_RE.match(email)):
            errors["email"] = "Adresa de email nu pare corectă. Verifică, te rugăm, dacă are forma nume@exemplu.com."
        if prezenta not in ("Da", "Nu"):
            errors["prezenta"] = "Alege „Da” sau „Nu”."
        if errors:
            return self.reply({"ok": False, "error": "validation", "fields": errors})

        rows = []
        if CSV_PATH.exists():
            with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
                rows = list(csv.reader(f))[1:]
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for row in rows:
            if row[2] == email:
                row[:4] = [now, nume, email, prezenta]
                nr = row[4]
                break
        else:
            nr = str(len(rows) + 1)
            rows.append([now, nume, email, prezenta, nr])
        with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(HEADERS)
            writer.writerows(rows)

        print(f"  ✓ confirmare de test: {nume} <{email}> → {prezenta} (nr. {nr})")
        self.reply({"ok": True, "nr": int(nr), "emailSent": False})

    def reply(self, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"GiftMe! previzualizare: http://localhost:{PORT}/confirma-prezenta/")
    print(f"Confirmările de test se salvează în {CSV_PATH.name}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
