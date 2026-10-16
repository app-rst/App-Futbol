# Ambientes: desarrollo y producción

La app tiene dos ambientes totalmente separados: cada uno con **su propia base de datos** (un proyecto de Supabase por ambiente), sus propias claves y su propia rama de Git.

| | Desarrollo | Producción |
|---|---|---|
| Para qué | Probar sin miedo, con datos de prueba | Lo que usan tus amigos |
| Proyecto de Supabase | El actual (de pruebas) | Uno nuevo y limpio (se crea al deployar) |
| Rama de Git | `develop` | `main` |
| App | `npm run dev` (localhost) y previews de Vercel | Vercel (dominio de producción) |
| Config del FrontEnd | `FrontEnd/.env.local` | Variables de entorno de Vercel (Production) |
| Config del BackEnd | `BackEnd/.env.development` | `BackEnd/.env.production` |
| Franja arriba en la app | 🧪 DESARROLLO / PREVIEW | (nada) |

> Ningún archivo `.env.*` se sube a GitHub; solo las plantillas `.env.example`.

---

## Día a día (desarrollo)

1. Trabajá en la rama `develop`:
   ```
   git switch develop
   ```
2. Levantá la app con `FrontEnd\start.bat`. Vas a ver la franja amarilla **🧪 DESARROLLO**.
3. Para el BackEnd abrí `BackEnd\start.bat` y elegí **D** (desarrollo). El menú tiene:
   - tests de la base, sin Docker;
   - estado y aplicación de migraciones;
   - crear el admin del sistema;
   - **crear y borrar datos de prueba**.
4. Cada cambio de base de datos es una migración nueva en `BackEnd/supabase/migrations/`. Primero se aplica en desarrollo (`npm run db:push:dev`).

### Datos de prueba

`npm run seed:dev` (opción 5 del menú) crea lo siguiente:

- **15 usuarios ficticios**, de `jugador01@dev.fulbito.test` a `jugador15@dev.fulbito.test`.
  - Su contraseña es `SEED_PASSWORD`, en `BackEnd/.env.development`.
  - Podés iniciar sesión con cualquiera para probar desde su punto de vista.
- **3 partidos** con lugar "[Prueba] …", en los que también aparece tu cuenta (`SEED_OWNER_EMAIL`):

| Partido | Situación |
|---|---|
| Lleno con suplentes | 10/10 titulares (vos incluido) + 3 suplentes. Sirve para probar bajas, la promoción y "Sacar". |
| Con lugares libres | 6/10 titulares, **vos sos el admin**. |
| Terminado hace 2 horas | 10 titulares con equipos armados y 2 suplentes. Sirve para el resultado y el MVP. |

`npm run seed:reset` (opción 6) borra los partidos y los usuarios de prueba. Tus datos reales no se tocan.

Si ya hay datos de prueba, `seed:dev` no duplica nada. Para regenerarlos, corré primero `seed:reset`.

Los scripts de datos de prueba **se niegan a correr en producción**.

---

## Crear el ambiente de producción (una sola vez, al deployar)

1. En [supabase.com](https://supabase.com), creá un **proyecto nuevo** (por ejemplo, "fulbito-prod").
2. Copiá `BackEnd/.env.example` como `BackEnd/.env.production` y completalo:
   - `APP_ENV=production`.
   - Ref, URL y secret key del proyecto **nuevo**.
   - Credenciales del admin de producción, con una **contraseña distinta** a la de desarrollo.
   - No hace falta completar las variables de datos de prueba.
3. Abrí `BackEnd\start.bat` y elegí **P**:
   - **3** para aplicar las migraciones. Te pide escribir `PRODUCCION` para confirmar.
   - **4** para crear el admin del sistema.
4. En el proyecto de producción, en **Authentication → URL Configuration**:
   - Site URL: `https://<tu-dominio-de-produccion>`.
   - Redirect URLs: `https://<tu-dominio-de-produccion>/**`.
   - Configurá también Google y el SMTP propio (ver el README, Etapa 6).
5. En Vercel, en **Settings → Environment Variables**:

| Variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de **producción** | URL de **desarrollo** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | key de **producción** | key de **desarrollo** |
| `NEXT_PUBLIC_SITE_URL` | `https://<tu-dominio>` | (vacío: usa el dominio de la preview) |
| `NEXT_PUBLIC_APP_ENV` | `production` | `preview` |

   - En **Settings → Git**, poné como **Production Branch** `main`. Así, `develop` y los PRs generan previews contra la base de desarrollo.
   - En el proyecto de Supabase de **desarrollo**, agregá a Redirect URLs `https://*-app-rst.vercel.app/**` para que funcione el login en las previews.

---

## Publicar una versión (de `develop` a `main`)

1. En `develop`: tests en verde (`npm test` en BackEnd y FrontEnd), `npm run build` y probado en desarrollo.
2. **Si hay migraciones nuevas, aplicalas primero en producción**: `BackEnd\start.bat` → **P** → **3**.
   - Las migraciones se escriben para ser compatibles con la versión anterior del código (agregan, no rompen). Por eso van antes.
3. Abrí un PR de `develop` a `main` en GitHub y mergealo. Vercel deploya producción solo.
4. Verificá en producción que la app abra y que no aparezca la franja de ambiente.

---

## Protecciones que ya están armadas

- Cada comando del BackEnd **vuelve a vincular la CLI al proyecto del ambiente elegido** antes de operar. Nunca se aplican migraciones al proyecto equivocado porque haya quedado vinculado otro.
- En producción, aplicar migraciones o crear el admin **pide escribir `PRODUCCION`**.
- Cada `.env.<ambiente>` tiene que declarar su `APP_ENV`. Si no coincide con el nombre del archivo, los scripts no corren.
- Los datos de prueba solo se crean en desarrollo. Además, se cancelan si detectan que el proyecto de desarrollo es el mismo que el de producción.
