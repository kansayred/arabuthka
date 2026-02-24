#!/usr/bin/env node
// ==============================================
// verify-track-urls.js
// ==============================================
// Проверка доступности файлов по URL из БД.
// Отправляет HEAD-запросы к каждому треку.
//
// Запуск: node bot/scripts/verify-track-urls.js
// ==============================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const https = require('https');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

const CONCURRENCY = 5;
const TIMEOUT = 10000;

function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: TIMEOUT }, (res) => {
      resolve({
        status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 400,
        contentType: res.headers['content-type'] || 'unknown',
        contentLength: res.headers['content-length'] || 'unknown'
      });
    });
    req.on('error', (err) => resolve({ status: 0, ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, ok: false, error: 'timeout' });
    });
    req.end();
  });
}

async function processBatch(tracks) {
  return Promise.all(tracks.map(async (track) => {
    const result = await checkUrl(track.url);
    return { ...track, ...result };
  }));
}

async function verify() {
  console.log('\n=== ПРОВЕРКА ДОСТУПНОСТИ URL ТРЕКОВ ===\n');

  try {
    const result = await pool.query(`
      SELECT id, user_id, name, url, s3_key
      FROM tracks
      ORDER BY id
    `);

    const tracks = result.rows;
    console.log(`Всего треков: ${tracks.length}\n`);

    if (tracks.length === 0) {
      console.log('Треков нет.');
      return;
    }

    let ok = 0;
    let broken = 0;
    const brokenTracks = [];

    // Обработка батчами
    for (let i = 0; i < tracks.length; i += CONCURRENCY) {
      const batch = tracks.slice(i, i + CONCURRENCY);
      const results = await processBatch(batch);

      for (const r of results) {
        if (r.ok) {
          ok++;
          process.stdout.write('.');
        } else {
          broken++;
          brokenTracks.push(r);
          process.stdout.write('X');
        }
      }
    }

    console.log('\n');

    // Отчёт
    if (brokenTracks.length > 0) {
      console.log(`Недоступные треки (${brokenTracks.length}):\n`);
      for (const track of brokenTracks) {
        console.log(`  ID: ${track.id} | ${track.name}`);
        console.log(`  URL: ${track.url}`);
        console.log(`  Статус: ${track.status} | Ошибка: ${track.error || 'нет'}`);
        console.log('  ---');
      }
    }

    console.log('\n=== ИТОГ ===');
    console.log(`Доступны: ${ok}`);
    console.log(`Недоступны: ${broken}`);
    console.log(`Всего: ${tracks.length}`);

    if (broken === 0) {
      console.log('\nВсе URL доступны!');
    }

  } catch (err) {
    console.error('Ошибка проверки:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verify();
