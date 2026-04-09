const os = require("os");
const publicIp = require('public-ip');
const internalIp = require('internal-ip');

const {Navigator} = require("node-navigator");
const mode_navigator = new Navigator();

// 撒花依赖
const confetti = require('canvas-confetti');

/**
 * 获取全部可用IPv4网卡，按优先级排序
 */
window.getLanIPv4Interfaces = function (success) {
    success(listLanIPv4Interfaces());
}

/**
 * 获取局域网IPv4地址
 * @param success success(ip)
 * @param preferredInterfaceId 指定网卡ID，可选
 */
window.lanIPv4 = async function (success, preferredInterfaceId) {
    const lanInterfaces = listLanIPv4Interfaces();
    const preferred = pickPreferredLanInterface(lanInterfaces, preferredInterfaceId);

    if (preferredInterfaceId) {
        success(preferred ? preferred.address : '');
        return;
    }

    internalIp.v4().then(ip => {
        if (ip) {
            success(ip);
            return;
        }
        success(preferred ? preferred.address : '');
    }).catch(() => {
        success(preferred ? preferred.address : '');
    });
}

function listLanIPv4Interfaces() {
    const interfaces = os.networkInterfaces();
    const result = [];

    Object.keys(interfaces).forEach((name) => {
        const iface = interfaces[name] || [];
        iface.forEach((item) => {
            const family = normalizeFamily(item.family);
            if (family !== 'IPv4') {
                return;
            }
            if (item.internal || !item.address) {
                return;
            }
            if (item.address === '127.0.0.1' || item.address.startsWith('169.254.')) {
                return;
            }

            result.push({
                id: buildLanInterfaceId(name, item.address),
                name,
                address: item.address,
                cidr: item.cidr || '',
                mac: item.mac || '',
                score: scoreLanInterface(name, item.address)
            });
        });
    });

    result.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (a.name !== b.name) {
            return a.name.localeCompare(b.name);
        }
        return a.address.localeCompare(b.address);
    });

    return result.map(({score, ...item}) => item);
}

function pickPreferredLanInterface(interfaces, preferredInterfaceId) {
    if (!interfaces.length) {
        return null;
    }

    if (preferredInterfaceId) {
        const matched = interfaces.find(item => item.id === preferredInterfaceId);
        if (matched) {
            return matched;
        }
    }

    return interfaces[0];
}

function normalizeFamily(family) {
    if (family === 4) {
        return 'IPv4';
    }
    if (family === 6) {
        return 'IPv6';
    }
    return family;
}

function buildLanInterfaceId(name, address) {
    return name + '::' + address;
}

