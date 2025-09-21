const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const Fuse = require('fuse.js');

const ADMIN_BANK = {
    accountNo: "5127032006",
    accountName: "Lê Thành Nghĩa",
    acqId: 970422, // Đây là BIN của MBBANK
    bankName: "MBBANK",
    isManual: false
};

module.exports.config = {
    name: "stk",
    version: "5.6.0", // Nâng version
    hasPermssion: 0,
    credits: "Pcoder & Khang (Gemini Final Fix)",
    description: "Hiển thị thông tin STK. QTV dùng lệnh .stk set/reset. Tự động phản hồi khi có từ khóa.",
    commandCategory: "Tiện ích",
    usages: "[set/setnotk/reset] | [số tiền] [nội dung]",
    cooldowns: 3,
    dependencies: { "axios": "", "fs-extra": "", "fuse.js": "" }
};

const configPath = path.join(__dirname, 'cache', 'stk_config.json');

function readStkConfig() { try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (e) { return {}; } }
function writeStkConfig(data) { fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8'); }
async function getBankInfo(bankInput) { try { const res = await axios.get('https://api.vietqr.io/v2/banks'); const fuse = new Fuse(res.data.data, { keys: ['name', 'shortName'], threshold: 0.3 }); return fuse.search(bankInput.trim())[0]?.item || null; } catch (e) { return null; } }

async function displayStkInfo(api, event, bankInfo, args = []) {
    const { threadID, messageID } = event;

    if (bankInfo.isManual) {
        try {
            const imageStream = await axios.get(bankInfo.imageUrl, { responseType: 'stream' }).then(r => r.data);
            return api.sendMessage({
                body: `💳 ${bankInfo.description}\n\nQuét mã QR trong ảnh để thanh toán.`,
                attachment: imageStream
            }, threadID, messageID);
        } catch (error) {
            console.error("Lỗi tải ảnh QR thủ công:", error);
            return api.sendMessage("❌ Không thể tải ảnh QR đã lưu. Vui lòng kiểm tra lại link ảnh.", threadID, messageID);
        }
    }

    const amount = !isNaN(args[0]) ? args[0] : "0";
    const addInfo = !isNaN(args[0]) ? args.slice(1).join(' ') : args.join(' ');
    
    const qrUrl = `https://api.vietqr.io/image/${bankInfo.acqId}-${bankInfo.accountNo}-REPqd9A.jpg?accountName=${encodeURIComponent(bankInfo.accountName)}&amount=${amount}`;

    try {
        const responseStream = await axios.get(qrUrl, { responseType: 'stream' }).then(r => r.data);
        const messageBody =
            `🏦 Ngân hàng: ${bankInfo.bankName}` +
            `\n🔢 STK: ${bankInfo.accountNo}` +
            `\n👤 Chủ TK: ${bankInfo.accountName}` +
            (amount !== "0" ? `\n💰 Số tiền: ${Number(amount).toLocaleString('vi-VN')} VND` : '') +
            (addInfo ? `\n📝 Nội dung: ${addInfo}` : '');
        api.sendMessage({ body: messageBody, attachment: responseStream }, threadID, messageID);
    } catch (error) {
        console.error("Lỗi tạo mã QR:", error);
        api.sendMessage("❌ Lỗi khi tạo mã QR. Vui lòng kiểm tra lại thông tin STK và ngân hàng.", threadID, messageID);
    }
}

module.exports.run = async ({ api, event, args, Threads }) => {
    const { threadID, messageID, senderID } = event;
    const command = args[0]?.toLowerCase();
    
    if (!fs.existsSync(configPath)) writeStkConfig({});
    const stkConfig = readStkConfig();

    if (["set", "setnotk", "reset"].includes(command)) {
        const threadInfo = await Threads.getInfo(threadID);
        const adminIDs = (threadInfo.adminIDs.map(item => item.id) || []).concat(global.config.ADMINBOT);
        if (!adminIDs.includes(senderID)) {
            return api.sendMessage("⚠️ Chỉ quản trị viên của nhóm mới có quyền dùng lệnh này.", threadID, messageID);
        }

        switch (command) {
            case 'set': {
                const [_, bankInput, accountNo, ...accountNameArr] = args;
                const accountName = accountNameArr.join(' ').toUpperCase();
                if (!bankInput || !accountNo || !accountName) return api.sendMessage("⚠️ Sai cú pháp!\nVí dụ: .stk set mbbank 12345 NGUYEN VAN A", threadID, messageID);
                
                const bank = await getBankInfo(bankInput);
                if (!bank) return api.sendMessage(`❌ Không tìm thấy ngân hàng "${bankInput}".`, threadID, messageID);
                
                stkConfig[threadID] = { accountNo, accountName, acqId: bank.bin, bankName: bank.shortName, isManual: false };
                writeStkConfig(stkConfig);
                return api.sendMessage(`✅ Đã cài đặt STK cho nhóm thành công!`, threadID, messageID);
            }
            case 'setnotk': {
                if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0 || event.messageReply.attachments[0].type !== 'photo') {
                    return api.sendMessage("⚠️ Bạn phải reply một ảnh chứa mã QR.", threadID, messageID);
                }
                const imageUrl = event.messageReply.attachments[0].url;
                const description = args.slice(1).join(' ') || "Thông tin thanh toán của nhóm.";
                
                stkConfig[threadID] = { isManual: true, imageUrl, description };
                writeStkConfig(stkConfig);
                return api.sendMessage(`✅ Đã cài đặt QR tùy chỉnh thành công!`, threadID, messageID);
            }
            case 'reset': {
                if (stkConfig[threadID]) {
                    delete stkConfig[threadID];
                    writeStkConfig(stkConfig);
                    return api.sendMessage("✅ Đã xóa cài đặt STK của nhóm.", threadID, messageID);
                }
                return api.sendMessage("ℹ️ Nhóm này chưa cài đặt STK.", threadID, messageID);
            }
        }
        return;
    }

    const bankInfoToShow = stkConfig[threadID] || ADMIN_BANK;
    return displayStkInfo(api, event, bankInfoToShow, args);
};

module.exports.handleEvent = async function({ api, event }) {
    if (event.type !== "message" || !event.body) return;

    const keywords = ['stk', 'số tài khoản', 'qr', 'mã qr', 'mã'];
    const body = event.body; // Không cần toLowerCase() ở đây vì regex đã có cờ 'i'

    // ✨ ĐÂY LÀ DÒNG CODE ĐÃ ĐƯỢC THAY ĐỔI ĐỂ SỬA LỖI ✨
    // Kiểm tra xem keyword có đứng riêng biệt không (phân tách bởi khoảng trắng hoặc đầu/cuối chuỗi)
    const keywordRegex = new RegExp(`(?:^|\\s)(${keywords.join('|')})(?:$|\\s)`, 'i');

    if (keywordRegex.test(body)) {
        const stkConfig = readStkConfig();
        const groupConfig = stkConfig[event.threadID];

        // Chỉ phản hồi nếu nhóm đó đã set stk
        if (groupConfig) {
            // Tự động phản hồi không cần lấy args
            return displayStkInfo(api, event, groupConfig);
        }
    }
};
