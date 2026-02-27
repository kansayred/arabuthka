# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Contact: **@kansayred** via Telegram or GitHub
3. Include: description, reproduction steps, potential impact
4. We aim to respond within 48 hours

## Security Measures

### Authentication
- Telegram initData validation via HMAC-SHA256
- `crypto.timingSafeEqual()` for hash comparison (prevents timing attacks)
- auth_date freshness check (24h TTL + future timestamp rejection)
- initData accepted only via `X-Telegram-Init-Data` header (not query params)

### Transport
- HTTPS enforced (Railway + Vercel)
- Helmet.js security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS whitelist with Vercel preview regex validation

### Rate Limiting
- General: 100 requests / 15 min per IP
- Upload: 10 requests / 15 min per IP
- Trust proxy configured for Railway reverse proxy

### Data Storage
- PostgreSQL with parameterized queries (SQL injection protection)
- Files stored in Selectel S3 (private bucket)
- No plaintext secrets in code (env variables only)

### Upload Security
- MIME type AND file extension validation (both required)
- 25MB file size limit
- Allowed formats: MP3, WAV, OGG, M4A, AAC

### Streaming Security
- URL whitelist for proxy requests (SSRF protection)
- Allowed hosts: selcloud.ru, cloudinary.com
- Private IP ranges blocked

### Error Handling
- Stack traces hidden in production
- Centralized error logging via Sentry
- Graceful shutdown on SIGTERM/SIGINT

## Threat Model

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| SQL Injection | Parameterized queries | Done |
| XSS | Helmet CSP headers, input sanitization | Partial |
| CSRF | CORS whitelist, Telegram auth | Done |
| SSRF | URL whitelist for proxy | Done |
| Timing Attacks | timingSafeEqual | Done |
| Replay Attacks | auth_date TTL (24h) | Done |
| File Upload Abuse | MIME+ext check, size limit | Done |
| Brute Force | Rate limiting | Done |
| Token Leakage | Header-only auth (no query params) | Done |

## Dependencies

Regularly audit with:
```bash
npm audit
npm audit fix
```

## Changelog

- **2026-02-27**: Timing-safe HMAC comparison, SSRF protection, MIME filter fix
- **2026-02-26**: Initial security audit (FIX 1-7)
