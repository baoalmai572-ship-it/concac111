const fs = require('fs');
const path = __dirname + '/cache/limit.json';

module.exports.config = {
    name: "limit",
    version: "1.0.2",
    hasPermssion: 2,
    credits: "D-Jukie (Fixed by Gemini)",
    description: "Bật/tắt các nhóm lệnh cho từng nhóm chat. (Chỉ Admin Bot)",
    commandCategory: "Admin",
    usages: "",
    cooldowns: 5,
};

// --- Định nghĩa các nhóm lệnh --- //
const commandGroups = {
    game: {
        name: "Game",
        commands: ["1key", "1hoso", "tinhdiem", "tinhdiemlogo"]
    },
    anti: {
        name: "Anti",
        commands: ["antiout", "antijoin"]
    },
    autopost: {
        name: "Tự Động Lên Bảng",
        commands: ["custom"]
    }
};

// Hàm để tải dữ liệu, tự động tạo file nếu chưa có
function loadData() {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, JSON.stringify({}));
        return {};
    }
    try {
        const data = fs.readFileSync(path, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

// Hàm để lưu dữ liệu
function saveData(data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 4));
}

// Hàm kiểm tra và khởi tạo cài đặt cho thread
function initializeThreadSettings(threadID, limitData) {
    let settingsUpdated = false;
    if (!limitData[threadID]) {
        limitData[threadID] = {};
        settingsUpdated = true;
    }
    for (const group in commandGroups) {
        if (typeof limitData[threadID][group] === 'undefined') {
            limitData[threadID][group] = true; // Mặc định là bật
            settingsUpdated = true;
        }
    }
    return settingsUpdated;
}

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const { ADMINBOT } = global.config;

    if (!ADMINBOT.includes(senderID)) {
        return api.sendMessage("⚠️ Lệnh này chỉ dành cho Admin Bot.", threadID, messageID);
    }

    let limitData = loadData();
    const settingsUpdated = initializeThreadSettings(threadID, limitData);
    if (settingsUpdated) {
        saveData(limitData);
    }

    const threadSettings = limitData[threadID];
    const groupKeys = Object.keys(commandGroups);

    let msg = "==== [ ⚙️ CÀI ĐẶT NHÓM LỆNH ] ====\n";
    let i = 1;
    for (const groupKey of groupKeys) {
        const groupName = commandGroups[groupKey].name;
        const status = threadSettings[groupKey] === false ? "❌ Tắt" : "✅ Bật";
        msg += `${i++}. ${groupName}: ${status}\n`;
    }
    msg += "\n📌 Reply (phản hồi) tin nhắn này kèm số thứ tự để bật/tắt nhóm lệnh tương ứng.";

    return api.sendMessage(msg, threadID, (error, info) => {
        global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: senderID,
            threadID: threadID,
            groupKeys: groupKeys
        });
    }, messageID);
};

module.exports.handleReply = async function({ api, event, handleReply }) {
    const { threadID, messageID, body, senderID } = event;
    const { ADMINBOT } = global.config;

    if (senderID !== handleReply.author) {
        return api.sendMessage("👉 Bạn không phải người dùng lệnh, không thể reply.", threadID, messageID);
    }

    if (!ADMINBOT.includes(senderID)) {
        return api.sendMessage("⚠️ Bạn không có quyền thực hiện hành động này.", threadID, messageID);
    }

    const choice = parseInt(body);
    if (isNaN(choice) || choice < 1 || choice > handleReply.groupKeys.length) {
        return api.sendMessage(`⚠️ Lựa chọn không hợp lệ. Vui lòng chọn một số từ 1 đến ${handleReply.groupKeys.length}.`, threadID, messageID);
    }
    
    let limitData = loadData();
    initializeThreadSettings(threadID, limitData);
    const threadSettings = limitData[threadID];
    
    const groupToToggle = handleReply.groupKeys[choice - 1];
    const groupName = commandGroups[groupToToggle].name;

    threadSettings[groupToToggle] = !(threadSettings[groupToToggle]);
    saveData(limitData);

    api.unsendMessage(handleReply.messageID).catch(e => {});

    let statusMsg = `✅ Đã ${threadSettings[groupToToggle] ? "BẬT" : "TẮT"} nhóm lệnh "${groupName}".\n\n`;
    statusMsg += "==== [ ⚙️ TRẠNG THÁI HIỆN TẠI ] ====\n";
    let i = 1;
    for (const groupKey of handleReply.groupKeys) {
        const currentGroupName = commandGroups[groupKey].name;
        const status = limitData[threadID][groupKey] ? "✅ Bật" : "❌ Tắt";
        statusMsg += `${i++}. ${currentGroupName}: ${status}\n`;
    }

    return api.sendMessage(statusMsg, threadID, messageID);
};
