-- Migration 003: Add track metadata fields
-- Issue #4: Редактирование метаданных треков
-- Issue #5: Обложки альбомов и артворки треков

-- Новые поля для метаданных трека
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS album VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Индекс для поиска по исполнителю
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);

-- Индекс для поиска по альбому
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
