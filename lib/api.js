const FormData = require('form-data');
const got = require('got');

class VRSAPI {
    constructor(cfg) {
        this._config = cfg;
    }

    async createTest(params) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            let form = new FormData();
            form.append('run', params.run);
            form.append('name', params.name);
            form.append('status', params.status);
            form.append('viewport', params.viewport);
            form.append('browser', params.browserName);
            form.append('browserVersion', params.browserVersion);
            form.append('os', params.os);
            const response = await got.post(classThis._config.url + 'tests', {body: form}).json().catch(function (e) {
                console.log(`Cannot createTest with params: '${JSON.stringify(params)}', error: '${e}'`)
                classThis.printErrorResponseBody(e)
                return reject(e);
            })
            return resolve(response)
        })
    };

    async updateTest(params) {
        const classThis = this;

        return new Promise(async function (resolve, reject) {
            const form = new FormData();
            for (const key in params) {
                form.append(key, params[key]);
            }
            const resp = await got.put(classThis._config.url + 'tests/' + params.id,
                {
                    body: form
                }
            ).catch(function (e) {
                console.log(`Cannot updateTest with params: '${JSON.stringify(params)}', error: '${e}'`)
                classThis.printErrorResponseBody(e)
                return reject(e)

            })

            return resolve(resp)
        });
    };

    async getChecksByTestId(testid) {
        const classThis = this;

        return new Promise(async function (resolve, reject) {
            const result = await got(classThis._config.url + 'checks?testid=' + testid).json().catch((e) => {
                console.log(`Cannot getChecksByTestId with testId: '${testid}', error: '${e}'`);
                classThis.printErrorResponseBody(e);
                return reject(e);
            })
            resolve(result);
        });
    };

    async getCheck(id) {

        const classThis = this;
        return new Promise(async function (resolve, reject) {
            resolve(await got(classThis._config.url + 'check' + '/' + id).json()).catch(function (e) {
                console.log(`Cannot getCheck with id: '${id}', error: '${e}'`)
                classThis.printErrorResponseBody(e)
                return reject(e)
            })
        });
    };

    async getChecksGroupByIdent(testid) {

        const classThis = this;
        return new Promise(async function (resolve, reject) {
            const result = await got(classThis._config.url + 'checks/byident/' + testid).json().catch(function (e) {
                console.log(`Cannot getChecksGroupByIdent with testId: '${testid}', error: '${e}'`)
                classThis.printErrorResponseBody(e)
                return reject(e)
            })
            return resolve(result)
        });
    };

    async stopSession(testId) {
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            let form = new FormData();
            const response = await got.post(classThis._config.url + 'session/'+ testId, {body: form}).json().catch(function (e) {
                console.log(`Cannot stop session test with id: '${testId}', error: '${e}'`)
                return reject(e);
            })
            return resolve(response)
        });
    };

    printErrorResponseBody(e) {
        if (e.response && e.response.body) {
            console.log(`ERROR RESPONSE BODY: ${e.response.body}`)
        }
    }

    async createCheck(params, fileData, hashCode) {
        const classThis = this
        const url = this._config.url + 'checks'
        return new Promise(async function (resolve, reject) {
            const form = new FormData();
            try {
                if(params.app)
                    form.append('appName', params.app);
                if (params.suite)
                    form.append('suitename', params.suite.name);
                form.append('testname', params.test);
                form.append('testid', params.testId);
                form.append('name', params.name);
                form.append('viewport', params.viewport);
                form.append('browserName', params.browserName);
                form.append('browserVersion', params.browserVersion);
                form.append('browserFullVersion', params.browserFullVersion);
                form.append('os', params.os);

                if (params.domDump) {
                    form.append('domdump', params.domDump);
                }

                if (hashCode) {
                    form.append('hashcode', hashCode);
                }
                if (fileData) {
                    form.append('file', fileData, 'file');
                }
            } catch (e) {
                console.log(`Cannot createCheck with parameters: '${JSON.stringify(params)}', error: '${e}'`)
                return reject(e);
            }

            const result = await got.post(url, {
                body: form
            }).json().catch((e) => {
                console.log(`Cannot createCheck (post data) with url: '${url}', parameters: '${JSON.stringify(params)}', error: '${e}'`)
                classThis.printErrorResponseBody(e)
                return reject(e);
            })
            return resolve(result)
        });
    };
}

exports.VRSAPI = VRSAPI
