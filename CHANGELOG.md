# Changelog

## Unreleased

- Security updates: Next.js 16.4 (fixes a critical advisory) and PDF.js 6.4 (fixes a malicious-PDF advisory); screenplay text extraction verified after the upgrade.

## 0.1.0 - 2026-07-19

- Released the complete local Scriptlook application as open source.
- Rebuilt the README around the product story, generated output, local setup, and key-handling model.
- Added a demo-gallery hero and three full-width deck screenshots to the README.
- Removed the dormant managed-deck and local Codex generation paths so the repository has one BYOK-only architecture.
- Removed hidden development output routes, unused starter assets, and unused browser-testing dependencies.
- Removed the retired Greenlight social-preview image and Call Sheet favicon from the public source.
- Added an optional environment template and a regression test for the public repository boundary.
- Kept screenplay projects and provider keys in browser storage.
- Removed hosted accounts, payments, managed generation, and database dependencies.
- Kept the commercial-film demo corpus outside the public repository.
