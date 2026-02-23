-- ==============================================
-- МИГРАЦИЯ 001: Переименование cloudinary_id → s3_key
-- Дата: 2026-02-23
-- Причина: Переход с Cloudinary на Selectel S3
-- ==============================================

-- Проверяем, существует ли старая колонка перед переименованием
-- (idempotent — можно запускать повторно без ошибки)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracks' AND column_name = 'cloudinary_id'
  ) THEN
    ALTER TABLE tracks RENAME COLUMN cloudinary_id TO s3_key;
    RAISE NOTICE 'Колонка cloudinary_id переименована в s3_key';
  ELSE
    RAISE NOTICE 'Колонка cloudinary_id не найдена (уже переименована?)';
  END IF;
END
$$;

-- Проверка результата:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tracks';
