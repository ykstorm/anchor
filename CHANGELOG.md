# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `CONTRIBUTING.md` — development guide, PR checklist, commit convention
- Badges in `README.md` — CI status, license, TypeScript, Next.js, PRs welcome
- Project layout section in `README.md` — annotated tree of the full directory

### Changed
- `SPEC.md` title corrected from "rag-starter" to "Anchor"
- `INTERVIEW_REPORT.md` title and project URL corrected from "rag-starter" to "Anchor"
- `README.md` "How it works" section renamed "Architecture overview"
- `README.md` "What's NOT here" section renamed "Known limitations"
- `README.md` added multi-tenancy limitation entry

## [1.0.1] - 2026-05-11

### Added
- Vitest unit tests (15 passing: retriever 10, embed-writer 5)
- GitHub Actions CI (test + build jobs)
- `npm test` + `npm run test:watch` scripts
- vitest.config.ts with React plugin

### Changed
- detectAmenityCategories cross-population (atm↔bank) verified working
- chunkForProject handles zero prices and null configs gracefully