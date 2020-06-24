// const api = require('./lib/api').default;
const fs = require('fs');
const probe = require('probe-image-size');

class LTDriver {
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

    async startSession(params) {
        const classThis = this;
        classThis._params.os = await classThis.getOS();
        classThis._params.vieport = await classThis.getVieport();
        classThis._params.browserName = await classThis.getBrowserName();
        classThis._params.app = params.app;
        classThis._params.test = params.test;
        const testJson = await classThis._api.createTest({
            name: params.test,
            status: 'Running',
            viewport: classThis._params.vieport,
            browserName: classThis._params.browserName,
            os: classThis._params.os
        }).catch(err => console.error('Error: ' + err))
        if (!testJson)
            console.error(`response is empty, params: ${JSON.stringify(params, null, "\t")}`)

        const test = JSON.parse(testJson);
        classThis._params.testId = test['_id'];
    }

    // FOR DEBUG PURPOSE
    async updateTest() {
        const testId = this._params.testId;

        await this._api.updateTest({
            id: testId,
            status: 'New',
            blinking: 1000,
            viewport: 'xXx'
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
        })
    }

    async check(checkOpts) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
                if (classThis._params.testId === undefined)
                    throw `Test id is empty session may not have started, driver: '${JSON.stringify(classThis, null, "\t")}'`

                const fName = checkOpts.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                let filePath = '';
                if (checkOpts.filename) {
                    filePath = checkOpts.filename;
                } else if (checkOpts.element) {
                    const ssPath = browser.config.rootPath + '/.tmp/' + fName + '.png'
                    await checkOpts.element.saveScreenshot(ssPath)
                    filePath = ssPath
                } else {
                    const ssData = await browser.saveFullPageScreen(fName);
                    filePath = ssData.path + '/' + ssData.fileName;
                }

                console.log(`CHECK: ${JSON.stringify(classThis._params)}`);
                let params = classThis._params;
                params.name = fName;
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
                classThis._api.createCheck(params, filePath).then(function (result) {
                        console.log(`Check result: ${result}`)
                        resolve(JSON.parse(JSON.parse(result)));
                    },
                    function (error) {
                        const msg = `Cannot create check: '${error}'`
                        console.error(msg);
                        reject(msg);

                    });
                if (!checkOpts.filename) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        }
                    });
                }
            }
        )
    }

    set suite(params) {
        return this._params.suite = params;
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

exports.LTDriver = LTDriver;
