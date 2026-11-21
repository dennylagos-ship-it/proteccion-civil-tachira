import {AsyncLocalStorage} from 'node:async_hooks';
import {Pool} from 'pg';

export async function connectPostgres(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({
    connectionString: url.href,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on('error', () => console.error('Se perdió una conexión inactiva de PostgreSQL.'));
  const transactionClient = new AsyncLocalStorage();

  const query = async (sql, args) => {
    let parameter = 0;
    const statement = sql.replace(/\?/g, () => '$' + ++parameter);
    const existing = transactionClient.getStore();
    if (existing) return existing.query(statement, args);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path TO aula_privada, pg_catalog');
      const result = await client.query(statement, args);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  try {
    await query('SELECT 1 FROM aula_privada.users LIMIT 1', []);
    const coverTable = 'aula_privada.course_covers';
    const hasCovers = async () => (await query('SELECT to_regclass(?) AS name', [coverTable])).rows[0].name;
    if (!await hasCovers()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(762019)');
        await client.query(`CREATE TABLE IF NOT EXISTS aula_privada.course_covers (
          course integer PRIMARY KEY REFERENCES aula_privada.courses(id) ON DELETE CASCADE,
          bytes bytea NOT NULL
        )`);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    get: async (sql, ...args) => (await query(sql, args)).rows[0],
    all: async (sql, ...args) => (await query(sql, args)).rows,
    run: (sql, ...args) => query(sql, args),
    async transaction(action) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL search_path TO aula_privada, pg_catalog');
        await client.query('SELECT pg_advisory_xact_lock(762019)');
        await transactionClient.run(client, action);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
