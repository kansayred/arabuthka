# API Documentation

> Backend API for Arabuthka - Personal Music Library in Telegram

**Base URL:** `https://arabutka-bot-production.up.railway.app`

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Upload Track](#upload-track)
  - [Get Tracks](#get-tracks)
  - [Delete Track](#delete-track)
- [Error Handling](#error-handling)
- [Data Models](#data-models)

---

## Authentication

All protected endpoints require Telegram Web App authentication via `initData`.

### How it works

1. Telegram Mini App provides `initData` string containing user information
2. Server validates the signature using `TELEGRAM_BOT_TOKEN`
3. Server checks `auth_date` freshness (max 24 hours)

### Sending auth data

| Method | Header/Param |
|--------|-------------|
| Header | `X-Telegram-Init-Data: <initData>` |
| Query | `?initData=<initData>` |

### Validation errors

```json
{
  "error": "No access - invalid initData"
}
```

**Status:** `401 Unauthorized`

---

## Rate Limiting

The API uses rate limiting to prevent abuse.

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General | 100 requests | 15 min |
| Upload | 10 files | 15 min |

### Rate limit response

```json
{
  "error": "Too many requests, please wait"
}
```

**Status:** `429 Too Many Requests`

---

## Endpoints

### Health Check

Check API and database status.

```
GET /health
```

**Auth required:** No

#### Success Response (200)

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "uptime": 3600.5
}
```

#### Error Response (503)

```json
{
  "status": "error",
  "error": "Database unavailable"
}
```

---

### Upload Track

Upload an audio file to user's library.

```
POST /upload
```

**Auth required:** Yes  
**Rate limit:** 10 per 15 min  
**Content-Type:** `multipart/form-data`

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| track | File | Yes | Audio file to upload |

#### Supported formats

| Format | MIME Type |
|--------|----------|
| MP3 | `audio/mpeg` |
| WAV | `audio/wav`, `audio/wave`, `audio/x-wav` |
| OGG | `audio/ogg` |
| M4A | `audio/mp4`, `audio/x-m4a` |
| AAC | `audio/aac` |

**Max file size:** 25 MB

#### Success Response (200)

```json
{
  "success": true,
  "track": {
    "id": 1,
    "user_id": 123456789,
    "name": "My Song",
    "url": "https://s3.ru-1.storage.selcloud.ru/arabutka/my_song.mp3",
    "s3_key": "arabutka/123456789/abcd1234",
    "created_at": "2025-01-15T12:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | File not attached | No file in request |
| 413 | File too large (max 25 MB) | Exceeds size limit |
| 415 | Unsupported format | Invalid audio format |
| 429 | Too many uploads | Rate limit exceeded |

---

### Get Tracks

Retrieve user's track library with pagination.

```
GET /tracks
```

**Auth required:** Yes

#### Query Parameters

| Param | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| page | int | 1 | >= 1 | Page number |
| limit | int | 50 | 1-100 | Tracks per page |

#### Success Response (200)

```json
{
  "tracks": [
    {
      "id": 2,
      "user_id": 123456789,
      "name": "Track Name",
      "url": "https://s3.ru-1.storage.selcloud.ru/arabutka/track.mp3",
      "s3_key": "arabutka/123456789/xyz789",
      "created_at": "2025-01-15T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid parameters | page < 1 or limit out of range |
| 500 | Failed to get tracks | Database error |

---

### Delete Track

Remove a track from user's library.

```
DELETE /tracks/:id
```

**Auth required:** Yes

#### URL Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | int | Track ID to delete |

#### Success Response (200)

```json
{
  "success": true
}
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Track not found | Track doesn't exist or belongs to another user |
| 500 | Deletion error | Failed to delete from database/cloud |

---

## Error Handling

### Standard Error Format

```json
{
  "error": "Error message",
  "status": 500
}
```

In development mode, stack trace is included:

```json
{
  "error": "Error message",
  "status": 500,
  "stack": "Error: ...\n    at ..."
}
```

### 404 Not Found

```json
{
  "error": "Route not found",
  "path": "/unknown",
  "method": "GET"
}
```

---

## Data Models

### Track

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique identifier |
| user_id | bigint | Telegram user ID |
| name | string | Track name (without extension) |
| url | string | Selectel S3 URL for streaming |
| s3_key | string | S3 object key |
| created_at | timestamp | Upload timestamp |

### Database Schema

```sql
CREATE TABLE tracks (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  s3_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracks_user_id ON tracks(user_id);
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| TELEGRAM_BOT_TOKEN | Yes | Bot token for auth validation |
| S3_BUCKET_NAME | Yes | S3 bucket name |
| S3_ACCESS_KEY | Yes | S3 access key |
| S3_SECRET_KEY | Yes | S3 secret key |
| PORT | No | Server port (default: 3000) |
| RAILWAY_ENVIRONMENT | No | Set by Railway in production |
| RAILWAY_PUBLIC_DOMAIN | No | Public domain for CORS |

---

## Security Features

- **CORS** - Whitelist of allowed origins + Vercel previews
- **Rate Limiting** - Protection from spam and abuse
- **HTTP Security Headers** - XSS, clickjacking protection
- **Telegram Auth** - Cryptographic validation of user identity
- **Auth Expiry** - initData expires after 24 hours
- **File Validation** - MIME type and extension checks

---

## Example: cURL

### Upload a track

```bash
curl -X POST https://arabutka-bot-production.up.railway.app/upload \
  -H "X-Telegram-Init-Data: <your_init_data>" \
  -F "track=@/path/to/song.mp3"
```

### Get tracks

```bash
curl https://arabutka-bot-production.up.railway.app/tracks?page=1&limit=10 \
  -H "X-Telegram-Init-Data: <your_init_data>"
```

### Delete a track

```bash
curl -X DELETE https://arabutka-bot-production.up.railway.app/tracks/1 \
  -H "X-Telegram-Init-Data: <your_init_data>"
```
