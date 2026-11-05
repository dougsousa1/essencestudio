// Usage: node engine/esperar.mjs "<project folder>"
// Waits until the person presses "Enviar para o Claude" in the review window,
// prints the request and archives it. Run it in the background and act when it exits.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const file = join(dir, 'pedido.json');
const started = Date.now();
while (!existsSync(file)) {
  if (Date.now() - started > 1000 * 60 * 60) {
    console.log('Nenhum pedido em 1 hora.');
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
const pedido = readFileSync(file, 'utf8');
renameSync(file, join(dir, 'pedido-anterior.json'));
writeFileSync(join(dir, 'status.txt'), 'O Claude recebeu o seu pedido');
console.log(pedido);
