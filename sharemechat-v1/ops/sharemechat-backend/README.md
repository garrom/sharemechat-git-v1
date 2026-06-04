# Backend Java de SharemeChat — units systemd

Copias autoritativas de las unidades systemd que arrancan el backend Spring Boot del proyecto en cada entorno. Las units instaladas en `/etc/systemd/system/` de cada EC2 deben mantenerse byte-a-byte iguales a las de esta carpeta. Si una EC2 se reconstruye o el operador necesita recrear el servicio, este es el sitio del que se copia.

## Ficheros

- `systemd/sharemechat-test.service` — unit del entorno TEST. Perfil Spring `test`, `EnvironmentFile` partido en `config.env` (no-secret, 0644 root:root) + `secrets.env` (0600 ec2-user:ec2-user). User `ec2-user`. Restart `on-failure`. `SuccessExitStatus=143` para que el SIGTERM no marque la unit como fallida durante stop/restart.

AUDIT corre la misma plantilla con perfil `audit` y la unit instalada en `/etc/systemd/system/sharemechat-audit.service`. La unit de AUDIT no está versionada aquí todavía; se añade cuando toque modificarla por algún motivo.

PROD aún no tiene su unit cableada — la plantilla cuando llegue será la misma adaptada al perfil `prod`.

## Convención de instalación

```
sudo cp ops/sharemechat-backend/systemd/sharemechat-<env>.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sharemechat-<env>.service
sudo systemctl start sharemechat-<env>.service
```

## Relación con coturn

El servidor TURN (`coturn-<env>.service`) NO se gestiona desde este repo todavía. En TEST y AUDIT vive como unit instalada manualmente en la EC2 con `enabled` para arrancar en boot. Cuando se versionen sus units también, irán bajo `ops/coturn/` siguiendo la misma convención que esta carpeta.

## Notas operativas

- El `EnvironmentFile` de systemd espera formato `KEY=VALUE` puro. No usa shell, no expande `export` ni `source`. Los `.env` actuales del proyecto ya cumplen ese formato porque el refactor 2026-05-26 lo dejó así. **No reintroducir `export KEY=...` ni comentarios complejos en estos ficheros**, romperían systemd silenciosamente.
- El proceso lo lanza `ec2-user`. Los `EnvironmentFile` los lee `systemd` como root antes de cambiar a `ec2-user`, así que las perms `secrets.env` 0600 funcionan tanto si el owner es root como ec2-user.
- `SuccessExitStatus=143` cubre el caso `kill -TERM` que Spring usa al recibir `systemctl stop`.
