-- =============================================
-- ОПТИМИЗАЦИИ БАЗЫ ДАННЫХ ARABUTHKA
-- SQL-скрипты для улучшения производительности
-- =============================================

-- ---------------------------------------------
-- 1. ИНДЕКСЫ ДЛЯ УСКОРЕНИЯ ЗАПРОСОВ
-- ---------------------------------------------

-- Уже создан в server.js: idx_tracks_user_id
-- Проверка наличия индекса (для Railway/Heroku)
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);

-- Композитный индекс для сортировки по дате создания
-- Ускоряет запрос GET /tracks с ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_tracks_user_created 
ON tracks(user_id, created_at DESC);

-- Индекс для поиска по имени трека
-- Полезен для будущего функционала поиска
CREATE INDEX IF NOT EXISTS idx_tracks_name 
ON tracks(name);

-- ---------------------------------------------
-- 2. ОЧИСТКА СТАРЫХ ЗАПИСЕЙ
-- ---------------------------------------------

-- Удаление треков старше 1 года (опционально)
-- Раскомментировать при необходимости:
-- DELETE FROM tracks 
-- WHERE created_at < NOW() - INTERVAL '1 year';

-- ---------------------------------------------
-- 3. VACUUM И ANALYZE
-- ---------------------------------------------

-- Очистка "мусора" и обновление статистики для оптимизатора
-- Запускать вручную через psql или pgAdmin:
VACUUM ANALYZE tracks;

-- ---------------------------------------------
-- 4. ДОБАВЛЕНИЕ СТОЛБЦОВ ДЛЯ МЕТРИК (опционально)
-- ---------------------------------------------

-- Количество прослушиваний трека
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;

-- Последнее воспроизведение
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMP;

-- Индекс для сортировки по популярности
CREATE INDEX IF NOT EXISTS idx_tracks_play_count 
ON tracks(play_count DESC);

-- ---------------------------------------------
-- 5. ТАБЛИЦА ДЛЯ АНАЛИТИКИ (опционально)
-- ---------------------------------------------

-- Создание таблицы для хранения событий аналитики
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска событий
CREATE INDEX IF NOT EXISTS idx_analytics_user_id 
ON analytics_events(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type 
ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at 
ON analytics_events(created_at DESC);

-- ---------------------------------------------
-- 6. НАСТРОЙКИ ПРОИЗВОДИТЕЛЬНОСТИ POSTGRESQL
-- ---------------------------------------------

-- Эти настройки применяются на уровне базы данных
-- Railway/Heroku могут иметь ограничения на изменение конфигурации

-- Увеличение shared_buffers (память для кэширования)
-- ALTER SYSTEM SET shared_buffers = '256MB';

-- Увеличение work_mem (память для сортировок)
-- ALTER SYSTEM SET work_mem = '4MB';

-- Включение автовакуума (обычно уже включено)
-- ALTER SYSTEM SET autovacuum = on;

-- ---------------------------------------------
-- 7. ПАРТИЦИОНИРОВАНИЕ (для больших объемов)
-- ---------------------------------------------

-- Если треков станет очень много (>1M),
-- можно разбить таблицу по user_id или created_at:

-- CREATE TABLE tracks_partitioned (
--   id SERIAL,
--   user_id BIGINT NOT NULL,
--   name VARCHAR(255) NOT NULL,
--   url TEXT NOT NULL,
--   cloudinary_id TEXT,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE tracks_2024 PARTITION OF tracks_partitioned
-- FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- ---------------------------------------------
-- ПРИМЕЧАНИЯ
-- ---------------------------------------------

-- 1. Применение индексов:
--    psql -h <host> -U <user> -d <database> -f optimizations.sql

-- 2. Мониторинг производительности запросов:
--    EXPLAIN ANALYZE SELECT * FROM tracks WHERE user_id = 123;

-- 3. Проверка размера таблиц:
--    SELECT pg_size_pretty(pg_total_relation_size('tracks'));

-- 4. Список всех индексов:
--    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tracks';
