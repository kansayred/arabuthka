#!/usr/bin/env node
// ==============================================
// audit-cloudinary.js
// ==============================================
// Скрипт аудита: находит треки с Cloudinary URL в БД.
// Также проверяет наличие колонки cloudinary_id.
//
// Запуск: node bot/scripts/audit-cloudinary.js
// ==============================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function audit() {
  console.log('\n=== АУДИТ CLOUDINARY В БД ===\n');

  try {
    // 1. Проверяем наличие колонки cloudinary_id
    console.log('1. Проверка колонки cloudinary_id...');
    const colCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tracks'
      ORDER BY ordinal_position
    `);

    const columns = colCheck.rows.map(r => r.column_name);
    const hasCloudinaryId = columns.includes('cloudinary_id');
    const hasS3Key = columns.includes('s3_key');

    console.log(`   Колонки таблицы tracks: ${columns.join(', ')}`);
    console.log(`   cloudinary_id: ${hasCloudinaryId ? 'СУЩЕСТВУЕТ (нужно удалить)' : 'НЕТ (ок)'}`);
    console.log(`   s3_key: ${hasS3Key ? 'ЕСТЬ (ок)' : 'ОТСУТСТВУЕТ (проблема!)'}`);

    // 2. Поиск треков с Cloudinary URL
    console.log('\n2. Поиск треков с Cloudinary URL...');
    const cloudinaryTracks = await pool.query(`
      SELECT id, user_id, name, url, s3_key, created_at
      FROM tracks
      WHERE url ILIKE '%cloudinary%'
         OR url ILIKE '%res.cloudinary.com%'
      ORDER BY created_at DESC
    `);

    if (cloudinaryTracks.rows.length === 0) {
      console.log('   Треки с Cloudinary URL не найдены.');
    } else {
      console.log(`   Найдено ${cloudinaryTracks.rows.length} треков с Cloudinary URL:\n`);
      for (const track of cloudinaryTracks.rows) {
        console.log(`   ID: ${track.id}`);
        console.log(`   User: ${track.user_id}`);
        console.log(`   Name: ${track.name}`);
        console.log(`   URL: ${track.url}`);
        console.log(`   s3_key: ${track.s3_key || '(пусто)'}`);
        console.log(`   Created: ${track.created_at}`);
        console.log('   ---');
      }
    }

    // 3. Треки без s3_key
    console.log('\n3. Поиск треков без s3_key...');
    const noS3Key = await pool.query(`
      SELECT id, user_id, name, url, created_at
      FROM tracks
      WHERE s3_key IS NULL OR s3_key = ''
      ORDER BY created_at DESC
    `);

    if (noS3Key.rows.length === 0) {
      console.log('   Все треки имеют s3_key.');
    } else {
      console.log(`   Найдено ${noS3Key.rows.length} треков без s3_key:\n`);
      for (const track of noS3Key.rows) {
        console.log(`   ID: ${track.id} | User: ${track.user_id} | Name: ${track.name}`);
        console.log(`   URL: ${track.url}`);
        console.log('   ---');
      }
    }

    // 4. Общая статистика
    console.log('\n4. Общая статистика...');
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN url ILIKE '%cloudinary%' THEN 1 END) as cloudinary_urls,
        COUNT(CASE WHEN url ILIKE '%selcloud%' OR url ILIKE '%selectel%' THEN 1 END) as s3_urls,
        COUNT(CASE WHEN s3_key IS NOT NULL AND s3_key != '' THEN 1 END) as has_s3_key,
        COUNT(CASE WHEN s3_key IS NULL OR s3_key = '' THEN 1 END) as missing_s3_key
      FROM tracks
    `);

    const s = stats.rows[0];
    console.log(`   Всего треков: ${s.total}`);
    console.log(`   С Cloudinary URL: ${s.cloudinary_urls}`);
    console.log(`   С S3 URL: ${s.s3_urls}`);
    console.log(`   С s3_key: ${s.has_s3_key}`);
    console.log(`   Без s3_key: ${s.missing_s3_key}`);

    // 5. Итог
    console.log('\n=== ИТОГ ===');
    const issues = [];
    if (hasCloudinaryId) issues.push('Колонка cloudinary_id ещё существует');
    if (parseInt(s.cloudinary_urls) > 0) issues.push(`${s.cloudinary_urls} треков с Cloudinary URL`);
    if (parseInt(s.missing_s3_key) > 0) issues.push(`${s.missing_s3_key} треков без s3_key`);

    if (issues.length === 0) {
      console.log('Всё чисто! Миграция с Cloudinary завершена.');
    } else {
      console.log('Обнаружены проблемы:');
      issues.forEach(i => console.log(`  - ${i}`));
      console.log('\nЗапустите migrate-cloudinary-urls.js для исправления.');
    }

  } catch (err) {
    console.error('Ошибка аудита:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

audit();
