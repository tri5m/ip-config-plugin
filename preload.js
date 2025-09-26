const os = require("os");
const publicIp = require('public-ip');
const internalIp = require('internal-ip');

const interfaces = os.networkInterfaces();

const {Navigator} = require("node-navigator");
const mode_navigator = new Navigator();

// 撒花依赖
const confetti = require('canvas-confetti');

/**
 * 获取局域网ip地址，如果获取不到就从本地网卡进行推断
 * @param success success(ip)
 */
window.lanIPv4 = async function (success) {
    internalIp.v4().then(ip => {
        if (ip !== undefined) {
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

    // 从MyIp查询国内ip
    let fromMyIp = (tryFunction) => {
        let sour = "从MyIp查询国内ip"
        fetch('https://my.ip.cn/json/', {
            method: "GET",
            headers: {
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            console.log(sour+"结果")
            if (!response.ok) {
                console.error(response);
                tryFunction();
            }
            response.json().then(data => {
                console.log('MyIp结果：' + data)
                success({
                    ip: data.data.ip,
                    addr: data.data.country + ' ' + data.data.province + ' '
                        + data.data.city + ' ' + data.data.district,
                    isp: data.data.isp,
                    net_str: data.data.isp
                })
            }).catch(reason => {
                console.error(sour+"结果:")
                console.error(reason);
                tryFunction();
            });
        }).catch(e => {
            console.error(e);
            tryFunction();
        });
    }

    // 从我的腾讯位置服务api接口调用
    let fromQQMap = (tryFunction) => {
        let sour = "从腾讯位置服务api获取"
        fetch('https://apis.map.qq.com/ws/location/v1/ip?key=MJTBZ-QKPW7-FSUX2-HDL4O-T3PZE' +
            '-LYFMZ&sig=9ffcdf608d4b46906d75bb14a92d0c85', {
            method: "GET",
            headers: {
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            console.log(sour+"结果")
            if (!response.ok) {
                console.error(response);
                tryFunction();
            }
            response.json().then(data => {
                console.log(data)
                if(data.status === 0) {
                    success({
                        ip: data.result.ip,
                        addr: data.result.ad_info.nation + ' ' + data.result.ad_info.province + ' '
                            + data.result.ad_info.city + ' ' + data.result.ad_info.district,
                        isp: "",
                        net_str: ""
                    })
                }else{
                    console.error("腾讯地图api结果:"+data)
                    tryFunction();
                }
            }).catch(reason => {
                console.error(reason);
                tryFunction();
            });
        }).catch(e => {
            console.error(sour+"结果")
            console.error(e);
            tryFunction();
        });
    }

    let test = (tryFunction) => {
        tryFunction();
    }

    let fetchFromDns = () => {
        console.log("从DNS获取")
        publicIp.v4({timeout: 3000}).then(ip => success({
            ip: ip,
            addr: "未知",
            isp: "未知",
            net_str: "未知"
        })).catch(err => fail("网络出错啦!"));
    }

    // 优先级，百度，到ipcn到dns查询
    fromMyIp(() => fromQQMap(() => test(() => fetchFromDns)));
    
}

/**
 * 公网包括外网Ip
 * @param success  success(ip,cityName)
 * @param fail fail(errorMessage)
 */
window.wan_has_proxy = function (success, fail) {

    let fromPing0 = (tryFunction) => {
        console.log("从ping0获取")
        fetch('https://ping0.cc/geo', {
            method: "GET",
            headers: {
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            if (!response.ok) {
                tryFunction();
            }
            response.text().then(data => {
                console.log(data)
                let dataLine = data.split(/\r?\n/);
                success({
                    ip: dataLine[0],
                    addr: dataLine[1],
                    isp: dataLine[2],
                    net_str: dataLine[3]
                });
                fetch("https://ipv4.ping0.cc/Ip/ipleakdo?ip="+dataLine).then(res => {
                    if (res.ok) {
                        res.json().then(ipTypeRes => {
                            console.log('获取ip类型：'+ipTypeRes.iptype);
                            success({
                                ip: dataLine[0],
                                addr: dataLine[1],
                                isp: dataLine[2],
                                net_str: dataLine[3] + '\r\n['+ipTypeRes.iptype+']'
                            });
                        })
                    }
                })
            }).catch(reason => {
                console.error(reason)
                tryFunction();
            });
        }).catch(data => {
            console.error(data)
            tryFunction();
        });
    }

    // 谷歌账号登录获取的账号免费token e793d3142b2142848d8e30497167c176
    let fromIpgeolocation = (tryFunction) => {
        console.log("从pgeolocation.io获取")
        fetch('https://api.ipgeolocation.io/ipgeo?apiKey=e793d3142b2142848d8e30497167c176', {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            if (!response.ok) {
                console.error(response);
                tryFunction();
            }
            response.json().then(data => {
                console.log(data)
                return {
                    ip: data.ip,
                    addr: data.country_emoji+data.country_name+ ' ' + data.state_prov + ' '
                        + data.city + ' ' + data.district,
                    isp: data.isp,
                    net_str: data.organization
                }
            }).catch(reason => {
                tryFunction();
                return false;
            });
        }).catch(data => {
            tryFunction();
            return false;
        });
    }

    let fromIpInfo = (tryFunction) => {
        console.log("从ipinfo获取")
        fetch('https://ipinfo.io', {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            if (!response.ok) {
                console.error(response);
                tryFunction();
            }
            response.json().then(data => {
                console.log(data)
                return {
                    ip: data.ip,
                    addr: data.country + ' ' + data.region + ' ' + data.city,
                    isp: data.org,
                    net_str: data.org
                }
            }).catch(reason => {
                tryFunction();
                return false;
            });
        }).catch(data => {
            tryFunction();
            return false;
        });
    }

    let fromIpify = (tryFunction) => {
        console.log("从Ipify获取只有IP地址")
        fetch('https://api.ipify.org?format=json', {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "curl/8.1.2"
            }
        }).then(response => {
            if (!response.ok) {
                console.error(response);
                tryFunction();
            }
            response.json().then(data => {
                console.log(data)
                return {
                    ip: data.ip,
                    addr: "",
                    isp: "",
                    net_str: ""
                }
            }).catch(reason => {
                tryFunction();
                return false;
            });
        }).catch(data => {
            tryFunction();
            return false;
        });
    }

    let fetchFromDns = () => {
        console.log("从DNS获取")
        publicIp.v4({timeout: 3000}).then(ip => success({
            ip: ip,
            addr: "未知",
            isp: "未知",
            net_str: "未知"
        })).catch(err => fail("网络出错啦!"));
    }

    // 优先级从外面到里面进行查询
    fromPing0(() => fromIpgeolocation(() => fromIpInfo(
        () => fromIpify(() => fetchFromDns()))));
}

/**
 * 获取用户的位置
 * @param success
 * @param fail
 */
window.locationInfo = function (success, fail) {

    // 其他，美团根据ip查经纬度 https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=222.70.8.71
    // 其他，美团，根据经纬度查地址 https://apimobile.meituan.com/group/v1/city/latlng/31.178655,121.401438?tag=0

    let fromBaidu = (latitude, longitude, tryFunction) => {
        let url = "http://api.map.baidu.com/geocoder?location="
            + latitude + "," + longitude + "&output=json";
        fetch(url).then(response => {
            if (response.ok) {
                response.json().then(bodyObj => {
                    if (bodyObj.status == "OK") {
                        success(bodyObj.result.formatted_address);
                    } else {
                        tryFunction(latitude, longitude, tryFunction);
                    }
                }).catch(reason => {
                    console.error(reason);
                    tryFunction(latitude, longitude, tryFunction);
                });
            } else {
                tryFunction(latitude, longitude, tryFunction);
            }
        }).catch(err => {
            tryFunction(latitude, longitude, tryFunction);
            fail("无法获取地址信息");
        });
    }

    // 从我的高德key接口中查询
    let fromMyGaodeKey = (latitude, longitude, tryFunction) => {
        let url = "https://restapi.amap.com/v3/geocode/regeo?key=c58d08114ec1edd8e5e60242824bd202&" +
            "location=" + longitude + "," + latitude;
        console.info("从高德地图开始根据经纬度获取地址latitude:"+latitude + "longitude:"+longitude)
        fetch(url).then(response => {
            if (response.ok) {
                response.json().then(bodyObj => {
                    console.log("从高德地图开始根据经纬度获取地址: "+ bodyObj)
                    if(bodyObj.status === 1){
                        success(bodyObj.regeocode.formatted_address);
                    }else{
                        tryFunction(latitude, longitude, tryFunction);
                    }
                }).catch(reason => tryFunction(latitude, longitude, tryFunction));
            } else {
                console.error("从高德地图开始根据经纬度获取地址失败")
                tryFunction(latitude, longitude, tryFunction);
            }
        }).catch(err => {
            tryFunction(latitude, longitude, tryFunction)
        });
    }

    let fromMeiTuan = (latitude, longitude, tryFunction) => {
        let url = "https://apimobile.meituan.com/group/v1/city/latlng/"
            + latitude + "," + longitude + "?tag=0";
        fetch(url).then(response => {
            if (response.ok) {
                response.json().then(bodyObj => {
                    success(bodyObj.data.province+bodyObj.data.city+bodyObj.data.district+bodyObj.data.areaName
                        +bodyObj.data.detail);
                }).catch(reason => tryFunction(latitude, longitude, tryFunction));
            } else {
                tryFunction(latitude, longitude, tryFunction);
            }
        }).catch(err => {
            tryFunction(latitude, longitude, tryFunction)
        });
    }

    // 只能通过ip模糊查询位置
    let fromGaodeIp = (latitude, longitude, tryFunction) => {
        console.log("从高德尝试获取")
        let url = "https://restapi.amap.com/v3/ip?key=c58d08114ec1edd8e5e60242824bd202";
        fetch(url).then(response => {
            console.log("从高德获取结果:"+response)
            if (response.ok) {
                response.json().then(bodyObj => {
                    success(bodyObj.province+bodyObj.city);
                }).catch(reason => tryFunction(latitude, longitude, tryFunction));
            } else {
                tryFunction(latitude, longitude, tryFunction);
            }
        }).catch(err => {
            console.log("从高德获取结果失败:"+err)
            tryFunction(latitude, longitude, tryFunction)
        });
    }
    // 同样的还有 https://ip-moe.zerodream.net/?ip=180.154.13.158 用ip来查询地址

    if (mode_navigator.geolocation) {
        // 从操作系统获取用户位置信息
        mode_navigator.geolocation.getCurrentPosition((loc, error) => {
            if (error) {
                // 获取不到经纬度，直接从高德获取
                console.error(error);
                fromGaodeIp("","", () => fail("无法获取地址信息"));
            } else {
                fromMyGaodeKey(loc.latitude,loc.longitude,
                    () => fromBaidu(loc.latitude, loc.longitude,
                    () => fromMeiTuan(loc.latitude, loc.longitude,
                    () => fromGaodeIp("","",
                        () => fail("无法获取地址信息")))));
            }
        });
    } else {
        console.error("不支持定位");
        fromGaodeIp("","", () => fail("无法获取地址信息"));
    }
}

/**
 * 撒花
 */
window.confetti = function (e){
    confetti({
        origin: {
            x: 0.5,
            y: 0.5
        }
    });
}