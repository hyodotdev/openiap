import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.SHOWCASE_DATABASE_URL;
if (!url) {
  console.error(
    'Set SHOWCASE_DATABASE_URL to the dedicated showcase database.'
  );
  process.exitCode = 1;
} else {
  try {
    const sql = neon(url);
    const source = await readFile(
      new URL('../server/showcase.sql', import.meta.url),
      'utf8'
    );
    const statements = source
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    await sql.transaction(statements.map((statement) => sql.query(statement)));
    console.log('Showcase schema initialized.');
  } catch {
    console.error(
      'Could not initialize the showcase schema. Check the database configuration.'
    );
    process.exitCode = 1;
  }
}
