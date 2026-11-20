if (!process.env.DATABASE_URL || !process.env.PUBLIC_URL?.startsWith('https://')) {
  throw new Error('Configura DATABASE_URL y PUBLIC_URL (HTTPS) en Netlify.');
}

const {server} = await import('../../server.mjs');
export default server;
