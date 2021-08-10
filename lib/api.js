const FormData = require('form-data');
const got = require('got');
const hasha = require('hasha');

class syngrisiApi {
    constructor(cfg) {
        this._config = cfg;
    }

    printErrorResponseBody(e) {
        if (e.response && e.response.body) {
            console.log(`ERROR RESPONSE BODY: ${e.response.body}`);
        }
    }

    async createTest(params, apikey) {
        const apiHash = hasha(apikey);
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            // const headers = { apikey: hasha('WMEG74S-KPFMJRV-N69VRD6-B7S22VB') }
            let form = new FormData();
            form.append('run', params.run);
            form.append('runident', params.runident);
            if (params.tags) form.append('tags', JSON.stringify(params.tags));
            if (params.branch) form.append('branch', params.branch);
            form.append('name', params.name);
            form.append('status', params.status);
            form.append('viewport', params.viewport);
            form.append('browser', params.browserName);
            form.append('browserVersion', params.browserVersion);
            form.append('os', params.os);
            const response = await got.post(classThis._config.url + 'tests', {
                body: form,
                headers: { apikey: apiHash }
            })
                .json()
                .catch(function (e) {
                    console.log(`Cannot createTest with params: '${JSON.stringify(params)}', error: '${e}'`);
                    classThis.printErrorResponseBody(e);
                    return reject(e);
                });
            return resolve(response);
        });
    };

    async stopSession(testId, apikey) {
        const apiHash = hasha(apikey);
        const classThis = this;
        return new Promise(async function (resolve, reject) {
            let form = new FormData();
            const response = await got.post(classThis._config.url + 'session/' + testId, {
                body: form,
                headers: { apikey: apiHash }
            })
                .json()
                .catch(function (e) {
                    console.log(`Cannot stop the test session with id: '${testId}', error: '${e}'`);
                    return reject(e);
                });
            return resolve(response);
        });
    };

    async createCheck(params, fileData, hashCode, apikey) {
        const apiHash = hasha(apikey);
        const classThis = this;
        const url = this._config.url + 'checks';
        return new Promise(async function (resolve, reject) {
            const form = new FormData();
            try {
                if (params.branch) form.append('branch', params.branch);
                if (params.app) form.append('appName', params.app);
                if (params.suite) form.append('suitename', params.suite.name);
                if (params.domDump) form.append('domdump', params.domDump);
                if (hashCode) form.append('hashcode', hashCode);
                if (fileData) form.append('file', fileData, 'file');

                form.append('testname', params.test);
                form.append('testid', params.testId);
                form.append('name', params.name);
                form.append('viewport', params.viewport);
                form.append('browserName', params.browserName);
                form.append('browserVersion', params.browserVersion);
                form.append('browserFullVersion', params.browserFullVersion);
                form.append('os', params.os);
            } catch (e) {
                console.log(`Cannot createCheck with parameters: '${JSON.stringify(params)}', error: '${e}'`);
                return reject(e);
            }
            const result = await got.post(url, {
                body: form,
                headers: { apikey: apiHash }
            })
                .json()
                .catch((e) => {
                    console.log(`Cannot createCheck (post data) with url: '${url}', parameters: '${JSON.stringify(params)}', error: '${e}'`);
                    classThis.printErrorResponseBody(e);
                    return reject(e);
                });
            return resolve(result);
        });
    };
}

exports.syngrisiApi = syngrisiApi;
