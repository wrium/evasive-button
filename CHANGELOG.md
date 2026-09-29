# Changelog

All notable changes to `@wrium/evasive-button` will be documented in this file.

## [1.1.0] - 2026-09-29

### Added - Phase 2
- **Environment & Boundary Control**: Direct support for custom boundary containers (`bounds: 'parent' | 'viewport' | selector`).
- **Movement Limits**:
  - `maxRadius`: Maximum distance constraint from the element's natural anchor.
  - `duration`: Auto-timeout in milliseconds after which evasion gives up and settles.
  - `maxAttempts`: Count limit after which evasion gives up and settles.
- **State Classes & Attributes**: Auto-manages `.is-settled`, `.is-evading`, and `data-state="settled|evading|gaveup"` for styling.
- **Lifecycle Events**: Added `@settle` (fires when button returns home) and `@giveup` (fires on timeout / max attempts).
- **Accessibility**: Automatic detection and respect for OS `prefers-reduced-motion`.
- **Form Validation Demo**: Updated login fixture demonstrating the real-world scenario where the button evades until form fields are valid, then smoothly returns home.
- **Test Coverage**: Expanded Playwright E2E suite and Vitest unit suite to verify all Phase 2 capabilities.

## [1.0.0] - 2026-09-29

### Added - Phase 1
- Initial release of `@wrium/evasive-button` plugin for Wrium.
- Directive `v-evade` and alias `v-evasive`.
- Tangential wall-deflection (wall-sliding) and anti-stuck perimeter escape mechanics.
- Event throttling and cooldown management.
- Zero-reflow position tracking.
