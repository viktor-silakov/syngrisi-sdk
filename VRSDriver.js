const hasha = require('hasha');
const faker = require('faker');
const {getDomDump} = require("./lib/getDomDump");
module.exports.getDomDump = getDomDump;

class vDriver {
    constructor(cfg) {
        this._api = new (require('./lib/api').VRSAPI)(cfg);
        this._config = cfg;
        this._params = {};
    }

    async getViewport() {
        if (this.isAndroid())
            return new Promise(async function (resolve, reject) {
                return resolve(browser.capabilities.deviceScreenSize);
            })
        return new Promise(async function (resolve, reject) {
            const viewport = await browser.getWindowSize();
            if (viewport && viewport.width && viewport.height) {
                return resolve(`${viewport.width}x${viewport.height}`);
            }
            return resolve('0x0');
        })
    }

    async getOS() {
        let platform;
        if (this.isAndroid() || this.isIos())
            platform = browser.options.capabilities['bstack:options'].deviceName
        else
            platform = browser.capabilities.platform || await browser.execute(() => navigator.platform);
        if (process.env['ENV_POSTFIX'])
            return platform + '_' + process.env['ENV_POSTFIX'];
        return platform
    }

    async getBrowserName() {
        let browserName = browser.capabilities.browserName;
        let chromeOpts = browser.options.capabilities['goog:chromeOptions']
        if (chromeOpts && chromeOpts.args && chromeOpts.args.includes('--headless')) {
            browserName = browserName + " [HEADLESS]"
        }
        return browserName
    }

    isAndroid() {
        return (browser.options.capabilities.browserName === 'Android');
    }

    isIos() {
        return (browser.options.capabilities.browserName === 'iPhone');
    }

    // return major version of browser
    async getBrowserVersion() {
        const that = this;
        return new Promise(
            function (resolve, reject) {
                let version;
                if (that.isAndroid() || that.isIos())
                    version = browser.options.capabilities['bstack:options'].osVersion
                else
                    version = browser.capabilities.browserVersion || browser.capabilities.version
                return resolve(version.split('.')[0]);
            })
    }

    async getBrowserFullVersion() {
        const that = this;
        return new Promise(
            function (resolve, reject) {
                let version;
                if (that.isAndroid() || that.isIos())
                    version = browser.options.capabilities['bstack:options'].osVersion
                else
                    version = browser.capabilities.browserVersion || browser.capabilities.version
                return resolve(version);
            })
    }

    startTestSession(params) {
        const $this = this;
        return new Promise(async function (resolve, reject) {
            try {
                if (!$this._params.suite) {
                    $this.setCurrentSuite({
                        name: params.suite || 'Others'
                    })
                }

                const os = await $this.getOS();
                const viewport = await $this.getViewport();
                const browserName = await $this.getBrowserName();
                const browserVersion = await $this.getBrowserVersion();
                const browserFullVersion = await $this.getBrowserFullVersion();
                const testName = params.test;

                Object.assign(
                    $this._params,
                    {
                        os: os,
                        viewport: viewport,
                        browserName: browserName,
                        browserVersion: browserVersion,
                        browserFullVersion: browserFullVersion,
                        app: (await params.app),
                        test: testName,
                    }
                )

                const respJson = await $this._api.createTest({
                    name: testName,
                    status: 'Running',
                    viewport: viewport,
                    browserName: browserName,
                    browserVersion: browserVersion,
                    os: os,
                    run: params.run ? params.run : ''
                })

                if (!respJson)
                    console.error(`response is empty, params: ${JSON.stringify(params, null, "\t")}`)
                $this._params.testId = respJson['_id'];
                return resolve(respJson);
            } catch (e) {
                console.log(`Cannot start session, error: '${e}' \n '${e.stack || ''}'`);
                return reject(e)
            }
        })
    }

    // FOR DEBUG PURPOSE
    async updateTest() {
        const testId = this._params.testId;
        await this._api.updateTest({
            id: testId,
            status: 'New',
            blinking: 1000,
            viewport: '0x0'
        })
    }

    async stopTestSession() {
        const result = await this._api.stopSession(this._params.testId);
        console.log(`Session with testId: '${result._id}' was stopped`)
    }

    addMessageIfCheckFailed(result) {
        const $this = this;
        if (result.status.includes('failed')) {
            result.message = `To perform visual check go to url: '${$this._config.url}checksgroupview?id=${result._id}'\n
            '${$this._config.url}diffview?diffid=${result.diffId}&actualid=${result.actualSnapshotId}&expectedid=${result.baselineId}&checkid=${result._id}'`;
            result.vrsGroupLink = `'${$this._config.url}checksgroupview?id=${result._id}'`;
            result.vrsDiffLink = `'${$this._config.url}diffview?diffid=${result.diffId}&actualid=${result.actualSnapshotId}&expectedid=${result.baselineId}&checkid=${result._id}'`;
        }
        return result;
    }

    prettyCheckResult(result) {
        if (!result.domDump)
            return JSON.stringify(result);
        const dump = JSON.parse(result.domDump);
        let resObs = {...result};
        delete resObs.domDump;
        resObs.domDump = JSON.stringify(dump).substr(0, 20) + `... and about ${dump.length} items]`
        return JSON.stringify(resObs);
    }

    async checkSnapshoot(checkName, imageBuffer, domDump) {
        const $this = this;
        return new Promise(async function (resolve, reject) {
                let params
                try {
                    if ($this._params.testId === undefined)
                        throw `Test id is empty session may not have started, driver: '${JSON.stringify($this, null, "\t")}'`

                    params = $this._params;
                    Object.assign(params,
                        {
                            name: checkName,
                            viewport: await $this.getViewport(),
                            os: await $this.getOS(),
                            hashCode: hasha(imageBuffer),
                            domDump: domDump,
                            browserVersion: await $this.getBrowserVersion(),
                            browserFullVersion: await $this.getBrowserFullVersion(),
                        })

                    const result = await $this.coreCheck(imageBuffer, params)
                    resolve(result);
                } catch (e) {
                    console.log(`Cannot create check with name: '${checkName}', parameters: '${params}, error: '${e}'`)
                    return reject(e)
                }
            }
        )
    }

    coreCheck(imgData, params) {
        const $this = this;
        return new Promise(async function (resolve, reject) {
            try {
                let resultWithHash = await $this._api.createCheck(params, false, params.hashCode)
                    .catch(e => reject(e))
                resultWithHash = $this.addMessageIfCheckFailed(resultWithHash);

                console.log(`Check result Phase #1: ${$this.prettyCheckResult(resultWithHash)}`);

                if (resultWithHash.status === 'requiredFileData') {
                    let resultWithFile = await $this._api.createCheck(params, imgData, params.hashCode)
                        .catch(e => reject(e))

                    console.log(`Check result Phase #2: ${$this.prettyCheckResult(resultWithFile)}`);
                    resultWithFile = $this.addMessageIfCheckFailed(resultWithFile);
                    return resolve(resultWithFile);
                } else {
                    resolve(resultWithHash);
                }
            } catch (e) {
                reject(e);
            }
        })
    }

    set suite(params) {
        return this._params.suite = params;
    }

    setCurrentSuite(opts) {
        this._params.suite = opts;
    }

    // Generate random Run name value if environment variable is not set
    static generateRunNameIfNotSet(runName = faker.lorem.slug(5) + '_' + faker.random.uuid()) {
        process.env['RUN_NAME'] = process.env['RUN_NAME'] ? process.env['RUN_NAME'] : runName;
    }
}

exports.vDriver = vDriver;