function scoreLanInterface(name, address) {
    let score = 0;
    const lowerName = String(name).toLowerCase();

    if (
        lowerName.includes('wi-fi') ||
        lowerName.includes('wifi') ||
        lowerName.includes('wlan') ||
        lowerName === 'en0' ||
        lowerName.startsWith('eth')
    ) {
        score += 50;
    }

    if (
        lowerName.includes('bridge') ||
        lowerName.includes('docker') ||
        lowerName.includes('vbox') ||
        lowerName.includes('vmnet') ||
        lowerName.includes('hyper-v') ||
        lowerName.includes('virtual') ||
        lowerName.includes('utun') ||
        lowerName.includes('tun') ||
        lowerName.includes('tap')
    ) {
        score -= 100;
    }

    if (address.startsWith('192.168.')) {
        score += 20;
    } else if (address.startsWith('10.')) {
        score += 15;
    } else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
        score += 10;
    }

    return score;
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
                console.log("ping0获取结果:"+data)
                let dataLine = data.split(/\r?\n/);
                success({
                    ip: dataLine[0],
                    addr: dataLine[1],
                    isp: dataLine[2],
                    net_str: dataLine[3]
                });
                fetch("https://ipv4.ping0.cc/Ip/ipleakdo").then(res => {
                    if (res.ok) {
                        res.json().then(ipTypeRes => {
                            console.log('获取ip类型：'+ipTypeRes.iptype);
                            success({
                                ip: ipTypeRes.ip,
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
                console.log("pgeolocation.io结果:" + JSON.stringify(data))
                success({
                    ip: data.ip,
                    addr: data.country_emoji+data.country_name+ ' ' + data.state_prov + ' '
                        + data.city + ' ' + data.district,
                    isp: data.isp,
                    net_str: data.organization
                });
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
                console.log("ipinfo.io结果:"+data);
                success({
                    ip: data.ip,
                    addr: data.country + ' ' + data.region + ' ' + data.city,
                    isp: data.org,
                    net_str: data.org
                })
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
                console.log("Ipify结果:"+ data);
                success({
                    ip: data.ip,
                    addr: "",
                    isp: "",
                    net_str: ""
                })
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
    fromIpgeolocation(() => fromPing0(() => fromIpInfo(
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

        const [lng, lat] = wgs84ToBd09(longitude,latitude);
        let url = "http://api.map.baidu.com/geocoder?location="
            + lat + "," + lng + "&output=json";
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

        // 做转换
        const [gcjLng, gcjLat] = wgs84ToGcj02(longitude, latitude);
        console.info("高德地图转换后的经纬度: " + gcjLng + "," + gcjLat);
        let url = "https://restapi.amap.com/v3/geocode/regeo?key=c58d08114ec1edd8e5e60242824bd202&" +
            "location=" + gcjLng + "," + gcjLat;
        console.info("从高德地图开始根据经纬度获取地址latitude:"+latitude + "longitude:"+longitude)
        fetch(url).then(response => {
            if (response.ok) {
                response.json().then(bodyObj => {
                    console.log("从高德地图开始根据经纬度获取地址: "+ bodyObj)
                    if(bodyObj.status === "1"){
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
        const [gcjLng, gcjLat] = wgs84ToGcj02(longitude,latitude);
        let url = "https://apimobile.meituan.com/group/v1/city/latlng/"
            + gcjLat + "," + gcjLng + "?tag=0";
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


    const userNodeNavigator = function () {
        console.log("使用mode_navigator.geolocation")
        mode_navigator.geolocation.getCurrentPosition(
            (loc, error) => {
                if(error || !loc){
                    // 获取不到经纬度，直接从高德获取
                    console.error(error);
                    fromGaodeIp("","", () => fail("无法获取地址信息"));
                    return;
                }
                const { latitude, longitude} = loc;
                fromMyGaodeKey(latitude,longitude,
                    () => fromBaidu(latitude, longitude,
                        () => fromMeiTuan(latitude, longitude,
                            () => fromGaodeIp("","",
                                () => fail("无法获取地址信息")))));

            });
    }
    if (navigator.geolocation) {
        console.log("使用navigator.geolocation")
        navigator.geolocation.getCurrentPosition(
            (loc) => {
                const { latitude, longitude} = loc.coords;
                fromMyGaodeKey(latitude,longitude,
                    () => fromBaidu(latitude, longitude,
                        () => fromMeiTuan(latitude, longitude,
                            () => fromGaodeIp("","",
                                () => fail("无法获取地址信息")))));
            },
            (error) => {
                console.error(error);
                userNodeNavigator();
            }
        );
    } else if (mode_navigator.geolocation) {
        userNodeNavigator();
    } else {
        console.error("不支持定位");
        fromGaodeIp("","", () => fail("无法获取地址信息"));
    }
}

// 百度地图要用
function wgs84ToBd09(lng, lat) {
    const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
    return gcj02ToBd09(gcjLng, gcjLat);
}

function gcj02ToBd09(lng, lat) {
    const x = lng, y = lat;
    const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * Math.PI);
    const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * Math.PI);
    const bdLng = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return [bdLng, bdLat];
}

// 经纬度坐标系转换，高德和美团要用
function wgs84ToGcj02(lng, lat) {
    const a = 6378245.0;
    const ee = 0.00669342162296594323;

    function transformLat(x, y) {
        let ret = -100 + 2 * x + 3 * y + 0.2 * y * y +
            0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20 * Math.sin(6 * x * Math.PI) +
            20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
        ret += (20 * Math.sin(y * Math.PI) +
            40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
        ret += (160 * Math.sin(y / 12 * Math.PI) +
            320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
        return ret;
    }

    function transformLng(x, y) {
        let ret = 300 + x + 2 * y + 0.1 * x * x +
            0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20 * Math.sin(6 * x * Math.PI) +
            20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
        ret += (20 * Math.sin(x * Math.PI) +
            40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
        ret += (150 * Math.sin(x / 12 * Math.PI) +
            300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
        return ret;
    }

    function outOfChina(lng, lat) {
        return lng < 72.004 || lng > 137.8347 ||
            lat < 0.8293 || lat > 55.8271;
    }

    // 中国境外不转换
    if (outOfChina(lng, lat)) {
        return [lng, lat];
    }

    let dLat = transformLat(lng - 105, lat - 35);
    let dLng = transformLng(lng - 105, lat - 35);

    const radLat = lat / 180 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;

    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);

    return [lng + dLng, lat + dLat];
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
