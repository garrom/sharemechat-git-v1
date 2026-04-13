# ADR-003: Migracion de uploads privados desde storage local a S3 privado

## Estado

Aceptada e implementada. AUDIT ya opera con esta estrategia; la activacion efectiva en otros entornos sigue pendiente de configuracion y validacion.

## Contexto

El codigo actual usa `StorageService` para uploads privados de usuario.

La configuracion activa en `application.properties` define:

- `app.storage.type=local`
- `app.storage.local.root=/usr/share/nginx/html/uploads`

El profile `application-audit.properties` no overridea storage, por lo que AUDIT hereda el mismo patron local que TEST.

Los uploads privados afectados incluyen:

- fotos privadas de perfil
- videos privados de perfil
- documentos de identidad
- documentos de verificacion
- documentos manuales de KYC

La incidencia observada en AUDIT confirma que el backend sigue acoplado a filesystem local y a una ruta servida por Nginx: la subida de documentos de modelo falla con `AccessDeniedException` sobre `/usr/share/nginx/html/uploads`.

La implementacion previa solo contemplaba `LocalStorageService`, con rutas `/uploads/...` servidas desde filesystem local.

## Alternativas evaluadas

### A. Mantener storage local mejor operado

Pros:

- minimo cambio de codigo
- mantiene el flujo actual de frontend y backend
- permite corregir rapido si el problema fuese solo de permisos o montaje

Contras:

- mantiene el acoplamiento a filesystem local
- exige disciplina operativa identica por entorno
- vuelve fragil la homogeneidad TEST/AUDIT
- escala peor y complica backup, rotacion y endurecimiento
- es una base debil para documentos privados de usuario

### B. Migrar a S3 privado con acceso via backend/proxy

Pros:

- desacopla uploads del host y del filesystem local
- mantiene el backend como punto de control de acceso
- evita exponer directamente documentos privados como URLs estables
- permite desplegar primero en AUDIT sin rehacer el flujo completo del frontend
- encaja mejor con documentos sensibles y con una aplicacion industrial

Contras:

- requiere nueva implementacion de `StorageService`
- obliga a definir endpoints o estrategia de serving protegido
- aumenta complejidad respecto al storage local

### C. Migrar a S3 privado con URLs firmadas temporales

Pros:

- reduce carga de serving en backend
- escala bien para trafico alto
- es un patron cloud maduro

Contras:

- introduce mas complejidad en frontend y backend
- exige gestionar emision, expiracion y renovacion de URLs firmadas
- complica mas el despliegue inicial en AUDIT
- para documentos privados sensibles requiere mucha claridad de permisos y consumo

## Decision

Adoptar como direccion recomendada la alternativa B:

- almacenamiento privado en S3
- acceso a documentos privados mediado por backend/proxy

## Motivo

Es la opcion que mejor equilibra:

- seguridad para documentos privados
- homogeneidad entre entornos
- desacoplamiento del host
- despliegue incremental
- simplicidad operativa frente a URLs firmadas

Permite mover la persistencia del fichero a cloud privado sin obligar a rediseñar en una sola fase toda la UX de subida y visualizacion.

## Implementacion base realizada

El codigo versionado pasa a incluir:

- implementacion `S3StorageService`
- seleccion de proveedor por configuracion
- proxy backend para servir contenido privado desde `/api/storage/content`
- storage S3 privado sin subida directa desde frontend
- acceso autenticado obligatorio al proxy de storage
- separacion de acceso entre media funcional por rol de negocio y documentos de verification o KYC mas restringidos

La activacion real requiere completar configuracion por entorno, al menos:

- `APP_STORAGE_TYPE=s3`
- bucket S3 privado
- region
- prefijo raiz si aplica

## Consecuencias

### Tecnicas

- el backend soporta ya storage local y S3 privado bajo el mismo contrato
- el modelo de `/uploads/...` deja de ser el unico camino para documentos privados
- el acceso a objetos privados se mantiene mediado por backend
- el media funcional de modelos queda limitado a owner, CLIENT, MODEL o backoffice
- el media funcional de clientes queda limitado a owner, MODEL o backoffice
- verification y KYC quedan limitados a propietario o backoffice autorizado

### Operativas

- se reduce la dependencia de permisos locales y layout Nginx/backend
- AUDIT deja de depender de que el proceso backend escriba en una ruta local comun
- el despliegue exige configuracion explicita de storage privado por entorno

### De seguridad y compliance

- mejora el control sobre documentos privados respecto a publicarlos como ficheros locales servidos por Nginx
- obliga a definir politicas claras de acceso, retencion y lifecycle

## Pendiente tras esta fase

- activar configuracion S3 por entorno donde siga pendiente
- validar buckets, prefijos y permisos reales
- definir migracion de referencias antiguas `/uploads/...` si existen documentos historicos relevantes
- decidir si fases posteriores necesitan URLs firmadas para ciertos flujos de descarga intensiva
