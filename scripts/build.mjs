import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(path.join(root, 'src'), path.join(distDir), { recursive: true });
await cp(path.join(root, 'public'), path.join(distDir, 'public'), { recursive: true });

console.log('Build complete -> dist/');
