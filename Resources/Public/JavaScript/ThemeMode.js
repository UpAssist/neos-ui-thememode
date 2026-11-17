/*
 * UpAssist.Neos.UiThemeMode: theme engine
 *
 * The Neos UI and the backend modules ship a dark design with hardcoded
 * colours and hashed class names, so there is nothing to override with plain
 * CSS. This script reads the loaded stylesheets at runtime and writes a light
 * twin for each one: the same selectors, only the colour declarations, with
 * the dark palette mapped to a light one. Each twin is inserted directly
 * after its source sheet, so specificity and source order stay the same and
 * the twin wins exactly where the original rule applied. Switching theme only
 * flips the twins' media attribute.
 *
 * Public API (window.UpAssistThemeMode):
 *   getMode()            'light' | 'dark' | 'auto'
 *   getEffectiveTheme()  'light' | 'dark'
 *   setMode(mode)
 *   subscribe(fn)        fn(mode, effectiveTheme), returns an unsubscribe function
 */
(function () {
    'use strict';

    if (window.UpAssistThemeMode) {
        return;
    }

    var VERSION = '2';
    var STORAGE_KEY = 'upassist.neos.themeMode';
    var CACHE_PREFIX = 'upassist.neos.themeMode.css.v' + VERSION + ':';
    var MAX_CACHE_LENGTH = 1500000;
    var MODES = ['light', 'dark', 'auto'];
    var DEFAULT_MODE = 'auto';
    var MARKER = 'data-upassist-thememode';

    var root = document.documentElement;
    var prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var listeners = [];
    var twins = [];
    var processed = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var generating = false;
    var mode = readMode();

    // ---------------------------------------------------------------------
    // Mode handling
    // ---------------------------------------------------------------------

    function readMode() {
        try {
            var stored = window.localStorage.getItem(STORAGE_KEY);
            if (MODES.indexOf(stored) !== -1) {
                return stored;
            }
        } catch (e) {
            // storage blocked: fall back to the default
        }
        return DEFAULT_MODE;
    }

    function effectiveTheme() {
        if (mode === 'auto') {
            return prefersDark && !prefersDark.matches ? 'light' : 'dark';
        }
        return mode;
    }

    function apply() {
        var theme = effectiveTheme();
        root.setAttribute('data-neos-theme', theme);
        root.setAttribute('data-neos-theme-mode', mode);

        if (theme === 'light' && !generating) {
            generating = true;
            scan();
        }

        var media = theme === 'light' ? 'all' : 'not all';
        for (var i = 0; i < twins.length; i++) {
            if (twins[i].media !== media) {
                twins[i].media = media;
            }
        }

        for (var j = 0; j < listeners.length; j++) {
            try {
                listeners[j](mode, theme);
            } catch (e) {
                if (window.console) {
                    window.console.error(e);
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Colour mapping
    // ---------------------------------------------------------------------

    // Lightness of a neutral colour in the dark design -> lightness in the
    // light design. Anchors are the Neos UI greys (#141414, #222, #323232,
    // #3f3f3f, #5b5b5b, #999, #adadad, #ccc, #eee, #fff).
    var CURVE = [
        [0, 255], [20, 255], [34, 244], [50, 233], [63, 214], [91, 184],
        [153, 108], [173, 94], [204, 72], [238, 48], [255, 30]
    ];

    function curve(lightness) {
        for (var i = 1; i < CURVE.length; i++) {
            if (lightness <= CURVE[i][0]) {
                var a = CURVE[i - 1];
                var b = CURVE[i];
                return a[1] + (b[1] - a[1]) * (lightness - a[0]) / (b[0] - a[0]);
            }
        }
        return CURVE[CURVE.length - 1][1];
    }

    function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function toHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var l = (max + min) / 2;
        var h = 0;
        var s = 0;
        if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) {
                h = (g - b) / d + (g < b ? 6 : 0);
            } else if (max === g) {
                h = (b - r) / d + 2;
            } else {
                h = (r - g) / d + 4;
            }
            h /= 6;
        }
        return [h, s, l];
    }

    function fromHsl(h, s, l) {
        if (s === 0) {
            return [l * 255, l * 255, l * 255];
        }
        function channel(p, q, t) {
            if (t < 0) { t += 1; }
            if (t > 1) { t -= 1; }
            if (t < 1 / 6) { return p + (q - p) * 6 * t; }
            if (t < 1 / 2) { return q; }
            if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
            return p;
        }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        return [channel(p, q, h + 1 / 3) * 255, channel(p, q, h) * 255, channel(p, q, h - 1 / 3) * 255];
    }

    // Saturated colours with real lightness are accents (brand blue, warning
    // orange, error red, success green) and keep their value.
    function isAccent(rgba) {
        var hsl = toHsl(rgba[0], rgba[1], rgba[2]);
        return hsl[1] > 0.2 && hsl[2] >= 0.22 && rgba[3] > 0.5;
    }

    function mapRgba(rgba) {
        var r = rgba[0];
        var g = rgba[1];
        var b = rgba[2];
        var a = rgba[3];
        if (a === 0) {
            return rgba;
        }
        var hsl = toHsl(r, g, b);
        var lightness = hsl[2] * 255;

        // Translucent black is a shadow or a backdrop: it works on light too.
        if (a < 1 && lightness < 60) {
            return rgba;
        }

        if (hsl[1] <= 0.2) {
            var shift = curve(lightness) - lightness;
            return [clamp(r + shift), clamp(g + shift), clamp(b + shift), a];
        }

        // Dark tinted surface: keep hue and saturation, flip lightness.
        if (hsl[2] < 0.22) {
            var rgb = fromHsl(hsl[0], hsl[1], curve(lightness) / 255);
            return [clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2]), a];
        }

        return rgba;
    }

    function formatRgba(rgba) {
        if (rgba[3] >= 1) {
            return 'rgb(' + rgba[0] + ', ' + rgba[1] + ', ' + rgba[2] + ')';
        }
        return 'rgba(' + rgba[0] + ', ' + rgba[1] + ', ' + rgba[2] + ', ' + Math.round(rgba[3] * 1000) / 1000 + ')';
    }

    var NAMED = {
        white: [255, 255, 255, 1],
        black: [0, 0, 0, 1]
    };

    var COLOR_RE = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(rgba?|hsla?)\(([^()]*)\)|(?<![-\w])(white|black)(?![-\w])/gi;
    var URL_RE = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi;

    function parseHex(hex) {
        if (hex.length <= 4) {
            hex = hex.replace(/./g, '$&$&');
        }
        var a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), a];
    }

    function parseNumber(part, scale) {
        var value = parseFloat(part);
        if (isNaN(value)) {
            return null;
        }
        return part.indexOf('%') !== -1 ? value / 100 * scale : value;
    }

    function parseFunction(name, args) {
        var parts = args.split(/[\s,\/]+/).filter(Boolean);
        if (parts.length < 3) {
            return null;
        }
        var alpha = parts.length > 3 ? parseNumber(parts[3], 1) : 1;
        if (alpha === null) {
            return null;
        }
        if (name.charAt(0) === 'r') {
            var r = parseNumber(parts[0], 255);
            var g = parseNumber(parts[1], 255);
            var b = parseNumber(parts[2], 255);
            if (r === null || g === null || b === null) {
                return null;
            }
            return [clamp(r), clamp(g), clamp(b), alpha];
        }
        var h = parseFloat(parts[0]);
        var s = parseFloat(parts[1]) / 100;
        var l = parseFloat(parts[2]) / 100;
        if (isNaN(h) || isNaN(s) || isNaN(l)) {
            return null;
        }
        var rgb = fromHsl(((h % 360) + 360) % 360 / 360, s, l);
        return [clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2]), alpha];
    }

    function parseColor(match, hex, fn, args, named) {
        if (hex) {
            return parseHex(hex);
        }
        if (fn) {
            return args.indexOf('var(') === -1 ? parseFunction(fn.toLowerCase(), args) : null;
        }
        return NAMED[named.toLowerCase()].slice();
    }

    function mapColors(segment) {
        return segment.replace(COLOR_RE, function (match, hex, fn, args, named) {
            var rgba = parseColor(match, hex, fn, args, named);
            return rgba ? formatRgba(mapRgba(rgba)) : match;
        });
    }

    // Colours inside url(...) (data URI icons, file names) stay untouched.
    function mapValue(value) {
        var out = '';
        var last = 0;
        var match;
        URL_RE.lastIndex = 0;
        while ((match = URL_RE.exec(value)) !== null) {
            out += mapColors(value.slice(last, match.index)) + match[0];
            last = match.index + match[0].length;
        }
        return out + mapColors(value.slice(last));
    }

    function firstColor(value) {
        COLOR_RE.lastIndex = 0;
        var match = COLOR_RE.exec(value);
        COLOR_RE.lastIndex = 0;
        return match ? parseColor(match[0], match[1], match[2], match[3], match[4]) : null;
    }

    // ---------------------------------------------------------------------
    // Stylesheet twins
    // ---------------------------------------------------------------------

    var TEXT_PROPS = /^(color|-webkit-text-fill-color|-webkit-text-stroke-color|caret-color|text-decoration-color|text-emphasis-color|fill|stroke)$/;

    function isColorProperty(property) {
        return /color$/.test(property)
            || property === 'background-image'
            || property === 'box-shadow'
            || property === 'text-shadow'
            || property === 'fill'
            || property === 'stroke'
            || property === 'border-image-source';
    }

    function styleRule(rule) {
        // Rules written for a specific theme are applied as authored.
        if (rule.selectorText.indexOf('data-neos-theme') !== -1) {
            return '';
        }
        var style = rule.style;
        var declarations = '';

        // White text on a brand-coloured background stays white.
        var background = firstColor(style.getPropertyValue('background-color'));
        var keepText = background !== null && isAccent(background);

        for (var i = 0; i < style.length; i++) {
            var property = style[i];
            var custom = property.charCodeAt(0) === 45 && property.charCodeAt(1) === 45;
            if (!custom && !isColorProperty(property)) {
                continue;
            }
            var value = style.getPropertyValue(property);
            if (!value) {
                continue;
            }
            // Every colour declaration is copied, changed or not, so the
            // cascade between the twins matches the cascade of the originals.
            var mapped = keepText && TEXT_PROPS.test(property) ? value : mapValue(value);
            declarations += property + ':' + mapped + (style.getPropertyPriority(property) ? ' !important' : '') + ';';
        }

        var nested = rule.cssRules && rule.cssRules.length ? walk(rule.cssRules) : '';
        if (!declarations && !nested) {
            return '';
        }
        return rule.selectorText + '{' + declarations + nested + '}';
    }

    function readRules(sheet) {
        try {
            return sheet.cssRules;
        } catch (e) {
            return null; // cross-origin sheet
        }
    }

    function walk(rules) {
        var out = '';
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            try {
                if (rule.selectorText !== undefined && rule.style) {
                    out += styleRule(rule);
                } else if (rule.type === 3 && rule.styleSheet) {
                    var imported = readRules(rule.styleSheet);
                    out += imported ? walk(imported) : '';
                } else if (rule.type === 7) {
                    continue; // keyframes
                } else if (rule.cssRules) {
                    var inner = walk(rule.cssRules);
                    if (!inner) {
                        continue;
                    }
                    var prelude;
                    if (rule.type === 4) {
                        prelude = '@media ' + rule.media.mediaText;
                    } else if (rule.type === 12) {
                        prelude = '@supports ' + rule.conditionText;
                    } else {
                        var text = rule.cssText;
                        prelude = text.slice(0, text.indexOf('{')).trim();
                    }
                    out += prelude + '{' + inner + '}';
                }
            } catch (e) {
                // a single odd rule must not break the whole sheet
            }
        }
        return out;
    }

    // Not every Neos stylesheet has a cache-busting query string, so the key
    // also carries a cheap fingerprint of the sheet: its rule count and the
    // length of its last rule.
    function cacheKey(node) {
        if (node.tagName !== 'LINK' || !node.href) {
            return null;
        }
        var rules = node.sheet ? readRules(node.sheet) : null;
        if (!rules) {
            return null;
        }
        var last = rules.length ? rules[rules.length - 1].cssText.length : 0;
        return CACHE_PREFIX + node.href + '#' + rules.length + '.' + last;
    }

    function cacheBase(key) {
        return key.replace(/[?#].*$/, '');
    }

    function readCache(key) {
        try {
            return key ? window.localStorage.getItem(key) : null;
        } catch (e) {
            return null;
        }
    }

    function writeCache(key, css) {
        if (!key || css.length > MAX_CACHE_LENGTH) {
            return;
        }
        try {
            // Drop older versions of this sheet and entries of older engines.
            var base = cacheBase(key);
            for (var i = window.localStorage.length - 1; i >= 0; i--) {
                var existing = window.localStorage.key(i);
                if (!existing || existing === key || existing.indexOf(STORAGE_KEY + '.css.') !== 0) {
                    continue;
                }
                if (existing.indexOf(CACHE_PREFIX) !== 0 || cacheBase(existing) === base) {
                    window.localStorage.removeItem(existing);
                }
            }
            window.localStorage.setItem(key, css);
        } catch (e) {
            // quota exceeded: the twin is regenerated next time
        }
    }

    function buildTwin(node) {
        var key = cacheKey(node);
        var css = readCache(key);
        if (css === null) {
            var sheet = node.sheet;
            var rules = sheet ? readRules(sheet) : null;
            if (!rules) {
                return false;
            }
            css = walk(rules);
            var media = sheet.media && sheet.media.mediaText;
            if (css && media && media !== 'all') {
                css = '@media ' + media + '{' + css + '}';
            }
            writeCache(key, css);
        }
        if (css) {
            var twin = document.createElement('style');
            twin.setAttribute(MARKER, '');
            twin.media = effectiveTheme() === 'light' ? 'all' : 'not all';
            twin.textContent = css;
            node.parentNode.insertBefore(twin, node.nextSibling);
            twins.push(twin);
        }
        return true;
    }

    function isStylesheetNode(node) {
        if (!node || node.nodeType !== 1 || node.hasAttribute(MARKER)) {
            return false;
        }
        if (node.tagName === 'STYLE') {
            return true;
        }
        return node.tagName === 'LINK' && /(^|\s)stylesheet(\s|$)/i.test(node.rel || '');
    }

    function seen(node) {
        if (processed) {
            return processed.has(node);
        }
        return node.getAttribute('data-upassist-thememode-source') === '1';
    }

    function markSeen(node) {
        if (processed) {
            processed.add(node);
        } else {
            node.setAttribute('data-upassist-thememode-source', '1');
        }
    }

    function processNode(node) {
        if (!generating || !isStylesheetNode(node) || seen(node) || !node.parentNode) {
            return;
        }
        markSeen(node);
        if (!buildTwin(node) && node.tagName === 'LINK') {
            node.addEventListener('load', function () {
                buildTwin(node);
            }, {once: true});
        }
    }

    function scan() {
        var nodes = document.querySelectorAll('link[rel~="stylesheet"], style');
        for (var i = 0; i < nodes.length; i++) {
            processNode(nodes[i]);
        }
    }

    function observe() {
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    processNode(added[j]);
                }
            }
        });
        observer.observe(document.head || root, {childList: true});
        if (document.body) {
            observer.observe(document.body, {childList: true});
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                observer.observe(document.body, {childList: true});
                if (generating) {
                    scan();
                }
            });
        }
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    if (prefersDark) {
        var onSchemeChange = function () {
            if (mode === 'auto') {
                apply();
            }
        };
        if (prefersDark.addEventListener) {
            prefersDark.addEventListener('change', onSchemeChange);
        } else if (prefersDark.addListener) {
            prefersDark.addListener(onSchemeChange);
        }
    }

    // Another tab, or a backend module, changed the mode.
    window.addEventListener('storage', function (event) {
        if (event.key === STORAGE_KEY) {
            mode = readMode();
            apply();
        }
    });

    window.addEventListener('load', function () {
        if (generating) {
            scan();
        }
    });

    // Shared by the toggles in the content UI and in the backend modules.
    var LABELS = {auto: 'Auto (follows system)', light: 'Light', dark: 'Dark'};
    var NEXT = {auto: 'light', light: 'dark', dark: 'auto'};
    var ICONS = {
        light: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17.5a1 1 0 0 1 1 1V22a1 1 0 1 1-2 0v-1.5a1 1 0 0 1 1-1zM3 11h1.5a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm16.5 0H21a1 1 0 1 1 0 2h-1.5a1 1 0 1 1 0-2zM5.64 4.22l1.06 1.06a1 1 0 0 1-1.42 1.42L4.22 5.64a1 1 0 0 1 1.42-1.42zm12.08 12.08 1.06 1.06a1 1 0 0 1-1.42 1.42l-1.06-1.06a1 1 0 0 1 1.42-1.42zM4.22 18.36l1.06-1.06a1 1 0 0 1 1.42 1.42l-1.06 1.06a1 1 0 0 1-1.42-1.42zM16.3 5.28l1.06-1.06a1 1 0 0 1 1.42 1.42L17.72 6.7a1 1 0 0 1-1.42-1.42z',
        dark: 'M21 14.5A9 9 0 0 1 9.5 3a.75.75 0 0 0-.98-.9A10 10 0 1 0 21.9 15.48a.75.75 0 0 0-.9-.98z',
        auto: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z'
    };

    window.UpAssistThemeMode = {
        modes: MODES.slice(),
        nextMode: function (current) {
            return NEXT[current];
        },
        label: function (forMode) {
            return LABELS[forMode];
        },
        iconPath: function (forMode) {
            return ICONS[forMode];
        },
        toggleTitle: function (current) {
            return 'Theme: ' + LABELS[current] + '. Click for ' + LABELS[NEXT[current]].toLowerCase() + '.';
        },
        getMode: function () {
            return mode;
        },
        getEffectiveTheme: effectiveTheme,
        setMode: function (newMode) {
            if (MODES.indexOf(newMode) === -1) {
                return;
            }
            mode = newMode;
            try {
                window.localStorage.setItem(STORAGE_KEY, newMode);
            } catch (e) {
                // keep the mode for this page only
            }
            apply();
        },
        subscribe: function (listener) {
            listeners.push(listener);
            return function () {
                var index = listeners.indexOf(listener);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            };
        }
    };

    observe();
    apply();
})();
