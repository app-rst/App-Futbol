# Ambientes

## Cómo está armado hoy: un solo proyecto de Supabase

El plan gratuito de Supabase permite **2 proyectos activos** y uno lo usa otra app. Por eso Fulbito usa **un único proyecto de Supabase, que es producción**. Todo apunta a esa misma base:

| | Base de datos | Rama de Git | Franja arriba en la app |
|---|---|---|---|
| Tu PC (`npm run dev`) | la real | la que estés usando (normalmente `develop`) | 💻 LOCAL · conectado a la base real |
| Previews de Vercel | la real | `develop` y los PRs | 🔍 PREVIEW · conectado a la base real |
| Producción (Vercel) | la real | `main` | (nada) |

| Config | Archivo |
|---|---|
| FrontEnd local | `FrontEnd/.env.local` (`NEXT_PUBLIC_APP_ENV=local`) |
| FrontEnd en Vercel | Environment Variables del proyecto en Vercel |
| BackEnd (scripts) | `BackEnd/.env.production` |

> Ningún archivo `.env.*` se sube a GitHub, solo las plantillas `.env.example`.

### Cómo se prueba sin un ambiente separado

1. **Tests locales primero.** `BackEnd\start.bat` → opción **1**, o `npm test` en BackEnd.
   - Aplican **todas las migraciones** a un Postgres en memoria y prueban las reglas: suplentes, cancelación, votos, permisos.
   - No tocan Supabase.
   - Una migración nueva se aplica a la base real recién cuando estos tests pasan.
2. **Migraciones aditivas.** Se agregan tablas, columnas o funciones; no se borra ni se renombra nada que use la versión anterior de la app.
3. **Confirmación escrita.** Aplicar migraciones, crear el admin o crear y borrar datos de prueba en producción **pide escribir** `PRODUCCION` o `PRUEBAS`.
4. **Datos de prueba invisibles para tus amigos.**
   - `npm run seed` (opción **5**) crea 15 jugadores ficticios (`jugador01…15@dev.fulbito.test`) y 3 partidos "[Prueba] …", con vos anotado (`SEED_OWNER_EMAIL`).
   - Esos partidos **solo los ven sus participantes**: a tus amigos no les aparecen. Los usuarios de prueba sí figuran en el panel del admin del sistema.
   - Cuando terminás de probar, `npm run seed:reset` (opción **6**) borra todo eso sin tocar datos reales.

| Partido de prueba | Para probar |
|---|---|
| Lleno con suplentes | Bajas, promoción del suplente, "Sacar", cancelar deshabilitado |
| Con lugares libres (vos sos admin) | Editar, equipos, pasar el admin, cancelar |
| Terminado hace 2 horas | Cargar resultado y votar al MVP |

La contraseña de los jugadores de prueba es `SEED_PASSWORD`, en `BackEnd/.env.production`.

---

## Día a día

1. Trabajá en `develop`:
   ```
   git switch develop
   ```
2. Levantá la app con `FrontEnd\start.bat`. Vas a ver la franja **💻 LOCAL**.
3. Si cambiaste la base, la migración nueva va en `BackEnd/supabase/migrations/`. Primero corren los tests (opción **1**) y después se aplica (opción **3**, con confirmación).
4. Commit y push a `develop`: Vercel genera una *preview* para probar desde el celular.

## Publicar una versión (`develop` → `main`)

1. Tests en verde: `npm test` en BackEnd y en FrontEnd, y `npm run build` en FrontEnd.
2. Si hay migraciones nuevas, que ya estén aplicadas. Son compatibles con la versión anterior, así que pueden ir antes que el código.
3. PR de `develop` a `main` en GitHub y merge. Vercel deploya producción solo.
4. Abrí la app en producción y verificá que funcione y que **no** aparezca la franja.

## Despertador

Los proyectos gratuitos de Supabase se **pausan tras 1 semana sin actividad**. Para evitarlo:
- un **Cron de Vercel** llama una vez por día a `/api/keepalive` (ver `FrontEnd/vercel.json`);
- esa ruta hace una consulta mínima (`ping()`) y exige el secreto `CRON_SECRET`, configurado en Vercel.

Si igual se pausara, se reactiva desde el dashboard de Supabase sin perder datos.

---

## Si algún día querés separar desarrollo y producción

Pasa si pagás Supabase Pro (los proyectos pagos no cuentan para el límite) o si liberás un proyecto gratuito. Todo está preparado:

1. Creá un proyecto nuevo de Supabase para **desarrollo**.
2. Copiá `BackEnd/.env.example` como `BackEnd/.env.development` con `APP_ENV=development` y los datos del proyecto nuevo.
3. `npm run db:push:dev`, `npm run admin:create:dev` y `npm run seed -- dev`.
4. En `FrontEnd/.env.local`, apuntá al proyecto de desarrollo con `NEXT_PUBLIC_APP_ENV=development`.
5. En Vercel, cambiá las variables de **Preview** al proyecto de desarrollo.

`BackEnd\start.bat` detecta que hay dos ambientes y te pregunta cuál usar. En desarrollo, los datos de prueba ya no piden confirmación.
