const {
    By,
    Eyes,
    Target,
    VisualGridRunner,
    BrowserType,
    DeviceName,
    ScreenOrientation,
    BatchInfo,
    AccessibilityLevel,
    AccessibilityRegionType,
    ClassicRunner
} = require('@applitools/eyes-webdriverio');

class ATDriver {
    constructor() {
        this.Configuration = {};
        this._ATeyes = null;
    }

    async init(config) {
        console.log(`Init new instance of AT Driver`);
        if (!config) {
            this._config = null;
        }
        const runner = new ClassicRunner();
        const apiKey = process.env.APPLITOOLS_API_KEY;
        this.ATeyes = await (new Eyes(runner));
        this.ATeyes.setApiKey(apiKey);
        console.log(`INIT: ${JSON.stringify(this.ATeyes._configuration, 2)}`);
    }

    startSession(browser, params) {
        console.log(`START SESSION: ${JSON.stringify(this.ATeyes._configuration, 2)}`);
        // Create proxy for browser, to remove circular link to vDriver
        let handler = {
            get: function (obj, prop) {
                if (prop === 'vDriver') {
                    return null;
                }
                return obj[prop];
            }
        };

        let brow = new Proxy(browser, handler);

        return this.ATeyes.open(brow, params.app, params.test);
    }

    stopSession() {
        return this.ATeyes.closeAsync();
    }

    check(opts) {
        return this.ATeyes.check(opts.name, Target.window()
            .fully());
    }

    set ATeyes(instance) {
        this._ATeyes = instance;
    }

    get ATeyes() {
        return this._ATeyes;
    }

    set suite(params) {
        if (params.id) {
            return this.ATeyes.setBatch(params.name, params.id);
        }
        return this.ATeyes.setBatch(params.name);
    }

    get suite() {
        return this.ATeyes.getBash();
    }
}

exports.ATDriver = ATDriver;
