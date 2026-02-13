const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const envPath = path.join(__dirname, ".env");
const env = { ...process.env, ...loadEnvFile(envPath) };

module.exports = {
  apps: [
    {
      name: "rinart",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env,
      autorestart: true,
      watch: false,
    },
  ],
};
