import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_lbZt0SJR8kDH@ep-dry-wildflower-aq7kk5fa.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function main() {
  try {
    await client.connect();
    console.log("Connected successfully!");
    const res = await client.query('SELECT NOW()');
    console.log("Time:", res.rows[0]);
  } catch (err) {
    console.error("Error connecting:", err);
  } finally {
    await client.end();
  }
}

main();
