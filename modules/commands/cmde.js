const path = require("path"); 

module.exports.config = {
    name: "cmde",
    version: "1.0.0",
    hasPermssion: 2,
    credits: "Mirai Team & pcoder Edit",
    description: "Quản lý/Kiểm soát toàn bộ event module của bot (từ commands)",
    commandCategory: "Hệ thống",
    usePrefix: false,
    usages: "[load/unload/loadAll/unloadAll/info] [tên event]",
    cooldowns: 2,
    dependencies: {
        "fs-extra": "",
        "child_process": "",
        "path": ""
    }
};

const loadEvent = function ({ moduleList, threadID, messageID }) {
    const { execSync } = global.nodemodule['child_process'];
    const { writeFileSync, unlinkSync, readFileSync } = global.nodemodule['fs-extra'];
    const { join } = global.nodemodule['path'];
    const { configPath, mainPath, api } = global.client;
    const logger = require(mainPath + '/pdata/utils/log');
    const eventsDir = path.join(global.client.mainPath, "modules", "events");
    let errorList = [];

    delete require['resolve'][require['resolve'](configPath)];
    let configValue = require(configPath);
    writeFileSync(configPath + '.temp', JSON.stringify(configValue, null, 2), 'utf8');
    for (const nameModule of moduleList) {
        try {
            const dirModule = path.join(eventsDir, nameModule + '.js');
            delete require['cache'][require['resolve'](dirModule)];
            const event = require(dirModule);
            global.client.events.delete(nameModule);
            if (!event.config || !event.run) 
                throw new Error('[ 𝗖𝗠𝗗𝗘 ] - Event không đúng định dạng!');
            if (event.config.dependencies && typeof event.config.dependencies == 'object') {
                const listPackage = JSON.parse(readFileSync('./package.json')).dependencies,
                    listbuiltinModules = require('module')['builtinModules'];
                for (const packageName in event.config.dependencies) {
                    let tryLoadCount = 0,
                        loadSuccess = false,
                        error;
                    const moduleDir = join(global.client.mainPath, 'nodemodules', 'node_modules', packageName);
                    try {
                        if (listPackage.hasOwnProperty(packageName) || listbuiltinModules.includes(packageName)) global.nodemodule[packageName] = require(packageName);
                        else global.nodemodule[packageName] = require(moduleDir);
                    } catch {
                        logger.loader('[ 𝗖𝗠𝗗𝗘 ] - Không tìm thấy package ' + packageName + ' hỗ trợ cho event ' + event.config.name + ' tiến hành cài đặt...', 'warn');
                        const insPack = {};
                        insPack.stdio = 'inherit';
                        insPack.env = process.env ;
                        insPack.shell = true;
                        insPack.cwd = join(global.client.mainPath,'nodemodules')
                        execSync('npm --package-lock false --save install ' + packageName + (event.config.dependencies[packageName] == '*' || event.config.dependencies[packageName] == '' ? '' : '@' + event.config.dependencies[packageName]), insPack);
                        for (tryLoadCount = 1; tryLoadCount <= 3; tryLoadCount++) {
                            require['cache'] = {};
                            try {
                                if (listPackage.hasOwnProperty(packageName) || listbuiltinModules.includes(packageName)) global.nodemodule[packageName] = require(packageName);
                                else global.nodemodule[packageName] = require(moduleDir);
                                loadSuccess = true;
                                break;
                            } catch (erorr) {
                                error = erorr;
                            }
                            if (loadSuccess || !error) break;
                        }
                        if (!loadSuccess || error) throw 'Không thể tải package ' + packageName + (' cho event ') + event.config.name +', lỗi: ' + error + ' ' + error['stack'];
                    }
                }
                logger.loader('[ 𝗖𝗠𝗗𝗘 ] -  Đã tải thành công toàn bộ package cho event ' + event.config.name);
            }
            if (event.config.envConfig && typeof event.config.envConfig == 'Object') try {
                for (const [key, value] of Object.entries(event.config.envConfig)) {
                    if (typeof global.configModule[event.config.name] === "undefined") 
                        global.configModule[event.config.name] = {};
                    if (typeof configValue[event.config.name] === "undefined") 
                        configValue[event.config.name] = {};
                    if (typeof configValue[event.config.name][key] !== "undefined") 
                        global.configModule[event.config.name][key] = configValue[event.config.name][key];
                    else global.configModule[event.config.name][key] = value || '';
                    if (typeof configValue[event.config.name][key] === "undefined") 
                        configValue[event.config.name][key] = value || '';
                }
                logger.loader('Loaded config ' + event.config.name);
            } catch (error) {
                throw new Error('[ 𝗖𝗠𝗗𝗘 ] » Không thể tải config event, Lỗi: ' + JSON.stringify(error));
            }
            if (event['onLoad']) try {
                const onLoads = {};
                onLoads['configValue'] = configValue;
                event['onLoad'](onLoads);
            } catch (error) {
                throw new Error('[ 𝗖𝗠𝗗𝗘 ] » Không thể onLoad event, Lỗi: ' + JSON.stringify(error), 'error');
            }
            global.client.events.set(event.config.name, event)
            logger.loader('Loaded event ' + event.config.name + '!');
        } catch (error) {
            errorList.push('- ' + nameModule + ' reason:' + error + ' at ' + error['stack']);
        };
    }
    if (errorList.length != 0) api.sendMessage('[ 𝗖𝗠𝗗𝗘 ] » Những event vừa xảy ra sự cố khi hệ thống loading: ' + errorList.join(' '), threadID, messageID);
    api.sendMessage('[ 𝗖𝗠𝗗𝗘 ] » 𝘃𝘂̛̀𝗮 𝘁𝗮̉𝗶 𝘁𝗵𝗮̀𝗻𝗵 𝗰𝗼̂𝗻𝗴 ' + (moduleList.length - errorList.length) +' 𝗲𝘃𝗲𝗻𝘁\n━━━━━━━━━━━━━━━━\n[ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹 ] » 𝗲𝘃𝗲𝗻𝘁𝘀 ('+moduleList.join(', ') + '.js) 💓', threadID, messageID) 
    writeFileSync(configPath, JSON.stringify(configValue, null, 4), 'utf8')
    unlinkSync(configPath + '.temp');
    return;
}

