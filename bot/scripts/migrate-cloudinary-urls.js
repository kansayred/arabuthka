#!/usr/bin/env node
// ==============================================
// migrate-cloudinary-urls.js
// ==============================================
// Миграция URL треков с Cloudinary на Selectel S3.
// Обновляет поле url на основе s3_key.
// Треки без s3_key удаляются (осиротевшие).
//
// Запуск: node bot/scripts/migrate-cloudinary-urls.js
// Сухой запуск: node bot/scripts/migrate-cloudinary-urls.js --dry-run
// ==============================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'maneshkin';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function migrate() {
  console.log(`\n=== МИГРАЦИЯ CLOUDINARY URL → SELECTEL S3 ===${DRY_RUN ? ' (СУХОЙ ЗАПУСК)' : ''}\n`);
  console.log(`S3 Endpoint: ${S3_ENDPOINT}`);
  console.log(`S3 Bucket: ${S3_BUCKET}\n`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Найти треки с Cloudinary URL
    const cloudinaryTracks = await client.query(`
      SELECT id, user_id, name, url, s3_key
      FROM tracks
      WHERE url ILIKE '%cloudinary%'
      ORDER BY id
    `);

    console.log(`Найдено ${cloudinaryTracks.rows.length} треков с Cloudinary URL\n`);

    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    for (const track of cloudinaryTracks.rows) {
      if (track.s3_key) {
        // Есть s3_key — обновляем URL
        const newUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${track.s3_key}`;
        console.log(`  [ОБНОВЛЕНИЕ] ID ${track.id}: ${track.name}`);
        console.log(`    Старый: ${track.url}`);
        console.log(`    Новый: ${newUrl}`);

        if (!DRY_RUN) {
          await client.query('UPDATE tracks SET url = $1 WHERE id = $2', [newUrl, track.id]);
        }
        updated++;
      } else {
        // Нет s3_key — осиротевший трек, удаляем
        console.log(`  [УДАЛЕНИЕ] ID ${track.id}: ${track.name} (нет s3_key)`);
        console.log(`    URL: ${track.url}`);

        if (!DRY_RUN) {
          await client.query('DELETE FROM tracks WHERE id = $1', [track.id]);
        }
        deleted++;
      }
    }

    // 2. Найти треки с не-S3 URL (не cloudinary, но и не selcloud)
    const otherTracks = await client.query(`
      SELECT id, user_id, name, url, s3_key
      FROM tracks
      WHERE url NOT ILIKE '%selcloud%'
        AND url NOT ILIKE '%selectel%'
        AND url NOT ILIKE '%cloudinary%'
      ORDER BY id
    `);

    if (otherTracks.rows.length > 0) {
      console.log(`\nНайдено ${otherTracks.rows.length} треков с неизвестными URL:\n`);
      for (const track of otherTracks.rows) {
        if (track.s3_key) {
          const newUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${track.s3_key}`;
          console.log(`  [ОБНОВЛЕНИЕ] ID ${track.id}: ${track.name}`);
          console.log(`    Старый: ${track.url}`);
          console.log(`    Новый: ${newUrl}`);
          if (!DRY_RUN) {
            await client.query('UPDATE tracks SET url = $1 WHERE id = $2', [newUrl, track.id]);
          }
          updated++;
        } else {
          console.log(`  [ПРОПУСК] ID ${track.id}: ${track.name} (нет s3_key, URL: ${track.url})`);
          skipped++;
        }
      }
    }

    // 3. Проверка и удаление колонки cloudinary_id
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tracks' AND column_name = 'cloudinary_id'
    `);

    if (colCheck.rows.length > 0) {
      console.log('\nКолонка cloudinary_id найдена. Удаляем...');
      if (!DRY_RUN) {
        await client.query('ALTER TABLE tracks DROP COLUMN IF EXISTS cloudinary_id');
        console.log('Колонка cloudinary_id удалена.');
      } else {
        console.log('(сухой запуск — колонка не удалена)');
      }
    } else {
      console.log('\nКолонка cloudinary_id отсутствует (ок).');
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\nСухой запуск — изменения не применены.');
    } else {
      await client.query('COMMIT');
      console.log('\nТранзакция закоммичена.');
    }

    // Итог
    console.log('\n=== ИТОГ ===');
    console.log(`Обновлено URL: ${updated}`);
    console.log(`Удалено осиротевших: ${deleted}`);
    console.log(`Пропущено: ${skipped}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка миграции:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
