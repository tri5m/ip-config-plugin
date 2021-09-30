const os = require("os");

const interfaces = os.networkInterfaces();

window.lanIPv4 = function () {

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

    return lanIpv4;
}

window.wanIPv4 = function (success, fail) {
    // http://pv.sohu.com/cityjson?ie=utf-8
    let ajax = new XMLHttpRequest();
    ajax.open('get','http://pv.sohu.com/cityjson?ie=utf-8');
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState==4 &&ajax.status==200) {
            success(ajax.responseText);
        }else{
            fail("网络出错啦。");
        }
    }
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