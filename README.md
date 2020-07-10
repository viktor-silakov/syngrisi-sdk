## SDK for Visual regression service

### Usage

```javascript
const VRSConfig = {
    url: `http://${vrsHost}:${vrsPort}/`
}

const VRSDriver = new (require('./src/lib/VRSDrivers/VRSDriver').VRSDriver)(VRSConfig);

browser.vDriver = VRSDriver;

(async function () {
    // Set up suite
    await browser.vDriver.setCurrentSuite({
        name: 'Suite Name',
        id: 'suite_id'
    })

    // Start tests
    await browser.vDriver.startTestSession({
        app: 'Test Application',
        test: 'Test Name'
    });

    // perform check
    // dump: true - send DOM dump during a check
    // elementSelector: '#element-id' make check of particular element
    await browser.VRSDriver.check({
        name: 'Check Name',
        elementSelector: '#element-id',
        dump: true
    });
    await browser.VRSDriver.stopTestSession();
})()
```

### TODO 
* Add complete SDK API documentation
