const fs = require('fs');
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
            form.append('testname', params.name);
            form.append('teststatus', params.status);
            form.append('testsviewport', params.viewport);
            form.append('testsbrowsername', params.browserName);
            form.append('testos', params.os);
            const response = await got.post(classThis._config.url + 'tests', {body: form}).json().catch(function (e) {
                console.log(`Cannot createTest with params: '${JSON.stringify(params)}', error: '${e}'`)
                reject(e);
                return
            })
            resolve(response)
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
                reject(e)
                return
            })

            resolve(resp)
        });
    };

    // async getAllChecks() {
    //     const classThis = this;
    //
    //     return new Promise(async function (resolve, reject) {
    //         request.get({
    //                 url: classThis._config.url + 'checks',
    //             },
    //             function (err, httpResponse, body) {
    //                 if (err) {
    //                     reject(err);
    //                 }
    //                 resolve(JSON.parse(body));
    //             });
    //     });
    // };

    async getChecksByTestId(testid) {
        const classThis = this;

        return new Promise(async function (resolve, reject) {
            resolve(await got(classThis._config.url + 'checks?testid=' + testid).json()).catch((e) => {
                console.log(`Cannot getChecksByTestId with testId: '${testid}', error: '${e}'`)

                reject(e)
                return
            })
        });
    };

    async getCheck(id) {

        const classThis = this;
        return new Promise(async function (resolve, reject) {
            resolve(await got(classThis._config.url + 'check' + '/' + id).json()).catch(function (e) {
                console.log(`Cannot getCheck with id: '${id}', error: '${e}'`)
                reject(e)
            })
        });
    };

    async getChecksGroupByIdent(testid) {

        const classThis = this;
        return new Promise(async function (resolve, reject) {
            resolve(await got(classThis._config.url + 'checks/byident/' + testid).json()).catch(function (e) {
                console.log(`Cannot getChecksGroupByIdent with testId: '${testid}', error: '${e}'`)
                reject(e)
            })
        });
    };

    async createCheck(params, filepath) {

        const url = this._config.url + 'checks'
        return new Promise(async function (resolve, reject) {
            const form = new FormData();
            try {
                form.append('appname', params.app);
                form.append('suitename', params.suite.name);
                form.append('testname', params.test);
                form.append('testid', params.testId);
                form.append('name', params.name);
                form.append('viewport', params.viewport);
                form.append('browserName', params.browserName);
                form.append('os', params.os);
                form.append('file', fs.createReadStream(filepath));
            } catch (e) {
                console.log(`Cannot createCheck with parameters: '${params}', error: '${e}'`)
                reject(e);
                return
            }

            const result = await got.post(url, {
                body: form
            }).json().catch((e) => {
                console.log(`Cannot createCheck (post data) with parameters: '${params}', error: '${e}'`)
                reject(e);
            })
            resolve(result)
        });
    };
}

exports.VRSAPI = VRSAPI
