# Changelog

All notable changes to this package are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows [Semantic Versioning](https://semver.org/).

## [1.0.4] - 2026-11-26

### Fixed

- The bottom bar of the hamburger icon in the backend modules stayed white in light mode. Neos draws it as a white `::after` block, which the engine took for a light surface and left as it was. A white `::before`/`::after` is now treated as a mark and mapped like text; this also fixes the checked radio dot, the select arrow and the hidden-page marker in the tree.

### Changed

- Coloured buttons (primary, success, warning, danger) in light mode have white text, as in dark mode, instead of anthracite text that turned white on hover. On hover they fade to a darker shade of their own colour. The engine now keeps the text white in any rule that only sets a brand-coloured background.

## [1.0.3] - 2026-11-26

### Fixed

- The bottom bar of the hamburger icon could still stay white in light mode. Chrome does not always restyle the icon's pseudo-elements when the inherited colour changes, so the bars now get explicit light colours per state (grey, brand blue when active or hovered) instead of `currentColor`.

## [1.0.2] - 2026-11-19

### Fixed

- Relative `url(...)` values in the light twins resolved against the page instead of the source stylesheet, so images such as the Media module's loading indicator returned 404 in light mode. They now resolve against the stylesheet's own address, also for twins cached by an older version.

[1.0.4]: https://github.com/UpAssist/neos-ui-thememode/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/UpAssist/neos-ui-thememode/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/UpAssist/neos-ui-thememode/compare/v1.0.1...v1.0.2
