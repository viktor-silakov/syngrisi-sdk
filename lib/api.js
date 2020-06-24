const fs = require('fs');
const request = require('request');
const FormData = require('form-data');
const got = require('got');

const createTest = async function (params, cfg) {

    return new Promise(async function (resolve, reject) {
        let form = new FormData();
        form.append('testname', params.name);
        form.append('teststatus', params.status);
        form.append('testsviewport', params.viewport);
        form.append('testsbrowsername', params.browserName);
        form.append('testos', params.os);
        try {
            const response = await got.post(cfg.url + 'tests', {body: form})
            resolve(response.body)
        } catch (e) {
            reject(e);
        }

    })
};

const updateTest = async function (params, cfg) {
    return new Promise(async function (resolve, reject) {
        const form = new FormData();
        for (const key in params) {
            form.append(key, params[key]);
        }
        const resp = await got.put(cfg.url + 'tests/' + params.id,
            {
                body: form
            }
        ).catch(function (e) {
            reject(e)
            return
        })

        resolve(resp)
    });
};

const getAllChecks = async function (cfg) {
    return new Promise(async function (resolve, reject) {
        request.get({
                url: cfg.url + 'checks',
            },
            function (err, httpResponse, body) {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(body));
            });
    });
};
const getChecksByTestId = async function (testid, cfg) {
    return new Promise(async function (resolve, reject) {
        request.get({
                url: cfg.url + 'checks?testid=' + testid,
            },
            function (err, httpResponse, body) {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(body));
            });
    });
};

const getCheck = async function (id, cfg) {
    return new Promise(async function (resolve, reject) {
        const response = await got.get(cfg.url + 'check' + '/' + id).catch(
            function (e) {
                reject(e);
            }
        )
        resolve(JSON.parse(response.body))
    });
};

const getChecksGroupByIdent = async function (testid, cfg) {
    return new Promise(async function (resolve, reject) {
        request.get({
                url: cfg.url + 'checks/byident/' + testid,
            },
            function (err, httpResponse, body) {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(body));
            });
    });
};

const createCheck = async function (
    params,
    filepath,
    cfg
) {
    const url = cfg.url + 'checks'
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
            reject(e);
        }

        let response = null;
        await form.getLength(async (err, length) => {
            const r = await request.post({
                    url,
                },
                (error, res, body) => {
                    if (error) {
                        reject('Cannot create check:' + error);
                    }
                    if (res.statusCode !== 200) {
                        reject(`Cannot create check, response status: '${res.statusCode}', body: ${JSON.stringify(body)}}}`);
                    }
                    response = JSON.stringify(body);
                    resolve(response)
                });
            r._form = form;
        });
    });
};

exports.getChecksByTestId = getChecksByTestId;
exports.getCheck = getCheck;
exports.createCheck = createCheck;
exports.createTest = createTest;
exports.updateTest = updateTest;
exports.getAllChecks = getAllChecks;
exports.getChecksGroupByIdent = getChecksGroupByIdent;
