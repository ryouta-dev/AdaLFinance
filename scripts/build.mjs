import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const assetTypes = { 'market.jpg': 'image/jpeg', 'city.jpg': 'image/jpeg', 'app.css': 'text/css; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8' };
const files = await Promise.all(Object.entries(assetTypes).map(async ([name, type]) => {
  const data = await readFile(new URL(`public/${name}`, root));
  return [`/assets/${name}`, { type, data: data.toString('base64') }];
}));

await build({
  stdin: { resolveDir: fileURLToPath(root), sourcefile: 'adal-worker.mjs', contents: `
    import app from './src/app.mjs';
    const files = ${JSON.stringify(Object.fromEntries(files))};
    function asset(path) {
      if (!Object.hasOwn(files, path)) return new Response(null, { status: 404 });
      const { type, data } = files[path];
      return new Response(Uint8Array.from(atob(data), c => c.charCodeAt(0)), {
        headers: { 'content-type': type, 'cache-control': 'public, max-age=300' }
      });
    }
    export default { fetch: (request, env) => app.fetch(request, { DB: env.DB, asset, OPENAI_API_KEY: env.OPENAI_API_KEY, OPENAI_MODEL: env.OPENAI_MODEL }) };
  ` },
  bundle: true, format: 'esm', target: 'es2022', outfile: fileURLToPath(new URL('dist/server/index.js', root))
});
await mkdir(new URL('dist/.openai/', root), { recursive: true });
await copyFile(new URL('.openai/hosting.json', root), new URL('dist/.openai/hosting.json', root));
