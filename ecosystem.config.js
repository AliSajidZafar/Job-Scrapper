// pm2 process definition for the production dashboard on the VPS.
//
// Why this exists: the site is served by a Cloudflare tunnel that points at
// localhost:3001. If the Next server ever comes up on a different port, the
// tunnel serves nothing and the site goes dark. Plain `next start` defaults to
// port 3000, so it only landed on 3001 when a PORT env happened to be passed —
// and when it wasn't, it failed with EADDRINUSE on 3000. The "start:prod" script
// (`next start -p 3001`) pins the port in code, so no matter how pm2 launches or
// resurrects this app — restart, deploy, or reboot — it always binds 3001.
//
// On the VPS, run once:  pm2 start ecosystem.config.js && pm2 save
// After that, deploys only need:  pm2 restart mvi
module.exports = {
  apps: [
    {
      name: "mvi",
      cwd: "/home/ali/mvi",
      script: "npm",
      args: "run start:prod",
      env: { NODE_ENV: "production", PORT: "3001" }, // belt-and-suspenders; the script also pins -p 3001
      autorestart: true,
      max_restarts: 20,
      min_uptime: "20s", // a crash loop faster than this stops instead of hammering
    },
  ],
};
