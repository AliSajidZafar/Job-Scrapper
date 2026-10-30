// pm2 config for n8n on the VPS (copied to ~/n8n/). n8n needs Node 24, while the
// dashboard stays on Node 22, so the interpreter is pinned here.
// Start: pm2 start ~/n8n/ecosystem.config.js && pm2 save
const fs = require("fs");
const home = process.env.HOME;
const versions = `${home}/.nvm/versions/node`;
const v24 = fs.readdirSync(versions).filter((v) => v.startsWith("v24.")).sort().pop();
const node24 = `${versions}/${v24}/bin`;

module.exports = {
  apps: [
    {
      name: "n8n",
      script: `${node24}/n8n`,
      interpreter: `${node24}/node`,
      env: {
        PATH: `${node24}:${process.env.PATH}`,
        N8N_PORT: "5678",
        N8N_LISTEN_ADDRESS: "127.0.0.1",
        N8N_HOST: "n8n.mavericksunited.co",
        N8N_PROTOCOL: "https",
        WEBHOOK_URL: "https://n8n.mavericksunited.co/",
        N8N_PROXY_HOPS: "1",
        GENERIC_TIMEZONE: "Asia/Karachi",
        TZ: "Asia/Karachi",
        N8N_DIAGNOSTICS_ENABLED: "false",
        N8N_PERSONALIZATION_ENABLED: "false",
        EXECUTIONS_DATA_PRUNE: "true",
        EXECUTIONS_DATA_MAX_AGE: "720",
      },
    },
  ],
};
