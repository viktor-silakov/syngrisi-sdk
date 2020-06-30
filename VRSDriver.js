// const api = require('./lib/api').default;
const fs = require('fs');
const probe = require('probe-image-size');
const {format} = require('date-fns')
const hasha = require('hasha');

class VRSDriver {
    constructor(cfg) {
        this._api = new (require('./lib/api').VRSAPI)(cfg);
        this._config = cfg;
        this._params = {};
    }

    async getVieport() {
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

    async startTestSession(params) {
        const classThis = this;
        classThis._params.os = await classThis.getOS();
        classThis._params.vieport = await classThis.getVieport();
        classThis._params.browserName = await classThis.getBrowserName();
        classThis._params.app = params.app;
        classThis._params.test = params.test;
        const respJson = await classThis._api.createTest({
            name: params.test,
            status: 'Running',
            viewport: classThis._params.vieport,
            browserName: classThis._params.browserName,
            os: classThis._params.os
        }).catch((e) => {
                console.log('Cannot start session, error: ' + e);
                throw (e.stack ? e.stack.split("\n") : e)
            }
        )
        if (!respJson)
            console.error(`response is empty, params: ${JSON.stringify(params, null, "\t")}`)
        classThis._params.testId = respJson['_id'];
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

    async stopSession() {
        if (this._params.testId === undefined)
            throw `Test id is empty session may not have started, driver: '${JSON.stringify(this, null, "\t")}'`
        const testId = this._params.testId;

        await this.waitUntil(async () => {
            return (await this._api.getChecksByTestId(testId))
                .filter(ch => ch.status.toString() !== 'pending').length > 0;
        });

        const checksGroup = await this._api.getChecksGroupByIdent(this._params.testId)
        const groupStatuses = Object.keys(checksGroup).map(group => checksGroup[group].status);
        let testStatus = 'not set';
        if (groupStatuses.some(st => st === 'failed'))
            testStatus = 'Failed'
        if (groupStatuses.some(st => st === 'passed')
            && !groupStatuses.some(st => st === 'failed'))
            testStatus = 'Passed'
        if (groupStatuses.some(st => st === 'new')
            && !groupStatuses.some(st => st === 'failed'))
            testStatus = 'Passed'
        if (groupStatuses.some(st => st === 'blinking')
            && !groupStatuses.some(st => st === 'failed'))
            testStatus = 'Passed'
        if (groupStatuses.every(st => st === 'new'))
            testStatus = 'New'
        const blinkingCount = groupStatuses.filter(g => g === 'blinking').length;
        await this._api.updateTest({
            id: testId,
            status: testStatus,
            blinking: blinkingCount,
            viewport: await this.getVieport()
        }).catch(function (e) {
            console.log(`Cannot stop session`)
            throw (e.stack ? e.stack.split("\n") : e)
        })
    }

    async check(checkOpts) {
        const classThis = this;
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

                    console.log(`CHECK: ${JSON.stringify(classThis._params)}`);
                    let params = classThis._params;
                    params.name = checkName;
                    params.testid = classThis._params.testId;
                    params.browserName = classThis._params.browserName;
                    if (!checkOpts.filename) {
                        params.viewport = await classThis.getVieport();
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
                        if (result.status.includes('failed'))
                            result.message = `To perform visual check go to url: '${classThis._config.url}checksgroupview?id=${result._id}'`;
                        return result;
                    }

                    function removeTmpFile(filePath) {

                    }

                    classThis._api.createCheck(params, false, hashCode).then(function (resultWithHash) {
                            resultWithHash = addMessageIfCheckFailed(resultWithHash);
                            console.log(`Check result Phase #1: ${JSON.stringify(resultWithHash)}`);
                            if (resultWithHash.status === 'requiredFileData') {
                                classThis._api.createCheck(params, filePath, hashCode).then(function (resultWithFile) {
                                    console.log(`Check result Phase #2: ${JSON.stringify(resultWithFile)}`);
                                    resultWithFile = addMessageIfCheckFailed(resultWithFile);

                                    if (!checkOpts.filename) {
                                        fs.unlink(filePath, (err) => {
                                            if (err) {
                                                console.error(err);
                                                reject(err);
                                                return
                                            }
                                        });
                                    }

                                    resolve(resultWithFile);
                                    return
                                })
                            } else {
                                resolve(resultWithHash);
                            }

                        },
                        function (e) {
                            const msg = `Cannot create check: '${e}'`
                            console.error(msg);
                            return reject(msg);
                        });
                } catch (e) {
                    console.log(`Cannot create check with options: '${JSON.stringify(checkOpts)}'`)
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

    async waitUntil(cb, attempts = 5, interval = 700) {
        let result = false;
        let iteration = 0;
        while (result === false) {
            result = await cb();
            await new Promise(r => setTimeout(r, interval));
            iteration = iteration + 1;

            if (iteration > attempts) {
                result = true;
            }
        }
        return result;
    }
}

exports.LTDriver = VRSDriver;
