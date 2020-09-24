const fs = require('fs');
const probe = require('probe-image-size');
const {format} = require('date-fns')
const hasha = require('hasha');
const {getDomDump} = require('./lib/getDomDump')

class VRSDriver {
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
                        test: testName
                    }
                )
                const respJson = await classThis._api.createTest({
                    name: testName,
                    status: 'Running',
                    viewport: viewport,
                    browserName: browserName,
                    os: os
                }).catch((e) => {
                        console.log(`Cannot start session, error: '${e}'`);
                        return reject(e)
                    }
                )
                if (!respJson)
                    console.error(`response is empty, params: ${JSON.stringify(params, null, "\t")}`)
                classThis._params.testId = respJson['_id'];
                return resolve(respJson);
            } catch (e) {
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

    async check(checkOpts) {
        const classThis = this;

        function prettyCheckResult(result) {
            if (!result.domDump)
                return JSON.stringify(result);
            const dump = JSON.parse(result.domDump);
            let resObs = {...result};
            delete resObs.domDump;
            resObs.domDump = JSON.stringify(dump).substr(0, 20) + `... and about ${dump.length} items]`
            return JSON.stringify(resObs);
        }

        return new Promise(async function (resolve, reject) {
                try {
                    if (classThis._params.testId === undefined)
                        throw `Test id is empty session may not have started, driver: '${JSON.stringify(classThis, null, "\t")}'`

                    const checkName = checkOpts.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const fName = format(new Date(), "yyyy-MM-dd HH:mm:ss.TTT") + '_' + checkName;
                    let filePath = '';

                    if (checkOpts.filename) {
                        filePath = checkOpts.filename;
                    } else if (checkOpts.elementSelector) {
                        filePath = browser.config.rootPath + '/.tmp/' + fName + '.png'
                        await browser.saveElementScreenshot(filePath, checkOpts.elementSelector)
                    } else {
                        filePath = browser.config.rootPath + '/.tmp/' + fName + '.png'
                        await browser.saveDocumentScreenshot(filePath)
                    }

                    // console.log(`CHECK: ${JSON.stringify(classThis._params)}`);
                    let params = classThis._params;

                    params.name = checkName;
                    params.testid = classThis._params.testId;
                    params.browserName = classThis._params.browserName;

                    if (checkOpts.dump) {
                        params.domDump = await browser.executeAsync(getDomDump);
                    }

                    if (!checkOpts.filename) {
                        params.viewport = await classThis.getViewport();
                    } else {
                        const input = require('fs').createReadStream(filePath);
                        const vp = await probe(input)
                        params.viewport = `${vp.width}x${vp.height}`
                    }
                    params.os = await classThis.getOS();

                    function readFile(file) {
                        return new Promise((resolve, reject) => {
                            fs.readFile(file, function (err, data) {
                                resolve(data);
                            })
                        });
                    }

                    const imgData = await readFile(filePath);
                    const hashCode = hasha(imgData);

                    function addMessageIfCheckFailed(result) {
                        if (result.status.includes('failed')) {
                            result.message = `To perform visual check go to url: '${classThis._config.url}checksgroupview?id=${result._id}'`;
                            result.vrsGroupLink = `'${classThis._config.url}checksgroupview?id=${result._id}'`;
                            result.vrsDiffLink = `'${classThis._config.url}diffview?diffid=${result.diffId}&actualid=${result.actualSnapshotId}&expectedid=${result.baselineId}&checkid=${result._id}'`;
                        }
                        return result;
                    }

                    let resultWithHash = await classThis._api.createCheck(params, false, hashCode).catch(e => reject(e))
                    resultWithHash = addMessageIfCheckFailed(resultWithHash);

                    console.log(`Check result Phase #1: ${prettyCheckResult(resultWithHash)}`);

                    if (resultWithHash.status === 'requiredFileData') {
                        let resultWithFile = await classThis._api.createCheck(params, filePath, hashCode).catch(e => reject(e))
                        console.log(`Check result Phase #2: ${prettyCheckResult(resultWithFile)}`);

                        resultWithFile = addMessageIfCheckFailed(resultWithFile);

                        if (!checkOpts.filename) {
                            fs.unlink(filePath, (err) => {
                                if (err) {
                                    console.error(err);
                                    return reject(err);
                                }
                            });
                        }

                        return resolve(resultWithFile);
                    } else {
                        resolve(resultWithHash);
                    }

                } catch (e) {
                    console.log(`Cannot create check with options: '${prettyCheckResult(checkOpts)}'`)
                    // console.log(`Cannot create check with options: '${JSON.stringify(checkOpts)}'`)
                    return reject(e)
                }
            }
        )
    }

    set suite(params) {
        return this._params.suite = params;
    }

    setCurrentSuite(opts) {
        this._params.suite = opts;
    }
}

exports.VRSDriver = VRSDriver;
