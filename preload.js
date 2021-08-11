const os = require("os");
const request = require("request");

const interfaces = os.networkInterfaces();

let lanIpv4 = '';
if (utools.isMacOs()) {
    for (let i = 0; i < interfaces.en0.length; i++) {
        if (interfaces.en0[i].family == 'IPv4') {
            lanIpv4 = interfaces.en0[i].address;
        }
    }
} else if (utools.isWindows()) {
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                lanIpv4 = alias.address;
            }
        }
    }
}

window.lanIPv4 = function () {

    return lanIpv4;
}

window.wanIPv4 = function (success, fail) {
    // http://pv.sohu.com/cityjson?ie=utf-8
    request('http://pv.sohu.com/cityjson?ie=utf-8', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            success(body);
        } else {
            fail(error);
        }
    });
}

window.netInfo = function (success) {
    const networksObj = os.networkInterfaces();
    for (let nw in networksObj) {
        let objArr = networksObj[nw];
        objArr.forEach((obj, idx, arr) => {
            success(nw,obj);
        });
    }
}