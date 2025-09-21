const fs = require('fs');
const request = require('request');

module.exports.config = {
    name: "sendnoti",
    version: "3.1.0",
    hasPermssion: 2,
    credits: "pcoder",
    description: "Gửi tin nhắn + video từ admin tới tất cả nhóm, hỗ trợ phản hồi hai chiều",
    commandCategory: "Tiện ích",
    usages: "[nội dung]",
    cooldowns: 5,
};

let atmDir = [];

// Tải và đính kèm file phương tiện (ảnh/video) từ attachment Facebook
const getAtm = (atm, body) => new Promise(async (resolve) => {
    let msg = {}, attachment = [];
    msg.body = body;
    for (let eachAtm of atm) {
        await new Promise((res) => {
            try {
                let stream = request.get(eachAtm.url);
                stream.on('response', (response) => {
                    let pathName = response.request.uri.pathname;
                    let ext = pathName.substring(pathName.lastIndexOf('.') + 1) || 'jpg';
                    let filePath = __dirname + `/cache/${eachAtm.filename || Date.now()}.${ext}`;
                    stream.pipe(fs.createWriteStream(filePath))
                        .on("finish", () => {
                            attachment.push(fs.createReadStream(filePath));
                            atmDir.push(filePath);
                            res();
                        })
                        .on("error", err => {
                            console.log("Lỗi ghi file attachment:", err);
                            res();
                        });
                });
            } catch (e) {
                console.log("Lỗi tải attachment:", e);
                res();
            }
        });
    }
    msg.attachment = attachment;
    resolve(msg);
});

module.exports.handleReply = async function ({ api, event, handleReply, Users, Threads }) {
    const moment = require("moment-timezone");
    const gio = moment.tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY - HH:mm:ss");
    const { threadID, messageID, senderID, body } = event;
    let name = await Users.getNameUser(senderID);
    switch (handleReply.type) {
        case "sendnoti": {
            let msgText = `====== [ 𝗣𝗵𝗮̉𝗻 𝗵𝗼̂̀𝗶 𝘁𝘂̛̀ 𝗨𝘀𝗲𝗿 ] ======\n━━━━━━━━━━━━━━━━━━\n『⏱』𝐓𝐢𝐦𝐞: ${gio}\n『📝』𝐍𝐼̣𝐨̣̂𝐢 𝐝𝐮𝐧𝐠: ${body}\n『📩』𝐏𝐡𝐚̉𝐧 𝐡𝐨̂̀𝐢 𝐭𝐮̛̀ 𝐔𝘀𝗲𝗿: ${name}  trong nhóm ${(await Threads.getInfo(threadID)).threadName || "Unknown"}\n━━━━━━━━━━━━━━━━\n»『💬』Reply tin nhắn này nếu muốn phản hồi tới User`;
            let msg = msgText;
            if (event.attachments.length > 0) msg = await getAtm(event.attachments, msgText);
            api.sendMessage(msg, handleReply.threadID, (err, info) => {
                atmDir.forEach(each => fs.unlinkSync(each));
                atmDir = [];
                global.client.handleReply.push({
                    name: module.exports.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    messID: messageID,
                    threadID
                });
            });
            break;
        }
        case "reply": {
            let msgText = `==== [ 𝑷𝒉𝒂̉𝒏 𝒉𝒐̂̀𝒊 𝒕𝒖̛̀ 𝑨𝑫𝑴𝑰𝑵 ] ====\n━━━━━━━━━━━━━━━━━━\n『⏱』𝐓𝐢𝐦𝐞: ${gio}\n『📝』Nội dung: ${body}\n『📩』Phản hồi từ Admin: ${name}\n━━━━━━━━━━━━━━━━\n» » Reply tin nhắn này nếu muốn phản hồi về Admin 💬`;
            let msg = msgText;
            if (event.attachments.length > 0) msg = await getAtm(event.attachments, msgText);
            api.sendMessage(msg, handleReply.threadID, (err, info) => {
                atmDir.forEach(each => fs.unlinkSync(each));
                atmDir = [];
                global.client.handleReply.push({
                    name: module.exports.config.name,
                    type: "sendnoti",
                    messageID: info.messageID,
                    threadID
                });
            }, handleReply.messID);
            break;
        }
    }
};

module.exports.run = async function ({ api, event, args, Users }) {
    const moment = require("moment-timezone");
    const gio = moment.tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY - HH:mm:ss");
    const { threadID, messageID, senderID, messageReply } = event;

    if (!args[0]) return api.sendMessage("Vui lòng nhập nội dung thông báo.", threadID);

    let allThread = global.data.allThreadID || [];
    let can = 0, canNot = 0;
    let msgText = `» 𝗧𝗛𝗢̂𝗡𝗚 𝗕𝗔́𝗢 𝗔𝗗𝗠𝗜𝗡 «\n━━━━━━━━━━━━━━━━━━\n『⏰』Time: ${gio}\n『📝』Nội dung: ${args.join(" ")}\n『👤』Từ ADMIN: ${await Users.getNameUser(senderID)}\n━━━━━━━━━━━━━━━━━━\n『💬』Reply tin nhắn này nếu muốn (phản hồi) về ADMIN.`;

    let msg = msgText;
    if (event.type == "message_reply" && messageReply && messageReply.attachments.length > 0) {
        msg = await getAtm(messageReply.attachments, msgText);
    }

    // Gửi tới từng nhóm, dùng Promise.all để chờ gửi xong và tránh resolve quá sớm
    await Promise.all(allThread.map(each => new Promise((resolveSend) => {
        api.sendMessage(msg, each, (err, info) => {
            if (err) canNot++;
            else {
                can++;
                atmDir.forEach(each => fs.existsSync(each) && fs.unlinkSync(each));
                atmDir = [];
                global.client.handleReply.push({
                    name: module.exports.config.name,
                    type: "sendnoti",
                    messageID: info.messageID,
                    messID: messageID,
                    threadID: each
                });
            }
            resolveSend();
        });
    })));

    api.sendMessage(`✅ Đã gửi thông báo thành công tới ${can} nhóm.\n❌ Không thể gửi tới ${canNot} nhóm.`, threadID);
};