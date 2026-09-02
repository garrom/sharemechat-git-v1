# Debate vivo: cómo arrancar SharemeChat

> **Esto NO es un ADR ni una decisión.** Es un borrador de trabajo que vamos a
> cambiar mil veces. Aquí discutimos punto por punto, despacio y en lenguaje
> normal (sin argot). Se dice A hoy y B mañana sin problema. **Solo cuando un
> punto quede firme** se mueve a la sección "Acordado" de abajo, y de ahí —si
> toca— se saca un ADR. Mientras tanto, nada de esto es compromiso.
>
> Cómo se usa: cada punto tiene la pregunta, las opciones explicadas, y un
> estado (🟡 en debate / 🟢 acordado). Editamos sobre el mismo fichero.

---

## El problema, en una frase

Para que esto funcione necesitamos **clientes que paguen** y **chicas conectadas
al mismo tiempo**. Pero ninguno de los dos viene si el otro no está: la chica no
se conecta si no hay clientes (no gana nada), y el cliente no paga si no hay
chicas (o si tarda en salirle una). Ese es el nudo que hay que desatar. Todo lo
demás cuelga de aquí.

---

## Puntos en debate

### Punto 1 — ¿Cuántas chicas hacen falta de verdad para arrancar? 🟡

**Por qué importa:** si la respuesta es "30-100", esto es imposible tú solo. Si
es "3-5", es factible. Cambia todo.

**Lo que quiero debatir contigo:** tu producto no es un escaparate donde el
cliente ve muchas salas y unas están vacías (eso es otro tipo de web). En el
tuyo el cliente **paga y le sale UNA chica**, nunca ve el "almacén". Entonces lo
que de verdad importa no es *cuántas chicas tienes en total*, sino: **cuando un
cliente pulsa "siguiente", ¿hay una chica libre en ese instante?**

Si en una franja horaria concreta tienes, por ejemplo, 4 chicas conectadas y 10
clientes entrando poco a poco, la cosa funciona. El número "30" solo aparece si
intentas cubrir las 24 horas del día (repartes poco y todo queda vacío).

**Mi opinión (rebatible):** no necesitas 30; necesitas **pocas chicas conectadas
a la vez dentro de una franja corta**. La clave no es tener muchas, es
concentrar.

**Tu turno:** ¿lo ves así, o crees que aunque sea 1-a-1 el cliente igual "huele"
que hay poca gente y se va? (dímelo con tus palabras, aquí debajo)

---

### Punto 2 — ¿De dónde salen las chicas, y cómo las traemos? ⛔ SUPERADO por A1 (2026-09-02)

> **Este punto proponía estudios-first; se descarta.** El rumbo acordado es
> captación DIRECTA (ver *Acordado A1*). Se conserva abajo por trazabilidad del
> debate. La parte de **canales/legalidad por país** sí sigue siendo útil.

**Por qué importa:** el Punto 1 dice que bastan pocas chicas conectadas a la vez.
Vale. Pero no dice de dónde salen esas chicas. Ese es el hueco que hay que tapar,
y resulta que el sitio donde están y la forma de llegar a ellas no son los que
uno imagina.

**El hallazgo que cambia el enfoque (investigado el 2026-08-30):** la chica NO
está suelta en internet esperando que la encuentres. En Colombia —que es, con
diferencia, el mayor mercado de modelos del mundo— la chica trabaja desde un
**estudio**: un local que le pone la habitación, el equipo, la luz, la conexión y
hasta un monitor que le traduce el chat con el cliente. Por eso escribirle por
Instagram no funciona: le estarías pidiendo que renuncie a toda esa
infraestructura por una web que no conoce de nada.

**La consecuencia:** a quien conviene convencer no es a la chica una a una, es al
**dueño del estudio**. Un solo acuerdo te trae diez o quince chicas de golpe, ya
con hábito de trabajo y ya verificables. Y esto encaja con el sistema de estudios
(Master) que ya está construido en la plataforma.

**Y esto sí tiene canales concretos** (no es "haz redes sociales"):

- **FENALWEB** — la federación nacional de estudios y modelos. Un solo
  interlocutor para llegar al sector organizado. Por debajo cuelgan las
  regionales (SOMOS WEBCAM en Medellín, ASOWEBCAM.MED, ASOCAMTOL, etc.).
- **findweb.net** — un directorio de estudios verificados con contacto y
  ubicación. Sirve para armar la lista de a quién escribir en una tarde.
- **LALEXPO** (Cali) — la feria del sector en Latinoamérica, donde estudios y
  plataformas se conocen en persona. Próxima edición ~abril-mayo.

**El argumento de venta es real, no hay que inventarlo:** repartes 50-60 % del
bruto para el lado de la chica, cuando el nivel de entrada de la competencia
(LiveJasmin, BongaCams) está en 30-35 %. Para un dueño de estudio, esa diferencia
es la conversación entera.

