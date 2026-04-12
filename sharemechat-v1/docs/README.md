# Documentación Interna de SharemeChat

Este directorio centraliza la documentación útil y durable del proyecto.

## Criterio documental

La documentación del repositorio principal debe:

- describir el producto y sus roles
- explicar la arquitectura lógica y técnica
- documentar entornos a nivel funcional y técnico general
- reflejar decisiones de diseño relevantes
- servir de base para mantenimiento, evolución y trabajo asistido por IA

La documentación del repositorio principal no debe:

- actuar como inventario exhaustivo de infraestructura sensible
- depender de identificadores concretos de proveedores cloud
- mezclar en un mismo texto negocio, arquitectura, operación y despliegue detallado
- duplicar la misma información en varios archivos

## Validación del material previo

La documentación anterior aportaba valor real, pero presentaba cuatro problemas estructurales:

- concentraba demasiado conocimiento en un README interno monolítico
- duplicaba arquitectura AWS entre varios archivos
- mezclaba descripción funcional, inventario operativo y estado puntual de despliegues
- exponía detalle sensible innecesario de AWS y de operación

La reorganización actual conserva el conocimiento útil y redistribuye su contenido por dominios. Los documentos anteriores quedan absorbidos salvo el material genérico de soporte que no formaba parte del corpus interno principal.

## Cómo navegar

- `01-business`: producto, modelo de negocio, roles y alcance de compliance
- `02-architecture`: visión del sistema y arquitectura por capas
- `03-environments`: visión por entorno y diferencias relevantes
- `04-operations`: despliegue, runbooks, incidencias y riesgos
- `05-backoffice`: modelo operativo y de permisos del backoffice
- `06-decisions`: decisiones arquitectónicas registradas
- `07-roadmap`: fase actual y siguientes frentes
- `templates`: plantillas para mantener el corpus homogéneo

## Política de mantenimiento

- cada cambio documental debe tocar el archivo más específico posible
- si una información afecta a varios dominios, se documenta una sola vez y se referencia desde el resto
- cuando exista incertidumbre, debe declararse explícitamente
- los runbooks y documentos de entorno deben mantenerse saneados
- los cambios puntuales de infraestructura sensible deben vivir fuera del corpus principal o resumirse de forma lógica
