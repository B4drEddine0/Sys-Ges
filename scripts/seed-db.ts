import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSeedDatabase } from '@/features/importer/markdownImporter';

const root = resolve(process.cwd());
const markdownPath = resolve(root, 'tasks.md');
const outputPath = resolve(root, 'db.json');

async function main() {
  const markdown = await readFile(markdownPath, 'utf8');
  const database = buildSeedDatabase(markdown);
  await writeFile(outputPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  console.log(`Seed database written to ${outputPath}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});