# ==============================================
# DOCKERFILE ДЛЯ ARABUTHKA BOT API
# Оптимизированный образ для production
# ==============================================

# Базовый образ - Alpine для минимального размера
FROM node:18-alpine

# Метаданные
LABEL maintainer="Arabuthka Team"
LABEL description="Arabutka Bot API Server"
LABEL version="1.0"

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем файлы зависимостей сначала
# Это позволяет использовать кэширование Docker слоёв
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY server.js ./

# Создаём не-root пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Переключаемся на не-root пользователя
USER nodejs

# Открываем порт (Railway установит PORT автоматически)
EXPOSE 3000

# Healthcheck для мониторинга
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Запускаем сервер
CMD ["node", "server.js"]
