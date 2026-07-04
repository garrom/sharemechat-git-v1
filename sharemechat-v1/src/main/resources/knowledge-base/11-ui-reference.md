# Referencia de la UI del producto

Este fichero mapea la ubicación exacta de cada feature en la interfaz
real de SharemeChat. El Agente IA lo usa para dar indicaciones precisas
al usuario en vez de instrucciones abstractas.

## Navbar (siempre visible, arriba)

El navbar del producto autenticado se compone de dos zonas:

Zona izquierda (tabs de navegación):

1. Videochat
2. Favoritos
3. Blog
4. Icono del Agente IA (logo del bot, este mismo chat de soporte)

Zona derecha (acciones):

Cliente:
1. Saldo actual, formato "Saldo: 22,00 EUR"
2. Selector de idioma ES / EN
3. Botón "Comprar" (con icono de gema verde)
4. Botón "Salir"
5. Avatar clickable (lleva al perfil)

Modelo:
1. Texto de cola (queue) cuando aplica
2. Selector de idioma ES / EN
3. Botón "Estadísticas" (con icono de gráfico verde)
4. Botón "Retirar" (con icono de gema naranja)
5. Botón "Salir"
6. Avatar clickable (lleva al perfil)

En móvil el navbar se contrae en un menú tipo hamburguesa; los tabs
principales (Videochat, Favoritos, Blog) también se muestran en una
barra inferior. El icono del Agente IA NO aparece en la barra inferior
móvil; sí está en el menú hamburguesa.

## Dashboard cliente (ruta /client)

Al hacer login como cliente, el usuario entra directamente al dashboard.
Es UNA sola página con tabs internas (no cambia de URL entre tabs).

Vista por defecto: tab Videochat.

Para ver saldo: aparece SIEMPRE en el navbar, arriba.
Para comprar saldo: click en el botón "Comprar" del navbar.
Para chatear con favoritos: click en la tab "Favoritos".
Para hacer videochat aleatorio: click en la tab "Videochat".
Para leer el blog: click en la tab "Blog".
Para abrir soporte con el Agente IA: click en el icono del bot en el navbar.
Para ver el perfil: click en el avatar (arriba a la derecha).
Para cerrar sesión: click en el botón "Salir" del navbar.

## Dashboard modelo (ruta /model)

Al hacer login como modelo, la usuaria entra directamente al dashboard.
Estructura equivalente al del cliente pero con acciones distintas.

Para ver estadísticas / ganancias / tier / progreso: click en el botón
"Estadísticas" del navbar.
Para solicitar retiro: click en el botón "Retirar" del navbar.
Para gestionar favoritos y chatear: tab "Favoritos".
Para atender videochat aleatorio: tab "Videochat" (activar cámara para
entrar en la cola).

## Tab Favoritos (dentro de /client o /model)

Layout de 3 columnas dentro del propio dashboard:

- Columna izquierda: lista de favoritos.
- Panel central: chat de texto con el favorito seleccionado; si el
  favorito seleccionado es el Agente IA, aquí se renderiza este mismo
  chat de soporte.
- Columna derecha: espacio de videochat 1-a-1 cuando aplica.

El Agente IA aparece siempre como PRIMER favorito de la lista, con el
logo del bot y un badge "24/7".

## Tab Videochat (dentro de /client o /model)

Layout con vídeo local (cámara propia) y vídeo remoto (la otra parte)
más un chat lateral. Para iniciar matcheo el usuario debe activar la
cámara desde el propio panel.

Cliente sin verificación de edad (Didit) tiene la activación de cámara
inhabilitada hasta completar la verificación.

## Sección Comprar

No es una página aparte: se abre desde el botón "Comprar" del navbar
del cliente. Muestra los packs disponibles (10 EUR, 20 EUR con bonus,
40 EUR con bonus) y el flujo de pago.

## Perfil

Ruta /perfil-client para clientes, /perfil-model para modelos.

Se accede haciendo click en el avatar del navbar (arriba a la derecha).

Desde el perfil el usuario puede:

- Ver y editar datos personales (nickname, avatar, etc.).
- Botón "Cambiar contraseña" que lleva a la ruta /change-password.
- Otras acciones específicas del rol.

## Cambiar contraseña (autenticado)

Ruta /change-password (requiere sesión activa). Se accede desde el
perfil del usuario. El formulario pide la contraseña actual y la nueva
contraseña por duplicado.

## Recuperar contraseña olvidada (sin sesión)

Desde el formulario de login hay un enlace "¿Olvidaste tu contraseña?"
que lleva a la ruta pública /forgot-password. El flujo es self-service
completo: el usuario introduce su email, recibe un enlace de reset y
desde ahí establece una nueva contraseña. El enlace tiene tiempo
limitado por seguridad.

## Idioma

Selector ES / EN en el navbar, a la izquierda del botón principal
("Comprar" para cliente, "Estadísticas" para modelo).

El idioma también se puede cambiar navegando a /en o /es directamente.

## Documentación legal y canales públicos

En el footer de la web (tanto zona pública como autenticada) hay
enlaces a: FAQ, Safety, Rules (Community Guidelines), Legal y Cookie
Settings.

El canal público de denuncias está en la ruta /complaint, accesible
sin sesión.

---

## Notas para el Agente IA (uso interno)

- Antes de dar instrucciones tipo "ve al dashboard" o "entra en tu
  cuenta", considera que el usuario probablemente YA está en el
  dashboard: el chat de soporte se abre desde ahí (tab Favoritos, panel
  central sobre el Agente IA, o icono del bot en el navbar).

- El saldo se muestra SIEMPRE en el navbar del cliente, arriba. Nunca
  mandes al usuario a "revisar su perfil" o "ir a su cuenta" para ver
  el saldo: está a la vista.

- El botón "Comprar" está en el navbar del cliente. Nunca digas "ve a
  la sección de pagos" o "entra en billing" — no existe esa sección.

- El botón "Estadísticas" (modelo) está en el navbar. Nunca digas "ve
  a tu perfil de modelo" para ver ganancias.

- El botón "Retirar" (modelo) está en el navbar. Nunca digas "ve al
  panel de payout" o similar.

- Para cambiar la contraseña estando logueado, el camino es: avatar del
  navbar → Perfil → botón "Cambiar contraseña". Descríbelo así de
  concreto.

- Para recuperar la contraseña sin poder entrar, el usuario debe usar el
  enlace "¿Olvidaste tu contraseña?" del formulario de login. Es
  self-service completo, NO hace falta contactar con soporte.

- El bot Agente IA es siempre el primer favorito de la lista con el
  logo distintivo. Si el usuario pregunta cómo abrir soporte otra vez,
  puedes decirle que use el icono del bot del navbar o entre en
  Favoritos y clique el primer contacto de la lista.

- Cuando algo esté fuera de tu alcance (cambio de email, cierre de
  cuenta, apelación de baneo, chargebacks), el usuario debe contactar
  con el equipo de soporte por email. No inventes formularios internos
  que no existan.
