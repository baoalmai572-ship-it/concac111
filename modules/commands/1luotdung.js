const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios'); // Thêm axios để gọi API bên thứ ba

// --- CÁC HÀM TIỆN ÍCH ĐỂ ĐỌC/GHI FILE ---
function readJsonFile(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        const rawData = fs.readFileSync(filePath);
        return rawData.length > 0 ? JSON.parse(rawData) : defaultValue;
    } catch (error) {
        console.error(`Lỗi khi đọc file ${filePath}:`, error);
        return defaultValue;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Lỗi khi ghi file ${filePath}:`, error);
    }
}
// -----------------------------------------

module.exports.config = {
    name: "luotdung",
    version: "1.5.0",
    hasPermssion: 0,
    credits: "Gemini (Hybrid API)",
    description: "Kiểm tra và quản lý lượt dùng (check, thanhtoan, vohan, vohanbox).",
    commandCategory: "quản trị viên",
    cooldowns: 5,
    usages: "luotdung check [tag/reply/uid]\nluotdung thanhtoan [uid] [số tiền]\nluotdung vohan [uid/tag/reply] [số ngày]\nluotdung vohanbox [số ngày]"
};

// --- HÀM LẤY TÊN NGƯỜI DÙNG PHIÊN BẢN HYBRID ---
async function getUserName(api, Users, uid) {
    try {
        const nameFromCache = (await Users.getData(uid))?.name;
        if (nameFromCache) return nameFromCache;
    } catch (error) {}

    try {
        const infoFromApi = await api.getUserInfo(uid);
        if (infoFromApi && infoFromApi[uid] && infoFromApi[uid].name) {
            return infoFromApi[uid].name;
        }
    } catch (error) {}

    try {
        const profileUrl = `https://www.facebook.com/profile.php?id=${uid}`;
        const res = await axios.get(`https://ffb.vn/api/tool/get-id-fb?idfb=${encodeURIComponent(profileUrl)}`);
        if (res.data.error === 0 && res.data.name) {
            return res.data.name;
        }
    } catch (e) {
        console.error(`Lỗi khi lấy tên từ ffb.vn cho UID ${uid}:`, e.message);
    }
    
    return `Không tìm thấy tên (UID: ${uid})`;
}

