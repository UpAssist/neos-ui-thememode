# UpAssist.Neos.UiThemeMode

Light, dark and auto theme mode for the Neos CMS backend: the content UI and the backend modules (Media, Workspaces, User management, ...).

A toggle in the top toolbar cycles **auto → light → dark**. Auto follows the operating system (`prefers-color-scheme`) and switches live. The choice is stored per browser in `localStorage` and shared between the content UI, the modules and other open tabs.

Works with Neos 8.3+ and Neos 9, with no build step.

## Installation

```bash
composer require upassist/neos-ui-thememode
```

Then flush the caches and publish the resources:

```bash
./flow flow:cache:flush
./flow resource:publish
```

For local development against a checkout, add a path repository to the distribution's `composer.json`:

```json
{"type": "path", "url": "../neos-ui-thememode", "options": {"symlink": true}}
```

## How it works

Neos ships one dark design with hardcoded colours and hashed CSS-module class names, so there is nothing stable to override with plain CSS. Instead, `ThemeMode.js` builds the light theme at runtime:

1. It reads every loaded stylesheet through the CSSOM.
2. For each rule it copies only the colour declarations (`color`, `background-*`, `border-*-color`, `box-shadow`, `fill`, custom properties, ...) and maps the colours:
   - neutral greys are mapped along a lightness curve anchored on the Neos palette (`#141414`, `#222`, `#323232`, `#3f3f3f`, `#999`, `#fff`, ...);
   - saturated accents (brand blue, warning, error, success) keep their value;
   - translucent black (shadows, backdrops) stays as it is;
   - text on an accent background in the same rule stays as it is.
3. The resulting "twin" sheet is inserted directly after its source. Selectors, specificity and source order are unchanged, so each twin wins exactly where its original rule applied.
4. Switching theme only flips the twins' `media` attribute (`all` / `not all`). In dark mode the original Neos styles are untouched.

Twins are generated the first time light mode is needed, cached in `localStorage` (keyed by URL plus a fingerprint of the sheet), and stylesheets added later (plugins, CKEditor) are picked up through a `MutationObserver`.

Rules whose selector mentions `data-neos-theme` are skipped by the engine. Use that for hand-written fixes, as in `Resources/Public/Styles/ThemeMode.css`:

```css
html[data-neos-theme="light"] .my-plugin-thing { color: rgb(30, 30, 30); }
```

## Scope and limits

- The content iframe (your site) is never touched. The inline editing toolbar that Neos renders inside the iframe stays dark.
- Colours set inline (`style="..."` or SVG `fill` attributes) are not in a stylesheet and are not mapped. Such cases can be fixed with a `data-neos-theme` rule.
- In light mode the Neos logo in the top bar is replaced with the original primary logo (`Resources/Public/Images/neos-logo-primary.svg`, from the [Neos brand assets](https://github.com/neos/brand)). The Neos name and logo are trademarks of the Neos project and are not covered by this package's MIT license.
- Cross-origin stylesheets cannot be read and are skipped.
- The login page and the splash screen are not themed.

## JavaScript API

```js
UpAssistThemeMode.getMode();            // 'light' | 'dark' | 'auto'
UpAssistThemeMode.getEffectiveTheme();  // 'light' | 'dark'
UpAssistThemeMode.setMode('light');
const unsubscribe = UpAssistThemeMode.subscribe((mode, theme) => { /* ... */ });
```

The effective theme is also set on `<html data-neos-theme="light|dark" data-neos-theme-mode="light|dark|auto">`.

## Files

| File | Purpose |
|---|---|
| `Resources/Public/JavaScript/ThemeMode.js` | Theme engine and API, loaded in the content UI and in the modules |
| `Resources/Public/JavaScript/Toggle.js` | Toolbar toggle for the Neos UI (host plugin API, React from the host) |
| `Resources/Public/JavaScript/ModuleToggle.js` | Toggle in the top bar of the backend modules |
| `Resources/Public/Styles/ThemeMode.css` | Toggle styles and explicit light fixes (logo) |
| `Resources/Public/Images/neos-logo-primary.svg` | Original Neos logo for light backgrounds |
| `Configuration/Settings.yaml` | Registers the resources for the UI and for all modules |

## License

MIT
