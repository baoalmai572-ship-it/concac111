module.exports.config = {
    name: "qtvonly",
    version: "2.0.0",
    hasPermssion: 1,
    credits: "Khang (Sửa lỗi bởi D-Jukie)",
    description: "Bật/tắt chế độ chỉ Quản trị viên nhóm mới có thể sử dụng bot.",
    commandCategory: "Quản Trị Viên",
    usages: "qtvonly",
    cooldowns: 5,
    dependencies: {
        "fs-extra": ""
    }
};

const pathData = require("path").resolve(__dirname, 'cache', 'qtvonly.json');
const { readFileSync, writeFileSync, existsSync } = require('fs-extra');

function checkAndCreateFile() {
    try {
        if (!existsSync(pathData)) {
            writeFileSync(pathData, JSON.stringify({ qtvbox: {} }, null, 4), 'utf-8');
        } else {
            const data = JSON.parse(readFileSync(pathData, 'utf-8'));
            if (!data || typeof data.qtvbox !== 'object') {
                writeFileSync(pathData, JSON.stringify({ qtvbox: {} }, null, 4), 'utf-8');
            }
        }
    } catch (e) {
        writeFileSync(pathData, JSON.stringify({ qtvbox: {} }, null, 4), 'utf-8');
    }
}

module.exports.onLoad = function() {
    checkAndCreateFile();
};

module.exports.run = async function({ api, event }) {
    const { threadID, messageID } = event;
    try {
        checkAndCreateFile();
        let database = JSON.parse(readFileSync(pathData, 'utf-8'));

        if (database.qtvbox[threadID] === true) {
            database.qtvbox[threadID] = false;
            api.sendMessage("❌ Đã tắt thành công chế độ qtvonly (tất cả mọi người đều có thể sử dụng bot).", threadID, messageID);
        } else {
            database.qtvbox[threadID] = true;
            api.sendMessage("✅ Đã bật thành công chế độ qtvonly (chỉ admin và qtv box mới có thể sử dụng bot).", threadID, messageID);
        }
        
        writeFileSync(pathData, JSON.stringify(database, null, 4), 'utf-8');
    } catch (e) {
        console.error('[QTVONLY] Lỗi khi chạy lệnh:', e);
        api.sendMessage("Đã có lỗi xảy ra, vui lòng kiểm tra console.", threadID, messageID);
    }
};
