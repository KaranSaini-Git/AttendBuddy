import env from './config/env.js';
import app from './app.js';
import { pool } from './config/db.js';

async function startServer() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`[Database] Connected successfully. Server time: ${res.rows[0].now}`);

    const server = app.listen(env.PORT, () => {
      console.log(`[Server] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });

    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        try {
          await pool.end();
          console.log('Database pool closed.');
          process.exit(0);
        } catch (error) {
          console.error('Error closing database pool', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
