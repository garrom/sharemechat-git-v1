#!/usr/bin/env python3
"""Observabilidad #5 — vigilante de salud del backend.

Corre en el propio EC2 por un timer systemd. Consulta /actuator/health (interno,
incluye el chequeo de BD) y envia email SOLO en las transiciones de estado
(UP->DOWN, DOWN->UP) o como re-aviso periodico mientras siga caido, apoyandose en
un fichero de estado para NO spamear. Mecanismo de email = SMTP (identico al del
prod-access-reporter).

Limitacion conocida: detecta SERVICIO caido (JVM muerta, OOM, BD DOWN -> health
DOWN o proceso sin responder), NO la caja entera caida (si el EC2 muere, el timer
muere con el). Para eso haria falta un monitor externo (fuera de alcance de #5).
"""
import argparse
import json
import os
import smtplib
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path


def interpret(code, body):
    """(codigo HTTP, cuerpo) -> 'UP' | 'DOWN'. Actuator health: 200 {status:UP}."""
    if code == 200:
        try:
            status = (json.loads(body) or {}).get("status", "")
        except Exception:
            status = ""
        return "UP" if str(status).upper() == "UP" else "DOWN"
    return "DOWN"


def check_health(url, timeout_seconds, opener=None):
    """Devuelve (status, detalle). Cualquier fallo de red/timeout/5xx = DOWN."""
    opener = opener or (lambda u, t: urllib.request.urlopen(urllib.request.Request(u, method="GET"), timeout=t))
    try:
        resp = opener(url, timeout_seconds)
        code = resp.getcode()
        body = resp.read(4096).decode("utf-8", "replace")
        try:
            resp.close()
        except Exception:
            pass
        return interpret(code, body), "http %s" % code
    except urllib.error.HTTPError as exc:  # p.ej. 503 = health DOWN
        return "DOWN", "http %s" % exc.code
    except Exception as exc:  # timeout, connection refused, etc.
        return "DOWN", "%s: %s" % (exc.__class__.__name__, exc)


def evaluate_transition(prev, cur_status, now_epoch, realert_seconds):
    """Decide si hay que avisar. `prev` = estado previo (dict o {}). Devuelve
    (alert_kind, new_state) con alert_kind in {'down','recovery',None}."""
    prev_status = prev.get("status")
    last_alert_at = prev.get("last_alert_at") or 0
    alert_kind = None

    if cur_status == "DOWN":
        newly_down = prev_status != "DOWN"
        stale = (now_epoch - last_alert_at) >= realert_seconds
        if newly_down or stale:
            alert_kind = "down"
    elif cur_status == "UP":
        if prev_status == "DOWN":
            alert_kind = "recovery"

    new_state = {
        "status": cur_status,
        "checked_at": now_epoch,
        "last_alert_at": now_epoch if alert_kind else last_alert_at,
    }
    return alert_kind, new_state


def read_state(path):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return {}


def write_state(path, state):
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(state))
    except Exception as exc:
        sys.stderr.write("no se pudo escribir el state file: %s\n" % exc)


def send_email(subject, body, smtp_host, smtp_port, smtp_username, smtp_password,
               smtp_starttls, smtp_timeout, email_from, email_to):
    recipients = [p.strip() for p in str(email_to).replace(";", ",").split(",") if p.strip()]
    missing = [n for n, v in (("SMTP_HOST", smtp_host), ("SMTP_PORT", smtp_port),
                              ("EMAIL_FROM", email_from)) if not v]
    if not recipients:
        missing.append("EMAIL_TO")
    if missing:
        raise SystemExit("Falta config SMTP para --send-email: %s" % ", ".join(missing))

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = ", ".join(recipients)
    msg.set_content(body + "\n")

    port = int(smtp_port)
    use_tls = str(smtp_starttls).strip().lower() in ("1", "true", "yes", "on")
    timeout = int(smtp_timeout) if str(smtp_timeout).strip() else 30
    try:
        with smtplib.SMTP(smtp_host, port, timeout=timeout) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            if smtp_username:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(msg)
    except Exception as exc:
        raise SystemExit("Envio SMTP fallo: %s" % exc) from exc


def main(argv=None):
    ap = argparse.ArgumentParser(description="Vigilante de salud del backend (obs #5)")
    ap.add_argument("--health-url", default="http://localhost:8080/actuator/health")
    ap.add_argument("--env-name", default="prod")
    ap.add_argument("--state-file", required=True)
    ap.add_argument("--timeout-seconds", default="5")
    ap.add_argument("--realert-minutes", default="120")
    ap.add_argument("--send-email", action="store_true")
    ap.add_argument("--smtp-host", default="")
    ap.add_argument("--smtp-port", default="")
    ap.add_argument("--smtp-username", default="")
    # La password SMTP NO se pasa por argv (higiene: nunca secretos en la linea de
    # comandos -> visibles en ps). Se lee del entorno SMTP_PASSWORD (exportado por
    # bin/check-health.sh tras sourcear secrets.env).
    ap.add_argument("--smtp-starttls", default="true")
    ap.add_argument("--smtp-timeout-seconds", default="30")
    ap.add_argument("--email-from", default="")
    ap.add_argument("--email-to", default="")
    args = ap.parse_args(argv)

    cur_status, detail = check_health(args.health_url, float(args.timeout_seconds))
    now_epoch = int(time.time())
    now_iso = datetime.now(timezone.utc).isoformat()
    env = args.env_name.upper()

    prev = read_state(args.state_file)
    alert_kind, new_state = evaluate_transition(
        prev, cur_status, now_epoch, int(args.realert_minutes) * 60)
    write_state(args.state_file, new_state)

    if alert_kind == "down":
        subject = "[SHAREMECHAT %s] Backend DOWN" % env
        body = ("El backend de %s NO responde sano.\n\nCheck: %s\nDetalle: %s\nHora (UTC): %s"
                % (env, args.health_url, detail, now_iso))
    elif alert_kind == "recovery":
        subject = "[SHAREMECHAT %s] Backend recuperado (UP)" % env
        body = ("El backend de %s ha vuelto a estar sano.\n\nCheck: %s\nDetalle: %s\nHora (UTC): %s"
                % (env, args.health_url, detail, now_iso))
    else:
        subject = body = None

    if subject:
        if args.send_email:
            send_email(subject, body, args.smtp_host, args.smtp_port, args.smtp_username,
                       os.environ.get("SMTP_PASSWORD", ""), args.smtp_starttls,
                       args.smtp_timeout_seconds, args.email_from, args.email_to)
            print("EMAIL enviado: %s" % subject)
        else:
            print("[DRY-RUN] enviaria: %s :: %s" % (subject, detail))

    print("health=%s detail=%s alert=%s" % (cur_status, detail, alert_kind))
    return 0 if cur_status == "UP" else 1


if __name__ == "__main__":
    sys.exit(main())
