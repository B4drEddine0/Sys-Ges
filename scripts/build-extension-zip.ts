// Packs extension/ into public/cinema-extension.zip so the app can offer it as a
// direct download (Chrome's "Load unpacked" needs an actual folder on disk, so a
// zip the user extracts once is the simplest thing a non-technical viewer can do).
// Runs as part of `npm run build`; output is gitignored and regenerated every build.
//
// Hand-rolled (STORE method, no compression) instead of pulling in a zip library —
// the whole extension is a few KB of text files, so there's nothing to gain from
// compression, and this keeps the dependency footprint down for something this small.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = path.resolve(__dirname, '..', 'extension');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'public', 'cinema-extension.zip');

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const d = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, date: d };
}

function buildZip(files: { name: string; content: Buffer }[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.content);
    const size = file.content.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // store, no compression
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralEntries.push(Buffer.concat([centralHeader, nameBuf]));

    offset += localHeader.length + nameBuf.length + file.content.length;
  }

  const centralDir = Buffer.concat(centralEntries);
  const centralDirOffset = offset;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(centralDirOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDir, end]);
}

const files = fs
  .readdirSync(EXTENSION_DIR)
  .filter((name) => fs.statSync(path.join(EXTENSION_DIR, name)).isFile())
  .map((name) => ({ name, content: fs.readFileSync(path.join(EXTENSION_DIR, name)) }));

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, buildZip(files));
console.log(`[build-extension-zip] wrote ${OUTPUT_PATH} (${files.length} files)`);
