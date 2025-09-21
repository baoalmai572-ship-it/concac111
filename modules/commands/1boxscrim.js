/**
 * @name boxscrim
 * @version 7.0 (Modular Canvas)
 * @description Tạo ảnh scrim. Dùng chung lượt và limit, tách code vẽ ảnh ra các module riêng.
 * @author Gemini
 */

const { registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Gọi 2 module vẽ ảnh mới
const createLuffyImage = require('./boxscrim/canvas_luffy.js');
const createItachiImage = require('./boxscrim/canvas_itachi.js');

// --- CẤU HÌNH TÊN FILE ẢNH NỀN ---
const ITACHI_BG_FILENAME = 'background_itachi.png';
const LUFFY_BG_FILENAME = 'background_luffy.png';

// --- ĐƯỜNG DẪN FILE DỮ LIỆU ---
const turnsPath = path.join(__dirname, 'payment', 'bank_user_turns.json');
const limitPath = path.join(__dirname, 'cache', 'limit.json');

let isAssetsReady = false;

// --- CẤU TRÚC LỆNH ---
module.exports.config = {
    name: "boxscrim",
    version: "7.0",
    hasPermssion: 0,
    credits: "Gemini",
    description: `Tạo ảnh scrim. Dùng chung lượt và limit 'game' với lệnh tinhdiem.`,
    commandCategory: "game",
    usages: "[luffy/itachi] | [Tiêu đề] | [Loại phòng] | [Mức giá] | [Dòng 1] | [Dòng 2] | [Banking]",
    cooldowns: 20
};

// --- HÀM ONLOAD ---
module.exports.onLoad = async function() {
    // Đảm bảo các thư mục cần thiết tồn tại
    const paymentDir = path.join(__dirname, 'payment');
    if (!fs.existsSync(paymentDir)) fs.mkdirSync(paymentDir, { recursive: true });
    
    const globalCacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(globalCacheDir)) fs.mkdirSync(globalCacheDir, { recursive: true });

    // Thư mục cache riêng của lệnh boxscrim
    const commandCacheDir = path.join(__dirname, "boxscrim", "cache");
    if (!fs.existsSync(commandCacheDir)) fs.mkdirSync(commandCacheDir, { recursive: true });

    const fontAsset = { url: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf", path: "Prompt-Bold.ttf", family: "Prompt" };
    const fontPath = path.join(commandCacheDir, fontAsset.path);

    if (!fs.existsSync(fontPath)) {
        try {
            const { data } = await axios.get(fontAsset.url, { responseType: 'arraybuffer' });
            fs.writeFileSync(fontPath, data);
        } catch (e) { console.error(`[BOXSCRIM] Lỗi khi tải font: ${e.message}`); }
    }
    
    try { 
        registerFont(fontPath, { family: fontAsset.family }); 
    } catch (e) { 
        console.error(`[BOXSCRIM] Lỗi đăng ký font: ${e.message}`); 
    }
    
    isAssetsReady = true;
};

// --- HÀM RUN ---
module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID } = event;

    try {
        if (fs.existsSync(limitPath)) {
            const limitData = JSON.parse(fs.readFileSync(limitPath, 'utf8'));
            if (limitData[threadID] && limitData[threadID].game === false) {
                return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID);
            }
        }
    } catch (e) {}

    if (!isAssetsReady) return api.sendMessage("⏳ Tài nguyên đang được tải, vui lòng thử lại sau giây lát...", threadID, messageID);

    const input = args.join(" ");
    const usageMessage = `⚠️ Vui lòng nhập đúng định dạng:\n${this.config.usages}\n\nVí dụ:\n${this.config.name} luffy | BOX CUS LTN | PHÒNG THƯỜNG | 5K - 10K - 15K | 13:00 - 15:00 6K | 20:00 - 22:00 8K | MBBANK 5127032006`;

    if (!input) return api.sendMessage(usageMessage, threadID, messageID);

    const parts = input.split("|").map(p => p.trim());
    const theme = parts[0]?.toLowerCase();

    if (theme !== 'luffy' && theme !== 'itachi') return api.sendMessage(`❌ Theme không hợp lệ.`, threadID, messageID);
    if (parts.length !== 7) return api.sendMessage(`❌ Nhập thiếu thông tin. Cần 7 mục, phân tách bởi '|'.`, threadID, messageID);

    const [_, title, roomType, subtitle, line1, line2, bankingInfo] = parts;

    try {
        if (!fs.existsSync(turnsPath)) fs.writeFileSync(turnsPath, JSON.stringify({}));
        const turnsData = JSON.parse(fs.readFileSync(turnsPath, 'utf-8'));
        const userTurns = turnsData[senderID] || 0;

        if (userTurns <= 0) return api.sendMessage(`🚫 Bạn đã hết lượt sử dụng.`, threadID, messageID);

        api.sendMessage(`⏳ Đang xử lý ảnh '${theme}', vui lòng chờ...`, threadID, null, messageID);

        const imageData = { title, roomType, subtitle, line1, line2, bankingInfo };
        let imageBuffer;

        const imageDir = path.join(__dirname, 'boxscrim', 'cache');

        if (theme === 'luffy') {
            imageData.imagePath = path.join(imageDir, LUFFY_BG_FILENAME);
            imageBuffer = await createLuffyImage(imageData);
        } else {
            imageData.imagePath = path.join(imageDir, ITACHI_BG_FILENAME);
            imageBuffer = await createItachiImage(imageData);
        }
        
        const tempImagePath = path.join(__dirname, 'boxscrim', 'cache', `scrim_temp_${Date.now()}.png`);
        fs.writeFileSync(tempImagePath, imageBuffer);
        
        api.sendMessage({
            body: `🎉 Ảnh scrim của bạn với theme '${theme}' đã được tạo!`,
            attachment: fs.createReadStream(tempImagePath)
        }, threadID, async (err) => {
            fs.unlinkSync(tempImagePath);
            if (err) return console.error("[BOXSCRIM] Lỗi khi gửi ảnh:", err);
            
            try {
                const currentTurnsData = JSON.parse(fs.readFileSync(turnsPath, 'utf-8'));
                const currentUserTurns = currentTurnsData[senderID] || 0;
                
                if (currentUserTurns > 0) {
                    const newTurns = currentUserTurns - 1;
                    currentTurnsData[senderID] = newTurns;
                    fs.writeFileSync(turnsPath, JSON.stringify(currentTurnsData, null, 4), 'utf-8');
                    const userInfo = await api.getUserInfo(senderID);
                    const senderName = userInfo[senderID]?.name || `User_${senderID}`;
                    const newNickname = `${senderName} | ${newTurns} lượt`;
                    api.changeNickname(newNickname, threadID, senderID);
                }
            } catch (e) {
                console.error("[BOXSCRIM] Lỗi khi trừ lượt:", e);
            }
        }, messageID);

    } catch (err) {
        console.error("[BOXSCRIM] Lỗi trong hàm run:", err);
        return api.sendMessage(`❌ Đã xảy ra lỗi khi tạo ảnh: ${err.message}.`, threadID, messageID);
    }
};
