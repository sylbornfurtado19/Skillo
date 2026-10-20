import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'node_modules', 'onnxruntime-web', 'dist');
const targetDir = path.join(rootDir, 'public', 'wasm');

if (!fs.existsSync(distDir)) {
  console.warn('[copy-onnx-wasm] onnxruntime-web dist directory not found. Skipping wasm copy.');
  process.exit(0);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Find all ONNX Runtime Web wasm and mjs files (matching ort-wasm-*)
const files = fs.readdirSync(distDir).filter((file) => {
  return file.startsWith('ort-wasm-') && (file.endsWith('.wasm') || file.endsWith('.mjs'));
});

if (files.length === 0) {
  console.warn('[copy-onnx-wasm] No ort-wasm-* files found in onnxruntime-web/dist.');
  process.exit(0);
}

let copiedCount = 0;
for (const file of files) {
  const src = path.join(distDir, file);
  const dest = path.join(targetDir, file);

  if (fs.existsSync(dest)) {
    const srcStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    if (srcStat.size === destStat.size) {
      continue;
    }
  }

  fs.copyFileSync(src, dest);
  copiedCount++;
}

console.log(
  `[copy-onnx-wasm] Successfully synchronized ${copiedCount} ONNX wasm/mjs files to ${targetDir} (existing MediaPipe assets preserved).`
);
