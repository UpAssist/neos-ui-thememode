/*
 * UpAssist.Neos.UiThemeMode: toolbar toggle for the Neos UI
 *
 * Plain JavaScript on top of the host plugin API, so the same file works in
 * Neos UI 8 and 9 without a build step. React comes from the host; mode,
 * labels and icons come from the theme engine (ThemeMode.js).
 */
(function () {
    'use strict';

    var api = window['@Neos:HostPluginAPI'];
    if (!api || !api['@manifest'] || !api['@vendor']) {
        return;
    }

    var React = api['@vendor']().React;
    var h = React.createElement;

    function ThemeModeToggle() {
        var engine = window.UpAssistThemeMode;
        var state = React.useState(engine ? engine.getMode() : null);
        var mode = state[0];
        var setMode = state[1];

        React.useEffect(function () {
            return engine ? engine.subscribe(setMode) : undefined;
        }, []);

        if (!engine) {
            return null;
        }

        var title = engine.toggleTitle(mode);
        return h('div', {className: 'upassist-thememode'},
            h('button', {
                type: 'button',
                className: 'upassist-thememode__button',
                title: title,
                'aria-label': title,
                'data-mode': mode,
                onClick: function () {
                    engine.setMode(engine.nextMode(mode));
                }
            }, h('svg', {
                viewBox: '0 0 24 24',
                width: 16,
                height: 16,
                'aria-hidden': 'true',
                focusable: 'false'
            }, h('path', {d: engine.iconPath(mode), fill: 'currentColor'})))
        );
    }

    api['@manifest']('UpAssist.Neos.UiThemeMode:Toggle', {}, function (globalRegistry) {
        globalRegistry.get('containers').set(
            'PrimaryToolbar/Right/UpAssistThemeMode',
            ThemeModeToggle,
            'before PrimaryToolbar/Right/UserDropDown'
        );
    });
})();
