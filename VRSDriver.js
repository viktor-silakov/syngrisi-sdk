const hasha = require('hasha');

class vDriver {
    constructor(cfg) {
        this._api = new (require('./lib/api').VRSAPI)(cfg);
        this._config = cfg;
        this._params = {};
    }

    async getViewport() {
        return new Promise(async function (resolve, reject) {
            const viewport = await browser.getWindowSize();
            resolve(`${viewport.width}x${viewport.height}`);
        })
    }

    async getOS() {
        return await browser.execute(() => navigator.platform);
    }

    async getBrowserName() {
        let browserName = browser.capabilities.browserName;
        let chromeOpts = browser.options.capabilities['goog:chromeOptions']
        if (chromeOpts && chromeOpts.args && chromeOpts.args.includes('--headless')) {
            browserName = browserName + " [HEADLESS]"
        }
        return browserName
    }

    startTestSession(params) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            try {
                if(!classThis._params.suite){
                    classThis.setCurrentSuite({
                        name: params.suite || 'Others'
                    })
                }

                const os = await classThis.getOS();
                const viewport = await classThis.getViewport();
                const browserName = await classThis.getBrowserName();
                const testName = params.test;

                Object.assign(
                    classThis._params,
                    {
                        os: os,
                        viewport: viewport,
                        browserName: browserName,
                        app: (await params.app),
                        test: testName,
                    }
                )

                console.log()

                const respJson = await classThis._api.createTest({
                    name: testName,
                    status: 'Running',
                    viewport: viewport,
                    browserName: browserName,
                    os: os
                })

                if (!respJson)
                    console.error(`response is empty, params: ${JSON.stringify(params, null, "\t")}`)
                classThis._params.testId = respJson['_id'];
                return resolve(respJson);
            } catch (e) {
                console.log(`Cannot start session, error: '${e}'`);
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
        const classThis = this;
        if (result.status.includes('failed')) {
            result.message = `To perform visual check go to url: '${classThis._config.url}checksgroupview?id=${result._id}'`;
            result.vrsGroupLink = `'${classThis._config.url}checksgroupview?id=${result._id}'`;
            result.vrsDiffLink = `'${classThis._config.url}diffview?diffid=${result.diffId}&actualid=${result.actualSnapshotId}&expectedid=${result.baselineId}&checkid=${result._id}'`;
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

    async checkSnapshoot(checkName, imageBuffer, doomDump) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
                let params
                try {
                    if (classThis._params.testId === undefined)
                        throw `Test id is empty session may not have started, driver: '${JSON.stringify(classThis, null, "\t")}'`

                    params = classThis._params;
                    Object.assign(params,
                        {
                            name: checkName,
                            viewport: await classThis.getViewport(),
                            os: await classThis.getOS(),
                            hashCode: hasha(imageBuffer),
                            domDump: doomDump,
                        })

                    const result = await classThis.coreCheck(imageBuffer, params)
                    resolve(result);
                } catch (e) {
                    console.log(`Cannot create check with name: '${checkName}', parameters: '${params}, error: '${e}'`)
                    return reject(e)
                }
            }
        )
    }

    coreCheck(imgData, params) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            try {
                let resultWithHash = await classThis._api.createCheck(params, false, params.hashCode)
                    .catch(e => reject(e))
                resultWithHash = classThis.addMessageIfCheckFailed(resultWithHash);

                console.log(`Check result Phase #1: ${classThis.prettyCheckResult(resultWithHash)}`);

                if (resultWithHash.status === 'requiredFileData') {
                    let resultWithFile = await classThis._api.createCheck(params, imgData, params.hashCode)
                        .catch(e => reject(e))

                    console.log(`Check result Phase #2: ${classThis.prettyCheckResult(resultWithFile)}`);
                    resultWithFile = classThis.addMessageIfCheckFailed(resultWithFile);
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
}

exports.vDriver = vDriver;
