---
case_key: ui-reference
role: BOTH
active: true
description: Mapa transversal de la UI para guiar al usuario
---

# ui-reference

Mapa de la UI real del producto. Fila transversal "siempre incluir": la información de aquí se concatena en el system prompt de cualquier respuesta operativa para que puedas dar indicaciones concretas, no abstractas. No repite conceptos de negocio; solo dice DÓNDE vive cada cosa en pantalla.

## Reglas para usarlo

- El usuario que te habla suele estar YA en el dashboard (este chat se abre desde ahí). No le digas "ve al dashboard" para acciones que se hacen desde el propio dashboard.
- Cuando indiques una acción, usa el nombre literal del botón o zona ("botón Comprar del navbar", "tab Favoritos", "sección Estadísticas del navbar modelo"). No inventes nombres.
- No mandes al usuario a rutas que no existen ("panel de payout", "billing", "settings").

## Navbar del producto autenticado

Estructura del navbar (siempre visible, arriba):

Zona izquierda (tabs de navegación, comunes cliente y modelo):
1. Videochat.
2. Favoritos.
3. Blog.
4. Icono del Agente IA (logo del bot, este mismo chat de soporte).

Zona derecha, específica por rol.

CLIENT:
1. Saldo actual con formato "Saldo: 22,00 EUR".
2. Selector de idioma ES / EN.
3. Botón "Comprar" (icono de gema verde).
4. Botón "Salir".
5. Avatar clickable (lleva al perfil).

MODEL:
1. Texto de cola (queue) cuando aplica.
2. Selector de idioma ES / EN.
3. Botón "Estadísticas" (icono de gráfico verde).
4. Botón "Retirar" (icono de gema naranja).
5. Botón "Salir".
6. Avatar clickable (lleva al perfil).

## Navbar en móvil

El navbar se contrae en un menú tipo hamburguesa. Los tabs principales (Videochat, Favoritos, Blog) también se muestran en una barra inferior. El icono del Agente IA NO aparece en la barra inferior móvil; sí en el menú hamburguesa.

## Dashboard cliente (ruta /client)

Al hacer login como cliente el usuario entra directamente al dashboard. Es UNA sola página con tabs internas (no cambia de URL entre tabs). Vista por defecto: tab Videochat.

Ubicaciones concretas para el cliente:
- Ver saldo: SIEMPRE visible en el navbar, arriba a la derecha.
- Comprar saldo: click en el botón "Comprar" del navbar.
- Chatear con favoritos: click en la tab "Favoritos".
- Hacer videochat aleatorio: click en la tab "Videochat".
- Leer el blog: click en la tab "Blog".
- Abrir soporte con el Agente IA: click en el icono del bot del navbar.
- Ver perfil: click en el avatar (arriba a la derecha).
- Cerrar sesión: botón "Salir" del navbar.

## Dashboard modelo (ruta /model)

Estructura equivalente al del cliente pero con acciones distintas.

Ubicaciones concretas para la modelo:
- Ver estadísticas, tier, progreso, ganancias: click en el botón "Estadísticas" del navbar.
- Solicitar retiro (payout): click en el botón "Retirar" del navbar.
- Gestionar favoritos y chatear: tab "Favoritos".
- Atender videochat aleatorio: tab "Videochat" (activar cámara para entrar en la cola).

## Tab Favoritos (dentro de /client o /model)

Layout de 3 columnas dentro del propio dashboard:
- Columna izquierda: lista de favoritos.
- Panel central: chat de texto con el favorito seleccionado. Si el favorito seleccionado es el Agente IA, ahí se renderiza este mismo chat de soporte.
- Columna derecha: espacio de videochat 1-a-1 cuando aplica.

El Agente IA aparece SIEMPRE como PRIMER favorito de la lista, con el logo del bot y badge "24/7".

## Tab Videochat (dentro de /client o /model)

Vídeo local (cámara propia) + vídeo remoto (la otra parte) + chat lateral. Para matchear, el usuario debe activar la cámara desde el propio panel. Cliente sin verificación de edad (Didit): la activación de cámara está inhabilitada hasta completar KYC.

## Sección Comprar (cliente)

No es página aparte: se abre desde el botón "Comprar" del navbar del cliente. Muestra los packs disponibles (10, 20, 40 y 100 EUR, los tres últimos con bonus). El pago es en criptomoneda: el cliente es redirigido a un checkout externo donde elige la cripto y ve la dirección/QR; al confirmarse en blockchain, vuelve y se acredita el saldo. La tarjeta aún no está disponible.

## Registro con Google (cliente)

En el registro/login público del cliente hay un botón "Registrarse/Iniciar con Google" además del formulario de email. Solo para clientes (no modelos ni estudios). No sustituye al KYC de edad (Didit), que sigue siendo obligatorio.

## Likes e insignias (perfil de modelo)

En el perfil de una modelo, el cliente ve un botón de corazón para dar "like" (toggle) y, si la modelo acumula likes, su insignia de realeza (Tiara/Diadema/Corona/Corona de Gemas/Imperial) junto al contador. En su propia vista, la modelo ve "Tu reputación" (likes, insignia y cuánto falta para la siguiente) y un botón "Ver Top modelos" (ranking Top 30 por likes, solo modelos).

## Panel Master (estudios)

Los usuarios con cuenta Master (estudios/agencias) tienen su propio panel en la ruta /master: visión económica consolidada, listado de sus modelos, alta de nuevas modelos, cobro e histórico. El cliente y la modelo estándar no lo ven.

## Perfil

Ruta /perfil-client para clientes, /perfil-model para modelos. Se accede click en el avatar del navbar (arriba a la derecha).

Desde el perfil:
- Ver y editar datos personales (nickname, avatar, etc.).
- Botón "Cambiar contraseña" que lleva a la ruta /change-password.
- Otras acciones específicas del rol.

## Cambiar contraseña autenticado

Ruta /change-password (requiere sesión activa). Se accede desde el perfil. Formulario: contraseña actual + nueva contraseña por duplicado.

## Recuperar contraseña sin sesión

En el formulario de login hay un enlace "¿Olvidaste tu contraseña?" que lleva a la ruta pública /forgot-password. Flujo self-service completo: introducir email, recibir enlace de reset, establecer nueva contraseña. Enlace de vida limitada por seguridad.

## Idioma

Selector ES / EN en el navbar, a la izquierda del botón principal ("Comprar" para cliente, "Estadísticas" para modelo). También se puede cambiar navegando a /en o /es.

## Documentación legal y canales públicos

Footer (zona pública y autenticada) con enlaces a: FAQ, Safety, Rules (Community Guidelines), Legal y Cookie Settings. Canal público de denuncias en /complaint, accesible sin sesión.

## Errores frecuentes de indicación a evitar

- No digas "ve a la sección de pagos" ni "billing" — no existen. La compra es el botón "Comprar" del navbar del cliente.
- No digas "ve a tu perfil de modelo" para ver ganancias. Es el botón "Estadísticas" del navbar.
- No digas "ve al panel de payout". Es el botón "Retirar" del navbar modelo.
- No mandes al cliente a "revisar su perfil" o "ir a su cuenta" para ver el saldo. Está siempre visible en el navbar.
- No inventes formularios internos para cambio de email o cierre de cuenta: no existen, son via soporte.
