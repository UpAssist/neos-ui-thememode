# Changelog

All notable changes to this package are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows [Semantic Versioning](https://semver.org/).

## [1.0.2] - 2026-11-19

### Fixed

- Relative `url(...)` values in the light twins resolved against the page instead of the source stylesheet, so images such as the Media module's loading indicator returned 404 in light mode. They now resolve against the stylesheet's own address, also for twins cached by an older version.

[1.0.2]: https://github.com/UpAssist/neos-ui-thememode/compare/v1.0.1...v1.0.2
