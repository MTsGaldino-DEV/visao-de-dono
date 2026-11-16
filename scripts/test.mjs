// Roda o Vitest com a letra do drive maiúscula.
// No Windows, se o terminal estiver em "c:\..." (minúsculo, como no VS Code), o Vitest carrega o próprio
// módulo duas vezes e todos os arquivos falham com "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const maiusculo = (caminho) => caminho.replace(/^[a-z]:/, (d) => d.toUpperCase());
const cwd = maiusculo(process.cwd());
const vitestBin = maiusculo(join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs'));
const r = spawnSync(process.execPath, [vitestBin, 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
