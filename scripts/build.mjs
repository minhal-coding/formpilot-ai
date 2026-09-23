import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/panel.ts', 'src/background.ts'], bundle: true, outdir: 'dist', format: 'esm', target: 'chrome116', sourcemap: false });
console.log('Production extension built in dist/');
