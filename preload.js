const os = require("os");
const publicIp = require('public-ip');
const internalIp = require('internal-ip');

const interfaces = os.networkInterfaces();

const {Navigator} = require("node-navigator");
const mode_navigator = new Navigator();

/**
 * 获取局域网ip地址，如果获取不到就从本地网卡进行推断
 * @param success success(ip)
 */
window.lanIPv4 = async function (success) {
    internalIp.v4().then(ip => {
        if (ip != undefined) {
            success(ip);
        } else {
            success(localIpInfer());
        }
    }).catch(err => success(localIpInfer()));
}

/**
 * 尝试从本地网卡信息推断局域网ip
 */
function localIpInfer() {
    console.log("本地推断!")
    let lanIpv4 = '';
    if (utools.isMacOs()) {
        if (interfaces.en0 != undefined) {
            for (let i = 0; i < interfaces.en0.length; i++) {
                if (interfaces.en0[i].family == 'IPv4') {
                    lanIpv4 = interfaces.en0[i].address;
                }
            }
        } else {
            lanIpv4 = "无连接网络!"
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

/**
 * 获取 公网ip地址，不包含代理
 * @param success  success(ip,cityName)
 * @param fail fail(errorMessage)
 */
window.wan_no_proxy = function (success, fail) {

    let fetchFromDns = () => {
        console.log("从DNS获取")
        publicIp.v4({timeout: 3000}).then(ip => success({
            ip: ip,
            addr: "未知",
            isp: "未知",
            net_str: "未知"
        })).catch(err => fail("网络出错啦!"));
    }

    // fetch('https://ipinfo.io', {
    // https://api.ip.sb/geoip
    // https://pro.ip-api.com/json?fields=16985625&key=EEKS6bLi6D91G1p
    fetch('https://forge.speedtest.cn/api/location/info', {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.1.2"
        }
    }).then(response => {
        response.json().then(data => {
            console.log(data)
            success({
                ip: data.ip,
                addr: data.country + ' ' + data.province + ' ' + data.distinct,
                isp: data.isp,
                net_str: data.net_str
            })
        }).catch(reason => {
            console.error(reason)
            fetchFromDns();
        });
    }).catch(data => {
        console.error(data)
        fetchFromDns();
    });
}

/**
 * 公网Ip 包括代理
 * @param success  success(ip,cityName)
 * @param fail fail(errorMessage)
 */
window.wan_has_proxy = function (success, fail) {

    let fetchFromDns = () => {
        console.log("从DNS获取")
        publicIp.v4({timeout: 3000}).then(ip => success({
            ip: ip,
            addr: "未知",
            isp: "未知",
            net_str: "未知"
        })).catch(err => fail("网络出错啦!"));
    }

    fetch('https://ipinfo.io', {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.1.2"
        }
    }).then(response => {
        response.json().then(data => {
            console.log(data)
            success({
                ip: data.ip,
                addr: data.country + ' ' + data.region + ' ' + data.city,
                isp: data.org,
                net_str: data.org
            })
        }).catch(reason => {
            console.error(reason)
            fetchFromDns();
        });
    }).catch(data => {
        console.error(data)
        fetchFromDns();
    });
}

/**
 * 获取用户的位置
 * @param success
 * @param fail
 */
window.locationInfo = function (success, fail) {
    if (mode_navigator.geolocation) {
        // 从操作系统获取用户位置信息
        mode_navigator.geolocation.getCurrentPosition((loc, error) => {
            if (error) {
                console.error(error);
                fail(error.message);
            } else {
                var url = "http://api.map.baidu.com/geocoder?location="
                    + loc.latitude + "," + loc.longitude + "&output=json";
                fetch(url).then(response => {
                    if (response.ok) {
                        response.json().then(bodyObj => {
                            if (bodyObj.status == "OK") {
                                success(bodyObj.result.formatted_address);
                            } else {
                                fail("无法获取地址信息")
                            }
                        }).catch(reason => console.error(reason));
                    } else {
                        response.text().then((body) => {
                            console.error(body);
                            fail(body);
                        }).catch(reason => console.error(reason));
                    }
                }).catch(err => {
                    console.error(err);
                    fail("无法获取地址信息");
                });
            }
        });
    } else {
        console.error("不支持定位");
        fail("不支持定位");
    }
}