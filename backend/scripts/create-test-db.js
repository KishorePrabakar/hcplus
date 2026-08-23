const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const { Client } = require('pg');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${process.env.TEST_DB_SCHEMA || 'hcplus_test'}"`);
  console.log('test schema ready');
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
