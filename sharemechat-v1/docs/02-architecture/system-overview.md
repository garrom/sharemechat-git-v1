# Visión general del sistema

La arquitectura general del proyecto sigue este patrón lógico:

- frontend React con dos superficies de build
- backend Spring Boot único
- API REST bajo `/api`
- realtime por WebSocket en `/match` y `/messages`
- persistencia principal en MySQL
- estado operativo y controles efímeros en Redis
- uploads privados servidos por backend y almacenados en storage configurable, con S3 privado como estrategia activa

## Topología lógica

Entrada de usuario:

- edge/CDN
- frontend estático o encaminamiento al backend

Plano de aplicación:

- backend centralizado para autenticación, negocio, backoffice y señalización realtime

Plano de datos:

- MySQL para persistencia de negocio
- Redis para estado operativo de baja latencia

## Superficies

- producto: acceso público, onboarding, dashboards y realtime de usuario final
- backoffice: superficie separada de administración interna

Ambas superficies comparten backend y base de datos, pero se publican de forma separada.

## Estado de la arquitectura

La topología es consistente con un MVP industrial avanzado. La documentación previa confirmaba un despliegue en AWS con edge, buckets privados y backend dedicado, pero ese nivel concreto se ha abstraído aquí de forma intencional.
