const fs = require('fs');
const path = require('path');

module.exports.config = {
    name: 'menu',
    version: '2.0.0', // Phiên bản cuối
    hasPermssion: 0,
    credits: 'Hoàng',
    description: 'Xem danh sách nhóm lệnh, thông tin lệnh (Chỉ dành cho Admin Bot)',
    commandCategory: 'Admin',
    usages: '[...name commands|all]',
    cooldowns: 5,
    envConfig: {
        autoUnsend: { status: true, timeOut: 90 }
    }
};

const { autoUnsend = this.config.envConfig.autoUnsend } = global.config == undefined ? {} : global.config.menu == undefined ? {} : global.config.menu;
const { compareTwoStrings, findBestMatch } = require('string-similarity');

module.exports.run = async function ({ api, event, args }) {
    const { ADMINBOT } = global.config;
    const { threadID, messageID, senderID } = event;

    // >>> CÂU CHỬI GẮT NHẤT - KHÔNG CÓ TỪ "ADMIN" <<<
    if (!ADMINBOT.includes(senderID)) {
        return api.sendMessage("Mày sinh ra đã là tầng lớp dưới đáy rồi thì an phận đi, đừng có cố trèo cao rồi ngã vỡ mồm. Lệnh này không dành cho mày.", threadID, messageID);
    }

    const { sendMessage: send, unsendMessage: un } = api;
    const cmds = Array.from(global.client.commands.values());

    if (args.length >= 1) {
        if (typeof cmds.find(cmd => cmd.config.name === args.join(' ')) == 'object') {
            const body = infoCmds(cmds.find(cmd => cmd.config.name === args.join(' ')).config);
            return send({ body }, threadID, messageID);
        } else {
            if (args[0] == 'all') {
                let txt = '╭──────────[ ALL ]─────────⭓\n', count = 0;
                for (const cmd of cmds) txt += `│${++count}. ${cmd.config.name} | ${cmd.config.description}\n`;
                txt += `│────────⭔\n│ Gỡ tự động sau: ${autoUnsend.timeOut}s\n╰─────────────⭓`;
                return send({ body: txt }, threadID, (a, b) => autoUnsend.status ? setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID) : '');
            } else {
                const arrayCmds = cmds.map(cmd => cmd.config.name);
                const similarly = findBestMatch(args.join(' '), arrayCmds);
                if (similarly.bestMatch.rating >= 0.3) return send(`"${args.join(' ')}" là lệnh gần giống là "${similarly.bestMatch.target}" ?`, threadID, messageID);
            }
        }
    } else {
        const data = commandsGroup(cmds);
        let txt = '╭────[ ADMIN MENU ]────⭓\n', count = 0;
        for (const { commandCategory, commandsName } of data) txt += `│${++count}. ${commandCategory} - ${commandsName.length} lệnh\n`;
        txt += `│────────⭔\n│Hiện có ${cmds.length} lệnh\n│Reply từ 1 đến ${data.length} để chọn\n│Gỡ tự động sau: ${autoUnsend.timeOut}s\n╰─────────────⭓`;
        send({ body: txt }, threadID, (a, b) => {
            global.client.handleReply.push({ name: this.config.name, messageID: b.messageID, author: senderID, 'case': 'infoGr', data });
            if (autoUnsend.status) setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID);
        });
    }
};

module.exports.handleReply = async function ({ handleReply: $, api, event }) {
    const { sendMessage: send, unsendMessage: un } = api;
    const { threadID: tid, messageID: mid, senderID: sid, args } = event;
    
    // >>> KHÔNG CHỬI KHI REPLY, CHỈ IM LẶNG <<<
    if (sid != $.author) {
        return; // Không làm gì cả
    }

    const cmds = Array.from(global.client.commands.values());
    switch ($.case) {
        case 'infoGr': {
            const data = $.data[(+args[0]) - 1];
            if (data == undefined) return send(`"${args[0]}" không nằm trong số thứ tự menu`, tid, mid);
            un($.messageID);
            let txt = '╭─────────────⭓\n │' + data.commandCategory + '\n│─────⭔\n', count = 0;
            for (const name of data.commandsName) txt += `│${++count}. ${name}\n`;
            txt += `│────────⭔\n│Reply từ 1 đến ${data.commandsName.length} để chọn\n│Gỡ tự động sau: ${autoUnsend.timeOut}s\n╰─────────────⭓`;
            send({ body: txt }, tid, (a, b) => {
                global.client.handleReply.push({ name: this.config.name, messageID: b.messageID, author: sid, 'case': 'infoCmds', data: data.commandsName });
                if (autoUnsend.status) setTimeout(v1 => un(v1), 1000 * autoUnsend.timeOut, b.messageID);
            });
            break;
        }
        case 'infoCmds': {
            const data = cmds.find(cmd => cmd.config.name === $.data[(+args[0]) - 1]);
            if (typeof data != 'object') return send(`"${args[0]}" không nằm trong số thứ tự menu`, tid, mid);
            const { config = {} } = data || {};
            un($.messageID);
            send({ body: infoCmds(config) }, tid, mid);
            break;
        }
    }
};

function commandsGroup(cmds) {
    const array = [];
    for (const cmd of cmds) {
        const { name, commandCategory } = cmd.config;
        const find = array.find(i => i.commandCategory == commandCategory);
        !find ? array.push({ commandCategory, commandsName: [name] }) : find.commandsName.push(name);
    }
    array.sort((a, b) => b.commandsName.length - a.commandsName.length);
    return array;
}

function infoCmds(a) {
    return `╭── INFO ────⭓\n│ 📔 Tên lệnh: ${a.name}\n│ 🌴 Phiên bản: ${a.version}\n│ 🔐 Quyền hạn: ${premssionTxt(a.hasPermssion)}\n│ 👤 Tác giả: ${a.credits}\n│ 🌾 Mô tả: ${a.description}\n│ 📎 Thuộc nhóm: ${a.commandCategory}\n│ 📝 Cách dùng: ${a.usages}\n│ ⏳ Thời gian chờ: ${a.cooldowns} giây\n╰─────────────⭓`;
}

function premssionTxt(a) {
    return a == 0 ? 'Thành Viên' : a == 1 ? 'Quản Trị Viên' : a == 2 ? 'Admin Bot' : 'Admin Bot';
}
