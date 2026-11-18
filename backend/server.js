const { createApp } = require("./src/app");
const { createDatabase } = require("./src/config/database");
const { loadEnv } = require("./src/config/env");

function start() {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    // Configuration errors never contain secret values.
    console.error(error.message);
    process.exit(1);
  }

  const app = createApp({
    sql: createDatabase(env.databaseUrl),
    jwtSecret: env.jwtSecret,
    secureCookies: env.secureCookies,
    cookieSameSite: env.cookieSameSite,
    allowedOrigins: env.allowedOrigins,
    trustProxy: env.trustProxy,
    ai: { apiKey: env.openaiApiKey, model: env.openaiModel },
  });
  const listening = () => {
    console.log(`Server running on port ${env.port} (${env.nodeEnv}); public URL ${env.backendUrl}`);
  };
  const server = env.host
    ? app.listen(env.port, env.host, listening)
    : app.listen(env.port, listening);

  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
