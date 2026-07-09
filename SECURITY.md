# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it via:

1. **GitHub Security Advisories** — https://github.com/ykstorm/anchor/security/advisories/new
2. **Email** — (include "SECURITY" in the subject line)

Please do not disclose security issues publicly until a fix is available.

## Response Timeline

- Acknowledgment: within 48 hours
- Initial assessment: within 7 days
- Fix timeline: varies by severity

For critical vulnerabilities, please consider encrypted communication.

## Credential handling

- Secrets live only in `.env` (gitignored). Never commit real credentials.
- `.env.example` ships placeholders (`REPLACE_ME`) only.
- Committed connection strings (docker-compose, CI, Dockerfile) use throwaway
  local/CI values and are overridable via environment variables.
- Production database access must require TLS (`sslmode=require`).

## Credential rotation

Rotate immediately if a database URL, API key, or password is exposed in a
commit, log, screenshot, or CI output.

1. **Provision a new credential** in the provider before revoking the old one to
   avoid downtime.
   - Neon: create a new role or reset the password in the console, then copy the
     updated connection string.
     Docs: https://neon.tech/docs/manage/roles#reset-a-password
2. **Update the secret** in every environment (`.env`, hosting provider secrets,
   CI secrets). Do **not** commit it.
3. **Revoke the old credential** (delete the role / rotate the password).
4. **Invalidate exposed API keys** (e.g. OpenAI) via the provider dashboard and
   issue replacements.
5. **Purge history if needed** — if a real secret was ever committed, rotate
   first, then scrub with `git filter-repo` or the GitHub secret-scanning flow.
   Rotation is mandatory; history rewrite alone is not sufficient.