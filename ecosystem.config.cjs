// PM2 process config — usage: pm2 start ecosystem.config.cjs
// Ports differ from the main site (gymbash.ir) and bind to localhost only;
// Nginx proxies music.gymbash.ir -> 127.0.0.1:3100.
const path = require("path");

const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: "musicma-web",
      cwd: path.join(ROOT, "apps", "web"),
      script: path.join(ROOT, "apps", "web", "node_modules", ".bin", "next"),
      args: "start -H 127.0.0.1 -p 3100",
      env: { NODE_ENV: "production" },
      max_restarts: 5,
      restart_delay: 3000,
    },
    {
      name: "musicma-stream",
      cwd: path.join(ROOT, "workers", "telegram-stream"),
      script: path.join(ROOT, "workers", "telegram-stream", ".venv", "bin", "python"),
      args: "-m uvicorn app:app --host 127.0.0.1 --port 8091",
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
