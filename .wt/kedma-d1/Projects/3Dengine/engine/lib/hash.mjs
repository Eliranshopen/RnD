// Streaming sha256 of a file (hex). Large render assets never load into memory whole.
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const s = createReadStream(file);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}
