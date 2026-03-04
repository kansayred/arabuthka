---
name: arabuthka-deploy-check
description: Monitor Railway deploy webhooks for the Arabuthka Telegram Mini App. Use when a Railway deploy webhook fires or when asked to check Arabuthka deployment status. Parses webhook payload (status, deployment_id, commit_sha, environment), creates GitHub Issue on failure, checks /health endpoint on success.
metadata:
  author: kansayred
  version: '1.0'
---

# Arabuthka Deploy Check

## When to Use This Skill

Use this skill when:
- A Railway deploy webhook fires for the Arabuthka project
- Asked to check Arabuthka deployment status
- Need to verify the health of the Arabuthka production API

## Configuration

- **Railway Project**: `321d0e9c-62e6-4ce7-b648-e35f26c45805`
- **Railway Dashboard**: `https://railway.com/project/321d0e9c-62e6-4ce7-b648-e35f26c45805`
- **Production API**: `https://arabuthka-production.up.railway.app`
- **Health Endpoint**: `https://arabuthka-production.up.railway.app/health`
- **GitHub Repo**: `kansayred/arabuthka` (branch: `main`)
- **Vercel Preview**: `https://arabuthka-webapp.vercel.app`

## Webhook Payload Format

Railway sends a JSON payload on deploy events:

```json
{
  "type": "DEPLOY",
  "timestamp": "2025-01-01T00:00:00Z",
  "project": { "id": "...", "name": "arabuthka" },
  "environment": { "id": "...", "name": "production" },
  "deployment": {
    "id": "deployment-id",
    "status": "SUCCESS" | "FAILED" | "BUILDING" | "DEPLOYING",
    "meta": {
      "commitHash": "abc123...",
      "commitMessage": "feat: ...",
      "branch": "main"
    }
  },
  "service": { "id": "...", "name": "arabuthka" }
}
```

Note: Railway webhook payloads may vary. Key fields to extract:
- `status` — from `deployment.status` or top-level `status`
- `deployment_id` — from `deployment.id`
- `commit_sha` — from `deployment.meta.commitHash` or `meta.commitHash`
- `environment` — from `environment.name`

## Instructions

### Step 1: Parse the Webhook Payload

Extract these fields from the incoming payload:

| Field | Path | Fallback |
|---|---|---|
| status | `deployment.status` | `status` |
| deployment_id | `deployment.id` | `id` |
| commit_sha | `deployment.meta.commitHash` | `meta.commitHash` |
| environment | `environment.name` | `"production"` |
| commit_message | `deployment.meta.commitMessage` | `""` |
| branch | `deployment.meta.branch` | `"main"` |

### Step 2: Handle Based on Status

#### If status = FAILED

1. **Create a GitHub Issue** in `kansayred/arabuthka`:
   - Title: `🚨 Railway Deploy Failed — {deployment_id}`
   - Body (markdown):
     ```
     ## Deploy Failed

     | Field | Value |
     |---|---|
     | Deployment ID | `{deployment_id}` |
     | Commit | `{commit_sha}` |
     | Branch | `{branch}` |
     | Environment | `{environment}` |
     | Commit Message | {commit_message} |
     | Time | {timestamp} |

     ### Next Steps
     - Check Railway logs: https://railway.com/project/321d0e9c-62e6-4ce7-b648-e35f26c45805
     - Review the failing commit: https://github.com/kansayred/arabuthka/commit/{commit_sha}
     - Fix and push to trigger a new deploy
     ```
   - Labels: `bug`, `deploy`

2. **Log**: `[DEPLOY FAILED] {deployment_id} — commit {commit_sha} on {environment}`

3. **Notify user** about the failure

#### If status = SUCCESS

1. **Check health endpoint**:
   - Send `GET https://arabuthka-production.up.railway.app/health`
   - Wait 10 seconds after webhook to allow startup
   - Expected: HTTP 200 with JSON body containing health info
   - Retry up to 3 times with 5s delay between attempts

2. **If health check passes**:
   - Log: `[DEPLOY OK] {deployment_id} — commit {commit_sha} — health ✅`
   - No action needed

3. **If health check fails**:
   - Create GitHub Issue with title: `⚠️ Deploy succeeded but health check failed — {deployment_id}`
   - Include HTTP status code and response body in the issue
   - Log: `[DEPLOY WARN] {deployment_id} — deployed but health check failed`
   - Notify user

#### If status = BUILDING or DEPLOYING

- Log: `[DEPLOY IN PROGRESS] {deployment_id} — status: {status}`
- No action needed, wait for final status

### Step 3: Log the Result

Always log the outcome with timestamp, deployment_id, status, and any actions taken. Format:

```
[{TIMESTAMP}] Railway Deploy — {STATUS}
  Deployment: {deployment_id}
  Commit: {commit_sha} ({branch})
  Environment: {environment}
  Action: {action_taken}
```

## GitHub Issue Creation

Use the GitHub MCP connector:
- `source_id`: `github_mcp_direct`
- Tool: `issue_write`
- Parameters: `owner=kansayred`, `repo=arabuthka`, `title`, `body`, `labels`

## Health Check Details

```
GET https://arabuthka-production.up.railway.app/health
```

Expected successful response:
- HTTP 200
- JSON body with service status

If the endpoint returns non-200 or times out after 3 retries, treat as health check failure.

## Manual Verification

To manually check deployment status at any time:

1. Fetch `https://arabuthka-production.up.railway.app/health`
2. Check Railway dashboard: `https://railway.com/project/321d0e9c-62e6-4ce7-b648-e35f26c45805`
3. Check Vercel frontend: `https://arabuthka-webapp.vercel.app`
