import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import app from './src/app.mjs';
import { localDatabase } from './src/sqlite.mjs';

const data = new URL('./.data/', import.meta.url);
await mkdir(data, { recursive: true });
const sqlite = new DatabaseSync(process.env.ADAL_DB || new URL('adal.sqlite', data));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
const migrations = new URL('./drizzle/', import.meta.url);
for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
  sqlite.exec(await readFile(new URL(name, migrations), 'utf8'));
}

const DB = localDatabase(sqlite);
const contentTypes = { '/assets/market.jpg': 'image/jpeg', '/assets/city.jpg': 'image/jpeg', '/assets/app.css': 'text/css; charset=utf-8', '/assets/app.js': 'text/javascript; charset=utf-8' };
const asset = async path => Object.hasOwn(contentTypes, path)
  ? new Response(await readFile(new URL(`./public/${path.slice(8)}`, import.meta.url)), { headers: { 'content-type': contentTypes[path] } })
  : new Response(null, { status: 404 });
const port = Number(process.env.PORT || 3600);
const host = process.env.ADAL_HOST || '127.0.0.1';

createServer(async (incoming, outgoing) => {
  try {
    let body;
    if (incoming.method === 'POST') {
      const chunks = [];
      let size = 0;
      const limit = incoming.url?.split('?')[0] === '/teacher/builder' ? 280000 : 4096;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > limit) { outgoing.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const request = new Request(new URL(incoming.url, `http://${incoming.headers.host || `localhost:${port}`}`), {
      method: incoming.method, headers: incoming.headers, body
    });
    const response = await app.fetch(request, { DB, asset, OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL, PUBLIC_DEMO: process.env.ADAL_PUBLIC_DEMO });
    const headers = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies;
    outgoing.writeHead(response.status, headers);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500).end();
  }
}).listen(port, host, () => console.log(`ADAL FINANCE 360 AI  http://${host}:${port}`));
