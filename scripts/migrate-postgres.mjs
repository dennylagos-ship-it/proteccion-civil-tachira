import {readFile} from 'node:fs/promises';
import {Client} from 'pg';

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw new Error('Falta DATABASE_URL_UNPOOLED de Neon.');

const url = new URL(connectionString);
if (!url.hostname.endsWith('.neon.tech') && !url.hostname.endsWith('.neon.com')) {
  throw new Error('La migración del aula requiere una base de datos de Neon.');
}
url.searchParams.set('sslmode', 'verify-full');
const client = new Client({connectionString: url.href});
const schema = await readFile(new URL('./aula-postgres.sql', import.meta.url), 'utf8');

await client.connect();
try {
  await client.query(schema);
  const {rows: [{tables}]} = await client.query(
    "SELECT count(*)::integer AS tables FROM information_schema.tables WHERE table_schema = 'aula_privada'",
  );
  console.log(`Esquema del aula aplicado en Neon. Tablas encontradas: ${tables}.`);
} finally {
  await client.end();
}
