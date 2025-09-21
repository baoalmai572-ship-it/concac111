const { readJsonSync, writeJsonSync, ensureDirSync, existsSync } = require("fs-extra");
const path = require('path');
const axios = require('axios');

// --- Cấu hình đường dẫn ---
const cacheDir = path.join(__dirname, "cache");
const antiPath = path.join(cacheDir, "anti_settings.json");
const chongCuopBoxDir = path.join(cacheDir, "chongcuopbox");
const monitoringPath = path.join(chongCuopBoxDir, "monitoring.json");
const blacklistPath = path.join(chongCuopBoxDir, "blacklist.json");
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json'); // Đường dẫn tới file limit

ensureDirSync(cacheDir);
ensureDirSync(chongCuopBoxDir);
if (!existsSync(antiPath)) writeJsonSync(antiPath, {});
if (!existsSync(monitoringPath)) writeJsonSync(monitoringPath, {});
if (!existsSync(blacklistPath)) writeJsonSync(blacklistPath, {});

class Catbox {
    async uploadImage(url) {
        try {
            const response = await axios.get(`https://catbox-mnib.onrender.com/upload?url=${encodeURIComponent(url)}`);
            if (response.data && response.data.url) return response.data.url;
            throw new Error("API response không hợp lệ từ Catbox");
        } catch (error) {
            console.error("[CATBOX ERROR] Lỗi khi upload ảnh:", error.message);
            return null;
        }
    }
}

module.exports.config = {
    name: "anti",
    version: "18.0.0", // Nâng cấp để tương thích với hệ thống limit
    hasPermssion: 1, // Chỉ Quản trị viên nhóm mới có thể sử dụng
    credits: "Pcoder & Gemini",
    description: "Cấu hình các tính năng bảo vệ nhóm (tích hợp limit).",
    commandCategory: "quản trị viên",
    usages: "[blacklist view]",
    cooldowns: 5,
    dependencies: { "axios": "", "fs-extra": "", "path": "" }
};

const getThreadData = (threadID) => readJsonSync(antiPath, { throws: false })?.[threadID] || {};
const saveThreadData = (threadID, data) => {
    const allSettings = readJsonSync(antiPath, { throws: false }) || {};
    allSettings[threadID] = { ...allSettings[threadID], ...data };
    writeJsonSync(antiPath, allSettings, { spaces: 4 });
};

module.exports.run = async ({ api, event, args, Users }) => {
    const { threadID, messageID } = event;

    // --- MỚI: KIỂM TRA HỆ THỐNG LIMIT ---
    // Ghi chú: Đoạn check này thực ra đã có trong handleCommand.js
    // Nhưng để đây để đảm bảo lệnh không chạy sai nếu handleCommand bị sửa.
    try {
        const limitData = readJsonSync(limitPath, { throws: false }) || {};
        const threadLimit = limitData[threadID];
        if (threadLimit && threadLimit.anti === false) {
             return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Anti'", threadID, messageID);
        }
    } catch (e) {
        console.log("Lỗi khi đọc file limit.json trong lệnh anti:", e);
    }
    // --- KẾT THÚC KIỂM TRA ---

    const command = args[0]?.toLowerCase();
    
    if (command === 'blacklist' && args[1]?.toLowerCase() === 'view') {
        const blacklist = readJsonSync(blacklistPath, { throws: false }) || {};
        if (Object.keys(blacklist).length === 0) return api.sendMessage("✅ Danh sách đen hiện đang trống.", threadID, messageID);
        let msg = "🔐 DANH SÁCH ĐEN:\n\n";
        for (const [uid, data] of Object.entries(blacklist)) {
            const userName = (await Users.getData(uid))?.name || uid;
            msg += `- Tên: ${userName} (UID: ${uid})\n- Lý do: ${data.reason}\n\n`;
        }
        return api.sendMessage(msg, threadID, messageID);
    }

    try {
        const threadSettings = getThreadData(threadID);
        const options = [
            { name: "Anti đổi tên nhóm", setting: "antiChangeGroupName" },
            { name: "Anti đổi ảnh nhóm", setting: "antiChangeGroupImage" },
            { name: "Anti đổi biệt danh", setting: "antiChangeNickname" },
            { name: "Anti out chùa", setting: "antiOut" },
            { name: "Anti QTV (cướp box)", setting: "antiQTV" },
            { name: "Anti thêm thành viên", setting: "antiJoin" },
            { name: "Anti gửi link", setting: "antiLink" },
            { name: "Anti tag (all/nhiều)", setting: "antiTag" }
        ];

        let menuText = "🛡️ BẢNG ĐIỀU KHIỂN ANTI 🛡️\n\n";
        options.forEach((opt, index) => {
            const statusIcon = threadSettings[opt.setting] ? "✅" : "❌";
            menuText += `${index + 1}. ${statusIcon} ${opt.name}\n`;
        });
        menuText += "\n👉 Reply tin nhắn này bằng số để Bật/Tắt.\n(Có thể chọn nhiều, ví dụ: 1 2 5)";

        api.sendMessage(menuText, threadID, (err, info) => {
            if (err) return console.error("[ANTI CMD ERROR]", err);
            global.client.handleReply.push({
                name: module.exports.config.name,
                messageID: info.messageID,
                author: event.senderID,
                options
            });
        }, messageID);
    } catch (error) {
        console.error("[ANTI CMD CRITICAL]", error);
        api.sendMessage("Đã có lỗi xảy ra, không thể hiển thị menu anti.", threadID, messageID);
    }
};

module.exports.handleReply = async function ({ api, event, handleReply, Threads }) {
    const { threadID, messageID, senderID, body } = event;
    
    // Chỉ người ra lệnh ban đầu mới được reply
    if (senderID !== handleReply.author) return;

    const { options } = handleReply;
    const choices = [...new Set(body.split(/\s+|,/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= options.length))];
    
    if (choices.length === 0) return;

    api.unsendMessage(handleReply.messageID).catch(() => {});

    try {
        let settingsToSave = getThreadData(threadID);
        const changedFeatures = [];
        let threadInfo;

        const needsInfoFetch = choices.some(choice => !settingsToSave[options[choice - 1].setting]);
        if (needsInfoFetch) {
            threadInfo = await Threads.getInfo(threadID);
        }

        for (const choice of choices) {
            const option = options[choice - 1];
            const newStatus = !settingsToSave[option.setting];
            settingsToSave[option.setting] = newStatus;

            if (newStatus && threadInfo) {
                switch (option.setting) {
                    case "antiChangeGroupName": settingsToSave.groupName = threadInfo.threadName; break;
                    case "antiChangeGroupImage":
                        if (threadInfo.imageSrc) {
                            const catbox = new Catbox();
                            settingsToSave.groupImage = await catbox.uploadImage(threadInfo.imageSrc) || threadInfo.imageSrc;
                        }
                        break;
                    case "antiChangeNickname": settingsToSave.nicknames = threadInfo.nicknames; break;
                }
            }
            changedFeatures.push(`- ${option.name}: Đã ${newStatus ? "Bật" : "Tắt"}`);
        }

        saveThreadData(threadID, settingsToSave);
        api.sendMessage(`[ CẬP NHẬT ANTI ]\n\n${changedFeatures.join("\n")}`, threadID, messageID);
    } catch (error) {
        console.error("[ANTI REPLY CRITICAL]", error);
        api.sendMessage("Đã có lỗi xảy ra khi cập nhật cài đặt anti.", threadID, messageID);
    }
};
