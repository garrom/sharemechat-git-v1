# health-monitor (observabilidad #5)

Vigilante de salud del backend. Corre en el propio EC2 por un timer systemd, consulta
`/actuator/health` interno (incluye el chequeo de BD) cada ~3 min y **envía email solo
en las transiciones de estado** (UP→DOWN, DOWN→UP) o como re-aviso periódico mientras
siga caído (`REALERT_MINUTES`), apoyándose en un fichero de estado para no spamear.
Email por SMTP (mismo mecanismo que `prod-access-reporter`).

## Alcance y límite
Detecta **servicio caído** (JVM muerta, OOM, BD DOWN → health DOWN, o el proceso sin
responder). **NO** detecta que la **caja entera** se caiga (si el EC2 muere, el timer
muere con él). Para eso haría falta un monitor externo apuntando a `/api/health/version`
(público) — fuera de alcance de #5.

## Estructura
- `lib/check_health.py` — lógica (consulta, máquina de transición, email). Testeable:
  `cd lib && python3 -m unittest test_check_health`.
- `bin/check-health.sh` — carga `config.env` (+ `secrets.env`) y ejecuta el python.
  La password SMTP se exporta al entorno, nunca por argv.
- `systemd/*.{service,timer}` — timer cada 3 min.
- `config/{config,secrets}.env.example`.

## Instalación en el EC2 (root)
```
sudo mkdir -p /opt/sharemechat-health-monitor /etc/sharemechat-health-monitor /var/lib/sharemechat-health-monitor
sudo cp -r bin lib /opt/sharemechat-health-monitor/
sudo chmod +x /opt/sharemechat-health-monitor/bin/check-health.sh
sudo cp config/config.env.example  /etc/sharemechat-health-monitor/config.env
sudo cp config/secrets.env.example /etc/sharemechat-health-monitor/secrets.env
# editar config.env (EMAIL_FROM/TO, SMTP_HOST/PORT/USERNAME, ENV_NAME) y secrets.env (SMTP_PASSWORD)
sudo chmod 600 /etc/sharemechat-health-monitor/secrets.env
sudo cp systemd/sharemechat-health-monitor.service /etc/systemd/system/
sudo cp systemd/sharemechat-health-monitor.timer   /etc/systemd/system/
# DRY-RUN primero (SEND_EMAIL=false en config.env) y comprobar la salida:
sudo /opt/sharemechat-health-monitor/bin/check-health.sh --config /etc/sharemechat-health-monitor/config.env
# activar el timer:
sudo systemctl daemon-reload
sudo systemctl enable --now sharemechat-health-monitor.timer
sudo systemctl list-timers | grep health-monitor
```

Reutiliza los mismos valores SMTP que `prod-access-reporter` (mismo servidor/credenciales).