**Lo que ya has decidido tú (30-ago), y por qué:**

- **El contacto lo haces tú**, como responsable de mercado América, directo con
  los estudios. De persona a persona, no "una plataforma europea" en frío.
- **Empezamos por estudios, pero no paramos ahí.** El canal para que una chica se
  registre por su cuenta ya está abierto y se queda: lo tienen todas las
  plataformas y no se puede excluir. Estudios primero por eficiencia (uno trae
  muchas), registro individual en paralelo como goteo, no como frente principal.

**La pregunta que el estudio hará seguro: "¿cómo y cuándo cobro?"** Respuesta
honesta de hoy: **cobro en cripto ya operativo**, y la **integración de tarjeta**
se está terminando. Es una respuesta defendible tal cual —cripto es lo normal en
el sector para pagos internacionales—, pero conviene decirla clara desde el
principio y no prometer la tarjeta como si ya estuviera lista.

**Una cosa que hay que mirar antes de firmar, no después:** el sector en Colombia
arrastra denuncias reales de coerción y explotación en algunas "casas de webcam",
muchas con mujeres venezolanas migrantes. Entrar por las asociaciones y por
estudios con sede física y trazable te pone del lado bueno de esa línea; entrar
por grupos sueltos de Telegram te mete en la misma piscina que los actores
turbios. Y como tu plataforma exige verificación de identidad real, eres tú quien
acaba teniendo los datos de cada chica: razón de más para elegir bien al
intermediario. Merece unas salvaguardas mínimas escritas (que la chica cobre de
verdad, que no haya coacción) como parte del acuerdo con el estudio.

**Mi opinión (rebatible):** el orden correcto es reclutar estudios primero, con
el 50-60 % por delante como gancho, tú de fundador a fundador, empezando por
FENALWEB y por la lista de findweb.net. El siguiente paso concreto sería preparar
el guion del primer contacto y una ficha de una página para el estudio; eso ya es
material de ejecución y va cuando cerremos este punto.

**Tu turno:** ¿te encaja el orden (estudios → registro individual como goteo), o
quieres darle más peso al registro individual desde el día uno? ¿Y hay algún tope
que te pongas tú mismo —número de estudios con los que hablar a la vez,
presupuesto de viaje a LALEXPO, etc.— que convenga anotar aquí?

---

### Punto 3 — El estudio dice sí al %, pero ¿por qué va a conectar a sus chicas si al principio ganan cero? 🟡

**Por qué importa:** este es el muro de verdad, el que tiró el plan estos meses. El
Punto 2 consigue que el dueño del estudio diga *"vale, me interesa tu %"*. Pero
decir "sí" y **poner de verdad a sus chicas a trabajar en tu web** son dos cosas
distintas — y la segunda no pasa sola.

**El problema, despacio:** un estudio es un negocio. Tiene, pongamos, 10 chicas y
cada una hace un turno. El dueño reparte esas horas entre las webs que **más le
pagan por hora**. Sus chicas ya están ganando en LiveJasmin o donde sea. Si mete
una hora en tu web y en esa hora no entra ningún cliente, esa hora ha valido
**cero** — y encima ha dejado de ganar en la web de siempre. Por muy bueno que sea
tu 50-60%, **el 50-60% de cero sigue siendo cero**. Así que, aunque le guste tu %,
no te dará horas de sus chicas hasta que vea que en tu web se gana. Y en tu web no
se gana hasta que hay chicas conectadas cuando entra un cliente. **Ese es el
círculo** — el mismo huevo y la gallina del principio, ahora del lado del estudio.

**Cómo se rompe el círculo (la ventana):** no intentes tener chicas las 24 horas
— es justo lo que hace que todo quede vacío y no se gane nunca. Haz lo contrario:
**concentra todo en una franja corta**. Por ejemplo, 2 horas, tres noches por
semana, en hora punta (España o EE. UU., lo que mejor te venga). En esa franja:

- **Pocas chicas bastan** (Punto 1): con 4-5 conectadas cubres a los clientes que
  entren.
- **Metes ahí TODO el poco tráfico de clientes que puedas conseguir**, en vez de
  repartirlo por todo el día. Así, cuando el cliente entra hay chica, y cuando la
  chica está conectada entra algún cliente. Por primera vez, las dos partes
  coinciden en el tiempo.
- **Y aquí está la pieza que desatasca:** para esas pocas horas concretas, sí
  puedes **pagar un poco a las chicas por estar conectadas** aunque no entre
  cliente (un fijo pequeño por hora, un "suelo"). Es un gasto **cerrado y
  medible** —5 chicas × 2 horas × 3 noches × poco dinero—, no un pozo sin fondo.
  Es lo único que hace que el estudio meta a sus chicas el primer día: le
  garantizas que su hora en tu web no vale cero mientras la cosa arranca. En
  cuanto entren clientes de pago de verdad, ese suelo se retira.

