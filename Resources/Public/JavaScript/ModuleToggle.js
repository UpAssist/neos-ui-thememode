/*
 * UpAssist.Neos.UiThemeMode: toggle in the top bar of the backend modules
 *
 * Needs ThemeMode.js to be loaded first.
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    function mount() {
        var engine = window.UpAssistThemeMode;
        var topBar = document.getElementById('neos-top-bar');
        if (!engine || !topBar || topBar.querySelector('.upassist-thememode')) {
            return;
        }
        // Neos 8 has a right-hand section with the user menu; Neos 9 moved
        // the user menu into the drawer, so the toggle is pinned to the right.
        var bar = topBar.querySelector('.neos-top-bar-right');

        var wrapper = document.createElement('div');
        wrapper.className = 'upassist-thememode upassist-thememode--module' + (bar ? '' : ' upassist-thememode--pinned');

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'upassist-thememode__button';

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('fill', 'currentColor');
        svg.appendChild(path);
        button.appendChild(svg);
        wrapper.appendChild(button);

        function render(mode) {
            var title = engine.toggleTitle(mode);
            button.title = title;
            button.setAttribute('aria-label', title);
            button.setAttribute('data-mode', mode);
            path.setAttribute('d', engine.iconPath(mode));
        }

        button.addEventListener('click', function () {
            engine.setMode(engine.nextMode(engine.getMode()));
        });
        engine.subscribe(render);
        render(engine.getMode());

        if (bar) {
            bar.insertBefore(wrapper, bar.firstChild);
        } else {
            topBar.appendChild(wrapper);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
