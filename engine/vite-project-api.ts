// Local API that lets the review window read and write the project Claude is editing.
// Only active in the local dev server (the plugin runs `npx vite`).
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/mp4', '.jpg': 'image/jpeg' };

const sendFile = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, file: string) => {
  if (!existsSync(file)) {
    res.statusCode = 404;
    return res.end();
  }
  const size = statSync(file).size;
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', size);
  createReadStream(file).pipe(res);
};

const readBody = (req: import('node:http').IncomingMessage) =>
  new Promise<string>((ok) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => ok(b));
  });

export const projectApi = (): Plugin => ({
  name: 'essence-project-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      const url = new URL(req.url, 'http://x');
      const dir = url.searchParams.get('dir');
      if (!dir) {
        res.statusCode = 400;
        return res.end('dir faltando');
      }
      const P = resolve(dir);
      const pj = join(P, 'project.json');
      const json = (o: unknown) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(o));
      };
      try {
        switch (url.pathname) {
          case '/api/projeto':
            if (req.method === 'POST') {
              writeFileSync(pj, await readBody(req));
              return json({ ok: true, mtime: statSync(pj).mtimeMs });
            }
            return json({ project: JSON.parse(readFileSync(pj, 'utf8')), mtime: statSync(pj).mtimeMs });
          case '/api/estado': {
            const draft = join(P, 'out', 'rascunho.mp4');
            const final = join(P, 'out', 'reel.mp4');
            const pedido = join(P, 'pedido.json');
            return json({
              mtime: existsSync(pj) ? statSync(pj).mtimeMs : 0,
              rascunho: existsSync(draft) ? statSync(draft).mtimeMs : 0,
              final: existsSync(final) ? statSync(final).mtimeMs : 0,
              pedidoPendente: existsSync(pedido),
              status: existsSync(join(P, 'status.txt')) ? readFileSync(join(P, 'status.txt'), 'utf8').trim() : '',
            });
          }
          case '/api/enviar':
            writeFileSync(join(P, 'pedido.json'), await readBody(req));
            return json({ ok: true });
          case '/api/video': {
            const p = JSON.parse(readFileSync(pj, 'utf8'));
            return sendFile(req, res, join(P, p.video.url));
          }
          case '/api/saida':
            return sendFile(req, res, join(P, 'out', (url.searchParams.get('f') ?? 'rascunho.mp4').replace(/[\\/]/g, '')));
          default:
            return next();
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  },
});