// --- HÀM XỬ LÝ PHẢN HỒI ---
module.exports.handleReply = async function({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;
    const { author, days } = handleReply;

    if (senderID !== author) {
        return api.sendMessage("⚠️ Chỉ người dùng đã ra lệnh mới có thể trả lời.", threadID, messageID);
    }

    const choice = parseInt(body);
    if (isNaN(choice) || (choice !== 1 && choice !== 2)) {
        return api.sendMessage("❌ Lựa chọn không hợp lệ. Vui lòng phản hồi bằng 1 hoặc 2.", threadID, messageID);
    }

    const VOHAN_BOX_FILE = path.join(__dirname, 'payment', 'vohan_box.json');
    const vohanBoxData = readJsonFile(VOHAN_BOX_FILE, {});
    const scope = (choice === 1) ? 'admin' : 'all';
    const expiryDate = moment().tz("Asia/Ho_Chi_Minh").add(days, 'days').toISOString();

    vohanBoxData[threadID] = {
        expiry: expiryDate,
        scope: scope
    };

    writeJsonFile(VOHAN_BOX_FILE, vohanBoxData);
    const scopeText = (scope === 'admin') ? "chỉ Quản trị viên box" : "tất cả thành viên";

    api.unsendMessage(handleReply.messageID);
    return api.sendMessage(
        `[ KÍCH HOẠT BOX MIỄN PHÍ ]\n\n` +
        `✅ Đã kích hoạt thành công chế độ miễn phí cho box này.\n` +
        `- Thời hạn: ${days} ngày\n` +
        `- Phạm vi áp dụng: ${scopeText}\n` +
        `📅 Sẽ hết hạn vào: ${moment(expiryDate).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY")}`,
        threadID, messageID
    );
};

// --- HÀM CHẠY LỆNH CHÍNH ---
module.exports.run = async function({ api, event, args, Users }) {
    const { threadID, messageID, senderID, mentions, type, messageReply } = event;
    const { ADMINBOT } = global.config;

    const USER_TURNS_FILE = path.join(__dirname, 'payment', 'bank_user_turns.json');
    const VOHAN_FILE = path.join(__dirname, 'payment', 'tinhdiem_vohan.json');
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
        case 'check': {
            let targetID;
            if (Object.keys(mentions).length > 0) {
                targetID = Object.keys(mentions)[0];
            } else if (type === "message_reply" && messageReply.senderID) {
                targetID = messageReply.senderID;
            } else if (args[1] && !isNaN(args[1])) {
                targetID = args[1];
            } else {
                targetID = senderID;
            }

            const targetName = await getUserName(api, Users, targetID);
            const userTurnsData = readJsonFile(USER_TURNS_FILE, {});
            const turns = userTurnsData[targetID] || 0;
            
            let messageBody;
            if (targetID === senderID) {
                messageBody = `[ LƯỢT DÙNG CỦA BẠN ]\n\n👤 Tên: ${targetName}\n🔄 Số lượt còn lại: ${turns} lượt.`;
            } else {
                messageBody = `[ KIỂM TRA LƯỢT ]\n\n👤 Người dùng: ${targetName}\n🔄 Số lượt của họ: ${turns} lượt.`;
            }
            return api.sendMessage(messageBody, threadID, messageID);
        }

        case 'thanhtoan': {
            if (!ADMINBOT.includes(senderID)) {
                return api.sendMessage("⚠️ Chức năng này chỉ dành cho Quản trị viên bot.", threadID, messageID);
            }
            const targetUID = args[1];
            const amount = parseInt(args[2]);

            if (!targetUID || isNaN(amount) || !/^\d+$/.test(targetUID)) {
                return api.sendMessage("❌ Sai cú pháp! Vui lòng sử dụng: luotdung thanhtoan [UID] [số tiền]", threadID, messageID);
            }
            if (amount < 1000) {
                return api.sendMessage("❌ Số tiền phải lớn hơn hoặc bằng 1000.", threadID, messageID);
            }

            try {
                const targetName = await getUserName(api, Users, targetUID);
                if (targetName.startsWith("Không tìm thấy tên")) {
                    return api.sendMessage(`⚠️ Không thể tìm thấy người dùng có UID: ${targetUID}.`, threadID, messageID);
                }

                const turnsToAdd = Math.floor(amount / 1000);
                const userTurnsData = readJsonFile(USER_TURNS_FILE, {});
                const newTotalTurns = (userTurnsData[targetUID] || 0) + turnsToAdd;
                userTurnsData[targetUID] = newTotalTurns;
                writeJsonFile(USER_TURNS_FILE, userTurnsData);
                
                return api.sendMessage(
                    `[ ADMIN THANH TOÁN ]\n\n` +
                    `✅ Đã cộng thành công ${turnsToAdd} lượt cho người dùng:\n` +
                    `- Tên: ${targetName}\n` +
                    `- UID: ${targetUID}\n` +
                    `🔄 Tổng lượt hiện tại: ${newTotalTurns} lượt.`, 
                    threadID, messageID
                );
            } catch (error) {
                console.error("Lỗi ở lệnh luotdung thanhtoan:", error);
                return api.sendMessage("Có lỗi xảy ra, vui lòng kiểm tra lại UID và thử lại.", threadID, messageID);
            }
        }

        case 'vohan': {
            if (!ADMINBOT.includes(senderID)) {
                return api.sendMessage("⚠️ Chức năng này chỉ dành cho Quản trị viên bot.", threadID, messageID);
            }

            let targetID;
            if (Object.keys(mentions).length > 0) {
                targetID = Object.keys(mentions)[0];
            } else if (type === "message_reply" && messageReply.senderID) {
                targetID = messageReply.senderID;
            } else if (args[1] && !isNaN(args[1])) {
                targetID = args[1];
            }

            const days = parseInt(args[args.length - 1]);
            if (!targetID || isNaN(days) || days <= 0) {
                return api.sendMessage("❌ Sai cú pháp! Vui lòng dùng: luotdung vohan [uid/tag/reply] [số ngày]", threadID, messageID);
            }

            try {
                const targetName = await getUserName(api, Users, targetID);
                if (targetName.startsWith("Không tìm thấy tên")) {
                    return api.sendMessage(`⚠️ Không tìm thấy người dùng với UID: ${targetID}.`, threadID, messageID);
                }

                const vohanData = readJsonFile(VOHAN_FILE, {});
                const expiryDate = moment().tz("Asia/Ho_Chi_Minh").add(days, 'days').toISOString();
                vohanData[targetID] = expiryDate;
                writeJsonFile(VOHAN_FILE, vohanData);
                
                return api.sendMessage(
                    `[ CẤP QUYỀN VÔ HẠN ]\n\n` +
                    `✅ Đã cấp quyền sử dụng lệnh miễn phí cho:\n` +
                    `- Tên: ${targetName}\n` +
                    `- UID: ${targetID}\n` +
                    `- Thời hạn: ${days} ngày\n` +
                    `📅 Hết hạn vào: ${moment(expiryDate).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY")}`,
                    threadID, messageID
                );
            } catch (error) {
                console.error("Lỗi ở lệnh luotdung vohan:", error);
                return api.sendMessage("Có lỗi xảy ra, vui lòng kiểm tra lại thông tin và thử lại.", threadID, messageID);
            }
        }
        
        // --- CHỨC NĂNG MỚI ĐƯỢC THÊM VÀO ---
        case 'vohanbox': {
            if (!ADMINBOT.includes(senderID)) {
                return api.sendMessage("⚠️ Chức năng này chỉ dành cho Quản trị viên bot.", threadID, messageID);
            }

            const days = parseInt(args[1]);
            if (isNaN(days) || days <= 0) {
                return api.sendMessage("❌ Sai cú pháp! Vui lòng dùng: luotdung vohanbox [số ngày]\nVí dụ: .luotdung vohanbox 30", threadID, messageID);
            }

            return api.sendMessage(
                `[ CẤU HÌNH BOX MIỄN PHÍ ]\n\n` +
                `Vui lòng chọn phạm vi áp dụng cho ${days} ngày sử dụng bot miễn phí:\n\n` +
                `1. Chỉ dành cho Quản trị viên của box này.\n` +
                `2. Dành cho tất cả thành viên trong box.\n\n` +
                `» Vui lòng phản hồi tin nhắn này với số bạn chọn.`,
                threadID,
                (error, info) => {
                    if (error) return console.error(error);
                    global.client.handleReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        days: days
                    });
                },
                messageID
            );
        }

        default: {
            return api.sendMessage(
                "✨ === LỆNH LƯỢT DÙNG === ✨\n\n" +
                "1. `luotdung check [tag/reply/uid]`\n» Kiểm tra số lượt của bản thân hoặc người khác.\n\n" +
                "2. `luotdung thanhtoan [uid] [số tiền]`\n» (Admin) Cộng lượt thủ công cho người dùng.\n\n" +
                "3. `luotdung vohan [uid/tag/reply] [số ngày]`\n» (Admin) Cấp quyền dùng lệnh miễn phí cho một người dùng.\n\n" +
                "4. `luotdung vohanbox [số ngày]`\n» (Admin) Cấp quyền dùng lệnh miễn phí cho cả nhóm chat này.",
                threadID, messageID
            );
        }
    }
};
