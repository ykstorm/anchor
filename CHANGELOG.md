# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `CONTRIBUTING.md`, with a development guide, a pull request checklist and the commit convention
- Badges in `README.md` for CI status, license, TypeScript, Next.js and PRs welcome
- A project layout section in `README.md`, with an annotated tree of the full directory

### Changed
- `SPEC.md` title corrected from "rag-starter" to "Anchor"
- `README.md` "How it works" section renamed "Architecture overview"
- `README.md` "What's NOT here" section renamed "Known limitations"
- `README.md` added a multi-tenancy limitation entry

## [0.1.0] - 2026-05-11

### Added
- Vitest unit tests, 15 passing: 10 for the retriever and 5 for the embed-writer. Vitest is a test runner for TypeScript.
- GitHub Actions CI with a test job and a build job
- `npm test` and `npm run test:watch` scripts
- `vitest.config.ts` with the React plugin

### Changed
- `detectAmenityCategories` cross-population between ATM and bank verified working. A query that names one also searches for the other.
- `chunkForProject` handles zero prices and null configs.
