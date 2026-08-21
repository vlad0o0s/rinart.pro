#!/usr/bin/env bash
#
# Деплой без простоя.
#
# Раньше `npm run build` писал прямо в .next под работающим приложением: сервер терял свои
# файлы, падал с «Could not find a production build» и перезапускался — сайт лежал всю сборку.
# Здесь сборка идёт в отдельный каталог, пока прод продолжает работать на старом, и только
# готовый результат подменяется — переключение занимает миллисекунды.
#
# Использование:  ./scripts/deploy.sh
#
set -euo pipefail

APP_DIR="/home/rinart.pro"
APP_NAME="rinart"
BUILD_DIR=".next-build"
PREV_DIR=".next-prev"
HEALTH_URL="http://127.0.0.1:3000/"

cd "$APP_DIR"

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"; }

log "Сборка в $BUILD_DIR (сайт продолжает работать на текущей версии)"
rm -rf "$BUILD_DIR"
# На сервере всего два ядра, и сборка забирала их почти целиком: приложение не успевало
# отвечать, часть запросов отваливалась по таймауту. Отдаём сборке низший приоритет
# по процессору и диску — она идёт дольше, зато посетители не замечают деплой.
# Ограничение памяти Node страхует от ухода сервера в своп.
nice -n 19 ionice -c3 env \
  NEXT_DIST_DIR="$BUILD_DIR" \
  NODE_OPTIONS="--max-old-space-size=1024" \
  npm run build

# Пустой каталог или сборка без манифеста означают, что подменять нечего.
if [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
  log "ОШИБКА: сборка не создала $BUILD_DIR/BUILD_ID. Прод не тронут."
  exit 1
fi

# Кеш оптимизированных картинок лежит внутри каталога сборки. Без переноса каждый деплой
# заставлял сервер пережимать все изображения заново — на слабой машине это и приводило
# к нехватке памяти и обрывам соединений сразу после выкладки.
if [ -d ".next/cache" ]; then
  log "Перенос кеша изображений в новую сборку"
  mkdir -p "$BUILD_DIR/cache"
  cp -a .next/cache/. "$BUILD_DIR/cache/" 2>/dev/null || true
fi

log "Подмена каталога сборки"
rm -rf "$PREV_DIR"
# Прежнюю сборку сохраняем: она нужна для отката, если новая окажется нерабочей.
if [ -d ".next" ]; then
  mv .next "$PREV_DIR"
fi
mv "$BUILD_DIR" .next

log "Перезапуск приложения"
pm2 reload "$APP_NAME" --update-env

# Ждём, пока сервер начнёт отвечать: reload поднимает процесс за пару секунд,
# но подтверждение важнее предположения.
# Проверяем через node: curl на этом сервере стабильно убивается сигналом (exit 137),
# из-за чего проверка ложно сообщала о недоступности исправного сайта.
log "Проверка доступности"
for i in $(seq 1 30); do
  if node -e "
    require('http').get('$HEALTH_URL', (r) => process.exit(r.statusCode === 200 ? 0 : 1))
      .on('error', () => process.exit(1))
      .setTimeout(5000, function () { this.destroy(); process.exit(1); });
  " 2>/dev/null; then
    log "Готово: сайт отвечает 200 (попытка $i), BUILD_ID $(cat .next/BUILD_ID)"
    exit 0
  fi
  sleep 2
done

log "ВНИМАНИЕ: сайт не ответил 200 за 60 секунд. Откат командой:"
echo "  cd $APP_DIR && rm -rf .next && mv $PREV_DIR .next && pm2 reload $APP_NAME"
exit 1
