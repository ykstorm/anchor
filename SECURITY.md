# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you find a security vulnerability, please report it in one of two ways.

1. Use GitHub Security Advisories, a report form on GitHub: https://github.com/ykstorm/anchor/security/advisories/new
2. Send an email to raolakshyaraj@gmail.com with "SECURITY" in the subject line.

Please do not disclose security issues publicly until a fix is available.

## Response Timeline

These times are goals, not guarantees.

- We aim to acknowledge a report within 48 hours.
- We aim to give an initial assessment within 7 days.
- The time to a fix varies with severity.

For critical vulnerabilities, please consider encrypted communication.

## Credential handling

- Secrets live only in `.env`, which is gitignored. Never commit real credentials.
- `.env.example` ships placeholders (`REPLACE_ME`) only.
- The connection strings committed in docker-compose, CI and the Dockerfile are throwaway local and CI values. You can override them with environment variables.
- Production database access must require TLS (`sslmode=require`). TLS encrypts the connection between the app and the database.

## Credential rotation

Rotate immediately if a database URL, API key, or password is exposed in a commit, log, screenshot, or CI output. To rotate a credential is to replace it with a new one and cancel the old one.

1. Provision a new credential in the provider before revoking the old one, to avoid downtime.
   - With Neon, create a new role (a database user) or reset the password in the console, then copy the updated connection string. Docs: https://neon.tech/docs/manage/roles#reset-a-password
2. Update the secret in every environment (`.env`, hosting provider secrets, CI secrets). Do not commit it.
3. Revoke the old credential. Delete the role, or rotate the password.
4. Invalidate exposed API keys (for example OpenAI) in the provider dashboard and issue replacements.
5. Purge history if needed. If a real secret was ever committed, rotate first. Then scrub the history with `git filter-repo` (a tool that rewrites git history) or the GitHub secret-scanning flow. Rotation is mandatory. A history rewrite alone is not enough.
