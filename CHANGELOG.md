# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-05-11

### Added
- Vitest unit tests (15 passing: retriever 10, embed-writer 5)
- GitHub Actions CI (test + build jobs)
- `npm test` + `npm run test:watch` scripts
- vitest.config.ts with React plugin

### Changed
- detectAmenityCategories cross-population (atm↔bank) verified working
- chunkForProject handles zero prices and null configs gracefully