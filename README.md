# ⚽ Fulbito: partidos de fútbol entre amigos

Web app mobile-first (instalable como PWA) para organizar partidos:

- crear un partido y compartirlo por WhatsApp;
- anotarse como titular o suplente, con promoción automática;
- armar equipos y cargar el resultado y los goleadores;
- votar al **MVP de forma anónima**;
- ver el historial de partidos jugados.

| | |
|---|---|
| **FrontEnd** | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, PWA |
| **BackEnd** | Supabase: PostgreSQL + Auth + Row Level Security (RLS) en todas las tablas |
| **Deploy** | Vercel (FrontEnd) + Supabase (base y auth) |
| **Idioma / hora** | Español (Argentina). Las fechas se muestran en `America/Argentina/Buenos_Aires` y se guardan en UTC |

---

## Índice
1. [Estructura del repo](#estructura-del-repo)
2. [Requisitos](#requisitos)
3. [Puesta en marcha local](#puesta-en-marcha-local)
4. [Crear el proyecto en Supabase](#crear-el-proyecto-en-supabase)
5. [Configurar Auth (URLs y Google)](#configurar-auth)
6. [SMTP propio con Resend](#smtp-propio-con-resend)
7. [Variables de entorno](#variables-de-entorno)
8. [Deploy en Vercel](#deploy-en-vercel)
9. [Tests y datos de prueba](#tests-y-datos-de-prueba)
10. [Reglas de negocio y seguridad](#reglas-de-negocio-y-seguridad)

---

## Estructura del repo

```
App-Futbol/
├─ FrontEnd/                 App Next.js (lo que se deploya en Vercel)
│  ├─ app/                   Rutas: (auth) login/registro, (app) partidos, historial, admin…
│  ├─ components/            UI (formularios, plantel, equipos, resultado, MVP…)
│  ├─ lib/                   Supabase, fechas, costo, validaciones, tipos
│  ├─ proxy.ts               Refresca la sesión y protege rutas
│  └─ start.bat              Levanta la app en desarrollo (Windows)
├─ BackEnd/                  Todo lo de Supabase
│  ├─ supabase/migrations/   Migraciones SQL versionadas (tablas, RLS, funciones RPC)
│  ├─ tests/                 Tests de la base con Vitest + PGlite (sin Docker)
│  ├─ scripts/               Migraciones por ambiente, admin del sistema, datos de prueba
│  └─ start.bat              Menú de tareas del BackEnd (Windows)
└─ Docs/
   ├─ Prompt.txt             Especificación original
   └─ AMBIENTES.md           Desarrollo vs. producción y cómo publicar
```

Toda la lógica de negocio vive en **funciones de Postgres** (RPC `security definer`). La app nunca escribe directo en las tablas, así que las reglas valen aunque alguien se saltee la interfaz.

## Requisitos

- **Node.js 22 o superior** (probado con 24).
- Una cuenta de [Supabase](https://supabase.com) (alcanza con el plan gratuito).
- **No hace falta Docker**: la base de desarrollo está en la nube y los tests usan Postgres en memoria (PGlite).
- Para deployar: una cuenta de [Vercel](https://vercel.com).

## Puesta en marcha local

```bash
# 1. Dependencias
cd FrontEnd && npm install
cd ../BackEnd && npm install

# 2. Configuración (ver secciones siguientes)
#    FrontEnd/.env.local        ← copiar de FrontEnd/.env.example
#    BackEnd/.env.development   ← copiar de BackEnd/.env.example

# 3. Base de datos: migraciones y admin del sistema
cd BackEnd
npx supabase login                 # solo la primera vez
npm run db:push:dev                # aplica las migraciones al proyecto de desarrollo
npm run admin:create:dev           # crea el administrador del sistema
npm run seed:dev                   # opcional: usuarios y partidos de prueba

# 4. App
cd ../FrontEnd && npm run dev      # http://localhost:3000
```

En Windows también podés usar `BackEnd\start.bat`, un menú con todas las tareas y selector de ambiente, y `FrontEnd\start.bat`.

## Crear el proyecto en Supabase

1. En [supabase.com/dashboard](https://supabase.com/dashboard): **New project**. Elegí la región más cercana (por ejemplo, São Paulo) y guardá la contraseña de la base.
2. Anotá los datos de **Project Settings → API** (o **API Keys**):
   - **Project URL** (`https://<ref>.supabase.co`) y el **ref** (lo que va antes de `.supabase.co`);
   - **Publishable key** (`sb_publishable_…`): va en el FrontEnd;
   - **Secret key** (`sb_secret_…`): **solo** en `BackEnd/.env.*`. Nunca en el FrontEnd ni en GitHub.
3. Completá `BackEnd/.env.development` (o `.env.production`) a partir de `BackEnd/.env.example`.
4. Aplicá las migraciones: `npm run db:push:dev` (o `:prod`, que pide confirmación).
5. Creá el administrador del sistema: `npm run admin:create:dev`. Usa `SYSTEM_ADMIN_EMAIL` y `SYSTEM_ADMIN_PASSWORD` del `.env`; en producción, con una contraseña fuerte.

Hay dos proyectos de Supabase, uno para **desarrollo** y otro para **producción**. Ver [`Docs/AMBIENTES.md`](Docs/AMBIENTES.md).

## Configurar Auth

### URLs (Authentication → URL Configuration)

| Ambiente | Site URL | Redirect URLs |
|---|---|---|
| Desarrollo | `http://localhost:3000` | `http://localhost:3000/**` y `https://*-app-rst.vercel.app/**` (previews) |
| Producción | `https://<tu-dominio>` | `https://<tu-dominio>/**` |

Todos los links de auth (confirmación de email, Google y recuperar contraseña) vuelven a `/auth/callback`.

### Email y contraseña

Viene activado por defecto. Se recomienda dejar **Confirm email** activado en producción, junto con un [SMTP propio](#smtp-propio-con-resend).

*Opcional:* para que el link de confirmación funcione aunque se abra en **otro dispositivo**, cambiá la plantilla en **Authentication → Email Templates → Confirm signup** para usar:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirmar mi cuenta</a>
```

Y en **Reset password**:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Elegir contraseña nueva</a>
```

### Google

1. En [Google Cloud Console](https://console.cloud.google.com/), creá (o elegí) un proyecto.
2. Configurá la **OAuth consent screen**:
   - tipo *External*;
   - nombre de la app, email de soporte y dominio;
   - scopes `email`, `profile` y `openid`;
   - publicala para que cualquiera pueda entrar.
3. Creá las credenciales en **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - tipo **Web application**;
   - **Authorized JavaScript origins**: tu dominio, por ejemplo `https://<tu-dominio>` y `http://localhost:3000`;
   - **Authorized redirect URIs**: `https://<ref>.supabase.co/auth/v1/callback`, una por cada proyecto de Supabase.
4. Copiá el **Client ID** y el **Client secret**.
5. En Supabase, **Authentication → Sign In / Providers → Google**: activalo y pegá el Client ID y el Client secret.

La primera vez que alguien entra con Google, la app le pide completar el **celular** (y opcionalmente el apodo) antes de sumarse a un partido. El nombre y el apellido se toman de Google.

## SMTP propio con Resend

El SMTP que trae Supabase por defecto **no sirve para producción**:
- tiene un límite muy bajo de emails por hora;
- solo envía a direcciones del equipo del proyecto;
- no garantiza entregabilidad.

Con un SMTP propio, los emails de confirmación y de recuperación llegan bien y sin ese límite.

1. Creá una cuenta en [resend.com](https://resend.com).
2. **Domains → Add domain**: agregá tu dominio (por ejemplo, `fulbito.com.ar`) y cargá en tu DNS los registros que te indica (SPF y DKIM, y MX si corresponde). Esperá a que figure **Verified**.
3. En **API Keys → Create API key**, creá una con permiso *Sending access*.
4. En Supabase, **Project Settings → Authentication → SMTP Settings** → **Enable custom SMTP**:

   | Campo | Valor |
   |---|---|
   | Sender email | `no-responder@<tu-dominio>` |
   | Sender name | `Fulbito` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | la API key de Resend (`re_…`) |

5. En **Authentication → Rate Limits**, subí el límite de emails por hora (por ejemplo, a 100).
6. Probá registrar una cuenta nueva y recuperar una contraseña.

> Sin dominio propio, Resend solo permite enviar a tu propio email: alcanza para probar, no para usuarios reales.

## Variables de entorno

### FrontEnd (`FrontEnd/.env.local` en local; en Vercel, por ambiente)

| Variable | Desarrollo (local) | Vercel Preview | Vercel Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de desarrollo | URL de desarrollo | URL de **producción** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | key de desarrollo | key de desarrollo | key de **producción** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | *(vacía)* | `https://<tu-dominio>` |
| `NEXT_PUBLIC_APP_ENV` | `development` | `preview` | `production` |

Las variables `NEXT_PUBLIC_*` son públicas por diseño. La protección de los datos la da la RLS de Postgres, no ocultar la key.

### BackEnd (`BackEnd/.env.development` y `BackEnd/.env.production`)

Ver [`BackEnd/.env.example`](BackEnd/.env.example):
- `APP_ENV`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`;
- `SYSTEM_ADMIN_EMAIL` y `SYSTEM_ADMIN_PASSWORD`;
- solo en desarrollo, para los datos de prueba: `SUPABASE_PUBLISHABLE_KEY`, `SEED_PASSWORD` y `SEED_OWNER_EMAIL`.

`.gitignore` excluye todos los `.env*`, salvo los `.env.example`.

## Deploy en Vercel

1. En [vercel.com/new](https://vercel.com/new), **Import Git Repository** → `app-rst/App-Futbol`. Si no aparece, autorizá la GitHub App de Vercel para la organización.
2. **Root Directory: `FrontEnd`**. Vercel detecta Next.js solo.
3. Cargá las **Environment Variables** según la tabla de arriba, para *Production* y *Preview* por separado.
4. **Deploy**.
5. Una vez deployado:
   - en **Settings → Git**, verificá que *Production Branch* sea `main`;
   - en Supabase de producción, poné el dominio de Vercel en *Site URL* y *Redirect URLs*;
   - en Google Cloud, agregá el dominio a *Authorized JavaScript origins*.

**Flujo de trabajo:**
- se trabaja en `develop`: cada push genera una *preview* contra la base de desarrollo;
- para publicar, primero `npm run db:push:prod` si hay migraciones nuevas, y después el merge de `develop` a `main`.

Detalle completo en [`Docs/AMBIENTES.md`](Docs/AMBIENTES.md).

## Tests y datos de prueba

```bash
cd BackEnd  && npm test    # reglas de la base: promoción, cancelación, votación, RLS… (PGlite, sin Docker)
cd FrontEnd && npm test    # lógica pura: costo por jugador, fechas, celulares
cd FrontEnd && npm run lint && npm run build
```

- Los tests del BackEnd aplican **las mismas migraciones** a un Postgres en memoria y simulan usuarios reales (roles `authenticated` y `anon`, RLS y JWT).
- **Datos de prueba** (solo en desarrollo):
  - `npm run seed:dev` crea 15 jugadores ficticios y 3 partidos: lleno con suplentes, con lugares libres y terminado (para resultado y MVP);
  - `npm run seed:reset` los borra.

## Reglas de negocio y seguridad

- **Titulares y suplentes:**
  - el jugador no elige: los primeros N inscriptos son titulares y el resto suplentes, por orden de llegada;
  - si un titular se baja o lo sacan, el primer suplente pasa a titular automáticamente;
  - todo en una transacción con la fila del partido bloqueada, sin problemas de concurrencia.
- **Costo por jugador** = costo de la cancha ÷ titulares, redondeado hacia arriba al peso. Solo se muestra.
- **Fecha límite de inscripción:** es informativa, no bloquea.
- **Admin del partido:**
  - es único;
  - para bajarse tiene que pasarle el admin a otro **titular**;
  - **no puede cancelar con la lista de titulares completa**: se habilita si alguien se baja y no hay suplentes. La regla se valida en la base.
- **Privacidad:**
  - los demás jugadores solo ven el apodo (o el nombre);
  - email, apellido y celular no son visibles para otros jugadores;
  - el celular lo ve solo el admin del partido.
- **MVP anónimo:**
  - `mvp_ballots` registra *que* votaste y `mvp_votes` registra *a quién* se votó, **sin votante ni fecha**;
  - ningún rol de la app puede leer esas tablas;
  - solo se publica el MVP (o los empatados) al cerrar la votación, nunca conteos;
  - límite conocido: alguien con acceso de superusuario a la base podría intentar correlacionar el orden físico de inserción.
- **Administrador del sistema:**
  - puede ver todos los partidos y usuarios, bloquear cuentas, cancelar y sacar jugadores como moderación (queda registrado en un log);
  - tampoco puede ver los votos.

### Fuera de alcance (por ahora)

Notificaciones y recordatorios, grupos fijos de jugadores y registro de pagos. El modelo de datos permite agregarlos sin romper nada; por ejemplo, `matches.group_id` o `match_players.paid_at`.
