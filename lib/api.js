/* eslint-disable require-jsdoc */
const FormData = require('form-data');
const { got } = require('got-cjs');
const hasha = require('hasha');
const { default: logger } = require('@wdio/logger');
const utils = require('./utils');

const log = logger('syngrisi-wdio-sdk');

class SyngrisiApi {
    constructor(cfg) {
        this.config = cfg;
    }

    async createTest(params, apikey) {
        const apiHash = hasha(apikey);
        const classThis = this;
        // const headers = { apikey: hasha('WMEG74S-KPFMJRV-N69VRD6-B7S22VB') }
        const form = new FormData();
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
        form.append('app', params.app);
        const response = await got.post(`${classThis.config.url}tests`, {
            body: form,
            headers: { apikey: apiHash },
        })
            .json()
            .catch((e) => {
                log.info(`Cannot createTest with params: '${JSON.stringify(params)}', error: '${e}'`);
                utils.printErrorResponseBody(e);
                throw new Error(e + e.stack);
            });
        return response;
    }

    async stopSession(testId, apikey) {
        try {
            const apiHash = hasha(apikey);
            const $this = this;
            const form = new FormData();
            const response = await got.post(`${$this.config.url}session/${testId}`, {
                body: form,
                headers: { apikey: apiHash },
            })
                .json();
            return response;
        } catch (e) {
            throw new Error(`Cannot stop the test session with id: '${testId}', error: '${e}'`);
        }
    }

    objectToSearch(obj) {
        const str = [];
        for (const p in obj) {
            if (obj.hasOwnProperty(p)) {
                str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
            }
        }
        return str.join('&');
    }

    async getIdent(apiKey) {
        const url = `${this.config.url}ident?apikey=${apiKey}`;
        const result = await got.get(url)
            .json();
        return result;
    }

    async checkIfBaselineExist(params, apikey) {
        try {
            const searchString = this.objectToSearch({
                ...params, ...{ apikey },
            });
            const url = `${this.config.url}check_if_screenshot_has_baselines?${searchString}`;
            // console.log({ url });
            const result = got.get(url, { throwHttpErrors: false })
                .json();
            return result;
        } catch (e) {
            throw new Error(e + e.stack);
        }
    }

    async createCheck(params, imageBuffer, hashCode, apikey) {
        const apiHash = hasha(apikey);
        const url = `${this.config.url}checks`;
        const form = new FormData();
        try {
            if (params.branch) form.append('branch', params.branch);
            if (params.app) form.append('appName', params.app);
            if (params.suite) form.append('suitename', params.suite);
            if (params.domDump) form.append('domdump', params.domDump || '');
            if (hashCode) form.append('hashcode', hashCode);
            if (imageBuffer) form.append('file', imageBuffer, 'file');

            form.append('testid', params.testId);
            form.append('name', params.name);
            form.append('viewport', params.viewport);
            form.append('browserName', params.browserName);
            form.append('browserVersion', params.browserVersion);
            form.append('browserFullVersion', params.browserFullVersion);
            form.append('os', params.os);
            try {
                const result = await got.post(url, {
                    body: form,
                    headers: { apikey: apiHash },
                })
                    .json();
                return result;
            } catch (e) {
                utils.printErrorResponseBody(e);
                throw new Error(`Cannot createCheck (post data) with url: '${url}', parameters: '${JSON.stringify(params)}', error: '${e + e.stack}'`);
            }
        } catch (e) {
            throw new Error(`Cannot createCheck with parameters: '${JSON.stringify(params)}', error: '${e + e.stack}'`);
        }
    }
}

exports.SyngrisiApi = SyngrisiApi;