**Y de paso, conviertes tu debilidad en producto:** como no puedes estar abierto
24 horas, **no finjas que lo estás**. Anúncialo al revés: *"estamos en directo de
21:00 a 23:00"*. Eso concentra a los clientes en esa franja (lo que quieres), hace
que salga barato tener chicas conectadas, y le da aire de **evento** que las webs
gigantes no se molestan en montar. Tú, siendo uno solo, sí puedes.

**Mi opinión (rebatible):** el orden real de ataque no es "estudios → registro".
Es: **(1)** elegir UNA franja corta, **(2)** meter unas pocas chicas de un estudio
en esa franja pagándoles un suelo por estar, **(3)** empujar todo el tráfico de
clientes que tengas a esa misma franja. Es un experimento pequeño, barato y
medible. Si en esa franja las chicas empiezan a ganar por **clientes reales** (no
por tu suelo), ensanchas la franja. Si no, cambias algo y repites — y puedes
repetir durante años, que es tu verdadera ventaja.

**Tu turno:** ¿te chirría lo de pagar un suelo por presencia unas horas, o lo ves
como lo que es (un gasto pequeño y cerrado para arrancar)? ¿Y la idea de "noches
en vivo" como producto, en vez de fingir 24 horas — te convence o la ves floja?

---

## Acordado (firme)

### A1 — Rumbo: captación DIRECTA (plataforma → modelo), NO estudios 🟢 (2026-09-02)

Decisión del operador. **La línea principal es directa: plataforma → modelo.** Los
estudios dejan de ser la puerta de entrada y pasan a canal **secundario/oportunista**
(si una modelo viene con estudio, el sistema Master ya lo soporta; pero **no se
dedica esfuerzo** a ferias/federaciones/B2B). Esto **supersede el Punto 2** (que
proponía estudios-first).

**Motivos (del operador, compartidos):**
- El 1-a-1 de dating es **baja producción**: laptop + cámara + internet desde casa
  basta. La sala/luz/equipo del estudio es para el cam broadcast, no para este
  producto → el estudio aporta poco valor aquí.
- **Economía:** directo, la modelo se queda el **50-60% entero**. Vía estudio, el
  intermediario le come la mitad → la ventaja de "pagamos mejor" se evapora antes
  de llegar a ella. El mejor % **solo es un arma real en la relación directa**.
- El reto directo no es "no existen modelos" (frase mala corregida) — es
  **confianza + primer contacto**: una desconocida recela de una web nueva. Se
  resuelve con cómo te presentas (cara visible, oferta concreta, pago inmediato,
  fricción mínima) y **boca a boca** desde la primera bien tratada.

### A2 — Países foco 🟢

Los **legales "buenos"** del estudio de captación ([`captacion-modelos/`](captacion-modelos/)):
**Colombia, Brasil, Rumanía, México** (+ Sudáfrica). El **filtro legal** de ese
estudio sigue vigente y útil (dice de qué países captar); lo único que se anula es
su conclusión de **canal** (estudios-first). El canal ahora es **directo a la chica**.

### A3 — Sigue vivo del debate (no cerrado)

- **Punto 1** (bastan pocas chicas conectadas a la vez) — en pie.
- **Punto 3** (la ventana / suelo de presencia para arrancar) — en pie: el muro del
  cold-start (primera modelo sin clientes gana cero) **no desaparece** por ir
  directo; pero directo tiene ventaja (cuando llega el cliente, ella se lleva todo
  el % → más incentivo para aguantar).

### A4 — Próximo trabajo con esfuerzo dedicado (pendiente, sesión aparte)

**Investigación PROFUNDA y con evidencias de CÓMO llegar a la modelo directamente**,
centrada en **DOS canales, solo esos dos**:
1. **Prensa / bolsa de empleo** (anuncios tipo "trabajo desde casa").
2. **Redes — X**.

Búsqueda a fondo, con fuentes y evidencias por canal (dónde, cómo, qué mensaje, qué
funciona, coste, riesgo).

**Estado (2026-09-03): COLOMBIA hecho** (SONDA N2, mapa de datos con evidencia) →
[`captacion-modelos/canales-colombia/`](captacion-modelos/canales-colombia/00-indice-y-sintesis.md).
Titular: los 2 canales están dominados por **estudios**, no por captación directa; el
perfil "chica con audiencia propia" está en **TikTok/Instagram/OnlyFans, NO en X**;
X no se lee sin login. Falta la **fase de recomendación** (qué hacer) y repetir el
SONDA para los siguientes países (Brasil, Rumanía, México).

### A5 — A verificar antes de vender el gancho

La afirmación "ofrecemos mejores condiciones que la competencia" hay que
sostenerla con **números reales** (qué netea una modelo en LiveJasmin/CooMeet vs en
SharemeChat directo). Pendiente de comprobar.