const unloadEvent = function ({ moduleList, threadID, messageID }) {
    const { writeFileSync, unlinkSync } = global.nodemodule["fs-extra"];
    const { configPath, mainPath, api } = global.client;
    const logger = require(mainPath + "/pdata/utils/log");
    const eventsDir = path.join(global.client.mainPath, "modules", "events");

    delete require.cache[require.resolve(configPath)];
    let configValue = require(configPath);
    writeFileSync(configPath + ".temp", JSON.stringify(configValue, null, 4), 'utf8');

    for (const nameModule of moduleList) {
        global.client.events.delete(nameModule);
        configValue["eventDisabled"] = configValue["eventDisabled"] || [];
        global.config["eventDisabled"] = global.config["eventDisabled"] || [];
        configValue["eventDisabled"].push(`${nameModule}.js`);
        global.config["eventDisabled"].push(`${nameModule}.js`);
        logger.loader(`Unloaded event ${nameModule}!`);
    }

    writeFileSync(configPath, JSON.stringify(configValue, null, 4), 'utf8');
    unlinkSync(configPath + ".temp");

    return api.sendMessage(`[ 𝗖𝗠𝗗𝗘 ] » Đã hủy thành công ${moduleList.length} event ✨`, threadID, messageID);
}

module.exports.run = function ({ event, args, api }) {
    const permission = ["", "61575999835460"];
    if (!permission.includes(event.senderID)) return api.sendMessage("[ 𝗗𝗘𝗩 𝗠𝗢𝗗𝗘 ] Lệnh này chỉ dành cho 𝗡𝗵𝗮̀ 𝗣𝗵𝗮́𝘁 𝗧𝗿𝗶𝗲̂̉𝗻 💻", event.threadID, event.messageID);
    const { readdirSync } = global.nodemodule["fs-extra"];
    const { threadID, messageID } = event;
    const eventsDir = path.join(global.client.mainPath, "modules", "events");
    let moduleList = args.splice(1, args.length);

    switch (args[0]) {
        case "count":
        case "c": {
            let events = client.events.values();
            let infoEvent = "";
            api.sendMessage("[ 𝗖𝗠𝗗𝗘 ] - Hiện tại gồm có " + client.events.size + " event có thể sử dụng 💌" + infoEvent, threadID, messageID);
            break;
        }
        case "load":
        case "l": {
            if (moduleList.length == 0) return api.sendMessage("[ 𝗖𝗠𝗗𝗘 ] » Tên event không cho phép bỏ trống ⚠️", threadID, messageID);
            else return loadEvent({ moduleList, threadID, messageID });
        }
        case "unload":
        case "ul": {
            if (moduleList.length == 0) return api.sendMessage("[ 𝗖𝗠𝗗𝗘 ] » Tên event không cho phép bỏ trống ⚠️", threadID, messageID);
            else return unloadEvent({ moduleList, threadID, messageID });
        }
        case "loadAll":
        case "all":  {
            moduleList = readdirSync(eventsDir).filter((file) => file.endsWith(".js") && !file.includes('example'));
            moduleList = moduleList.map(item => item.replace(/\.js/g, ""));
            return loadEvent({ moduleList, threadID, messageID });
        }
        case "unloadAll":
        case "uall":  {
            moduleList = readdirSync(eventsDir).filter((file) => file.endsWith(".js") && !file.includes('example'));
            moduleList = moduleList.map(item => item.replace(/\.js/g, ""));
            return unloadEvent({ moduleList, threadID, messageID });
        }
        case "info":
        case "i":  {
            const event = global.client.events.get(moduleList.join("") || "");
            if (!event) return api.sendMessage("[ 𝗖𝗠𝗗𝗘 ] » Event bạn nhập không tồn tại ⚠️", threadID, messageID);

            const { name, version, hasPermssion, credits, cooldowns, dependencies } = event.config;
            return api.sendMessage(
                "=== " + name.toUpperCase() + " ===\n" +
                "- Được code bởi: " + credits + "\n" +
                "- Phiên bản: " + version + "\n" +
                "- Yêu cầu quyền hạn: " + ((hasPermssion == 0) ? "Người dùng" : (hasPermssion == 1) ? "Quản trị viên" : "Người vận hành bot" ) + "\n" +
                "- Thời gian chờ: " + cooldowns + " giây(s)\n" +
                `- Các package yêu cầu: ${(Object.keys(dependencies || {})).join(", ") || "Không có"}`,
                threadID, messageID
            );
        }
        default: {
            return global.utils.throwError(this.config.name, threadID, messageID);
        }
    }
};