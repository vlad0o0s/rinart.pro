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
      script: "server.cjs",
      cwd: __dirname,
      env: {
        ...env,
        NODE_ENV: "production",
        /**
         * Приложение падало с «JavaScript heap out of memory» под несколькими
         * одновременными запросами: оптимизатор изображений Next обрабатывает картинки
         * в памяти, а лимит кучи по умолчанию (1008 МБ) выбирался целиком.
         *
         * Прежнее значение 1400 МБ оказалось другой крайностью: на машине с 1966 МБ
         * процессу разрешалось вырасти настолько, что системе, nginx и sshd не оставалось
         * памяти. В dmesg это видно прямо — oom-killer вызывал сам nginx и убивал
         * next-server, а мягкий перезапуск pm2 не успевал сработать.
         * 896 МБ кучи оставляют около гигабайта системе; при такой куче лимит pm2
         * ниже срабатывает раньше ядра.
         */
        NODE_OPTIONS: "--max-old-space-size=896",
      },
      autorestart: true,
      watch: false,
      /**
       * Мягкий перезапуск раньше, чем сработает падение по нехватке памяти:
       * посетитель получит короткую паузу вместо оборванного соединения.
       * Порог держим выше кучи (896 МБ), но заметно ниже объёма памяти сервера,
       * чтобы перезапуск делал pm2, а не oom-killer ядра.
       */
      max_memory_restart: "1024M",
      kill_timeout: 5000,
    },
  ],
};
