# Protección Civil Táchira

Portal de formación con aula virtual, panel docente, administración y verificación de certificados. Node.js 24 o superior y SQLite. Los materiales, las cuentas y el progreso se almacenan en el servidor.

## Inicio local

1. Ejecuta `npm ci`.
2. Copia `.env.example` a `.env`. Define tu correo y una contraseña única de al menos 10 caracteres. En el primer inicio se crea la cuenta administradora.
3. Ejecuta `npm start` y abre [http://localhost:3000](http://localhost:3000).

Activa `SEED_DEMO=1` para precargar cuatro cursos publicados en una base sin cursos y con una cuenta administradora. Cada uno incluye tres lecciones, una actividad descargable y una evaluación. Usa otro valor de `DATA_DIR` para mantener la demostración separada de los datos institucionales.

## Operación

- Administración crea cuentas docentes y consulta los usuarios y cursos. El docente crea un borrador, agrega las clases y los adjuntos de hasta 8 MB, prepara las evaluaciones y publica el curso. La publicación congela clases y evaluaciones para conservar los requisitos que aplican a las inscripciones del curso.
- Cada evaluación admite selección única, selección múltiple, verdadero o falso, respuesta corta, respuesta numérica y ordenamiento. El servidor califica al enviar y permite nuevos intentos.
- El estudiante se registra, se inscribe, completa todas las clases y aprueba cada evaluación con al menos 70 %. Después puede emitir su certificado, descargar el PDF con el contenido programático en el reverso y compartir el enlace de verificación. El docente puede indicar un tema por línea al crear el curso. Si el campo queda vacío, el certificado usa los títulos de las clases en orden.
- El código y el QR llevan a la verificación sin inicio de sesión. La consulta muestra el nombre registrado, curso, fechas y estado. El certificado vence dos años calendario después de su emisión y puede consultarse tras el vencimiento.

## Servidor público

Ejecuta la aplicación con almacenamiento persistente para `DATA_DIR` y configura `PUBLIC_URL` con el origen HTTPS estable, por ejemplo `https://aula.example.org`. La aplicación escucha en `127.0.0.1:3000` por defecto. Configura `HOST` y `PORT` según el alojamiento y publica el servicio detrás de un proxy HTTPS. Mantén copias de seguridad de SQLite con el servidor detenido o mediante una copia consistente de SQLite.

El QR usa `PUBLIC_URL`. Si se omite, apunta al servidor local y sirve para pruebas en el equipo anfitrión.

## Neon y Netlify

1. Vincula la CLI de Neon al proyecto exclusivo del aula con `neon init` y ejecuta `neon deploy` con el servicio Postgres. La CLI guarda las cadenas de conexión en `.env.local` o en el archivo `.env` existente.
2. Ejecuta `npm run db:migrate` para preparar las tablas en Neon mediante la conexión directa `DATABASE_URL_UNPOOLED`. El servidor usa `DATABASE_URL` para guardar cuentas, sesiones, cursos, archivos, inscripciones, avances y certificados. Ejecuta `npm run build` para validar la sintaxis y `npm start` para iniciar el servidor local.
3. Vincula el repositorio de GitHub a un proyecto de Netlify con acceso a **Netlify Server**. Configura `DATABASE_URL`, `PUBLIC_URL` (el origen HTTPS del portal), `ADMIN_EMAIL` y `ADMIN_PASSWORD` como variables de ejecución con alcance Functions. Usa `SEED_DEMO=1` solo si quieres llenar una base de prueba sin cursos.
4. Después del despliegue, comprueba desde un dispositivo externo el registro, el inicio de sesión, una inscripción y la verificación de un certificado.

Las bases SQLite locales y las credenciales se excluyen del repositorio. Si necesitas trasladar datos existentes a Neon, importa los datos antes de habilitar el acceso público.
