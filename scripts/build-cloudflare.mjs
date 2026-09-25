import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'cloudflare-dist');
const files = [
  'book/index.html', 'book/index.js', 'book/carousel.js', 'book/chatbot.js',
  'book/carousel.css', 'book/counter.css',
  'book/staff.html', 'book/staff.js', 'book/status.html', 'book/status.js',
  'assets/sportline-header.mp4', 'assets/og-gear-care.jpg',
];

await fs.rm(output, { recursive: true, force: true });
for (const relative of files) {
  const source = path.join(root, relative);
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}
console.log(`Built ${files.length} allowlisted static files in cloudflare-dist.`);
