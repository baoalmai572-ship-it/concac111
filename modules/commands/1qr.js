const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const Fuse = require('fuse.js');

// Đường dẫn file
const TURNS_FILE_PATH = path.join(__dirname, 'payment', 'bank_user_turns.json');
const LIMIT_FILE_PATH = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');
const QR_SUBDIR = path.join(__dirname, 'qr'); // Thư mục chứa các file canvas
const CACHE_DIR = path.join(QR_SUBDIR, 'cache');

// Danh sách các font chữ cần cho tất cả các layout
const ALL_FONTS = [
    { url: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf", filename: "Prompt-Bold.ttf" },
    { url: "https://github.com/google/fonts/raw/refs/heads/main/ofl/prompt/Prompt-Thin.ttf", filename: "Prompt-Thin.ttf" },
    { url: "https://github.com/Kenne400k/commands/raw/refs/heads/main/Prompt-ExtraBoldItalic.ttf", filename: "Prompt-ExtraBoldItalic.ttf" },
];

// Cấu hình các layout
const LAYOUTS = {
    'rin': {
        backgroundUrl: 'https://files.catbox.moe/f40c3t.png',
        backgroundFile: 'rin_background.png',
        displayName: 'Rin',
        aliases: ['rinne']
    },
    'kelly': {
        backgroundUrl: 'https://files.catbox.moe/63u3qj.png',
        backgroundFile: 'kelly_background.png',
        displayName: 'Kelly',
        aliases: ['kellyne']
    }
};

module.exports.config = {
    name: "qr",
    version: "10.3.2-FINAL",
    hasPermssion: 0,
    credits: "Gemini (Modularized & Limit Update)",
    description: "Tạo mã QR với các layout có thể tùy chỉnh.",
    commandCategory: "game",
    usages: "[layout] [bank] [stk] [tên]",
    cooldowns: 10,
    dependencies: { "fs-extra": "", "axios": "", "fuse.js": "", "canvas": "" }
};

async function downloadAsset(url, fullPath) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(fullPath, res.data);
        return true;
    } catch (e) {
        console.error(`[QR] Lỗi khi tải ${url}:`, e.message);
        return false;
    }
}

module.exports.onLoad = async function() {
    fs.ensureDirSync(CACHE_DIR);
    if (!fs.existsSync(TURNS_FILE_PATH)) fs.writeJsonSync(TURNS_FILE_PATH, {});

    console.log('[QR] Đang kiểm tra và tải font chữ...');
    for (const font of ALL_FONTS) {
        const fontPath = path.join(CACHE_DIR, font.filename);
        if (!fs.existsSync(fontPath)) {
            await downloadAsset(font.url, fontPath);
        }
    }
    console.log('[QR] Module đã sẵn sàng.');
};

function findLayout(layoutInput) { const n = layoutInput?.toLowerCase().trim() || ''; if (LAYOUTS[n]) return n; for (const k in LAYOUTS) if (LAYOUTS[k].aliases?.includes(n)) return k; return null; }
async function getBankInfo(bankInput) { try { const res = await axios.get('https://api.vietqr.io/v2/banks'); const fuse = new Fuse(res.data.data, { keys: ['name', 'shortName'], threshold: 0.3 }); const result = fuse.search(bankInput.trim()); return result[0]?.item || null; } catch (e) { return null; } }
function removeAccents(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(); }

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    
    try { 
        const limitData = fs.readJsonSync(LIMIT_FILE_PATH, { throws: false }) || {}; 
        const threadLimit = limitData[threadID]; 
        if (threadLimit && threadLimit.game === false) { 
            return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID); 
        } 
    } catch (e) { 
        console.log("Lỗi khi đọc file limit.json trong lệnh qr:", e); 
    }

    if (args[0]?.toLowerCase() === 'list') {
        let msg = "🎨 Các layout có sẵn:\n\n";
        for (const key in LAYOUTS) { msg += `- ${key} (${LAYOUTS[key].displayName})\n`; }
        return api.sendMessage(msg, threadID, messageID);
    }

    try { const turnsData = fs.readJsonSync(TURNS_FILE_PATH, { throws: false }) || {}; if ((turnsData[senderID] || 0) <= 0) return api.sendMessage(`🚫 Bạn đã hết lượt.`, threadID, messageID); } catch (e) { return api.sendMessage("❌ Lỗi hệ thống lượt.", threadID, messageID); }

    let isCustomQr = false, customQrUrl = '', commandArgs = [...args];
    if (commandArgs[0]?.toLowerCase() === 'setnotk') {
        if (!event.messageReply || event.messageReply.attachments?.[0]?.type !== 'photo') return api.sendMessage("⚠️ Với 'setnotk', bạn phải reply một ảnh chứa QR.", threadID, messageID);
        isCustomQr = true; customQrUrl = event.messageReply.attachments[0].url; commandArgs.shift();
    }
    
    if (commandArgs.length < 4) return api.sendMessage(`⚠️ Sai cú pháp!\n${this.config.usages}`, threadID, messageID);

    const [layoutName, bankOrWalletName, accountNo, ...accountNameParts] = commandArgs;
    const accountName = accountNameParts.join(' ');
    api.sendMessage("⏳ Đang xử lý, vui lòng chờ...", threadID, messageID);

    let qrImagePath = "", finalImagePath = "", backgroundPath = "";
    try {
        const foundLayoutKey = findLayout(layoutName);
        if (!foundLayoutKey) throw new Error(`Layout "${layoutName}" không tồn tại.`);
        
        const canvasModulePath = path.join(QR_SUBDIR, `canvas_${foundLayoutKey}.js`);
        if (!fs.existsSync(canvasModulePath)) {
            throw new Error(`Không tìm thấy file xử lý canvas cho layout '${foundLayoutKey}'.`);
        }
        const createQrImage = require(canvasModulePath).draw;
        if (typeof createQrImage !== 'function') {
            throw new Error(`File xử lý cho layout '${foundLayoutKey}' không hợp lệ (thiếu hàm 'draw').`);
        }
        
        const selectedLayout = LAYOUTS[foundLayoutKey];
        backgroundPath = path.join(CACHE_DIR, selectedLayout.backgroundFile);
        if (!fs.existsSync(backgroundPath)) {
            if (!(await downloadAsset(selectedLayout.backgroundUrl, backgroundPath))) {
                throw new Error("Không thể tải ảnh nền cho layout.");
            }
        }

        const formattedName = removeAccents(accountName);
        let qrCodeDownloadUrl;
        let bankDisplayName;

        if (isCustomQr) {
            qrCodeDownloadUrl = customQrUrl;
            bankDisplayName = bankOrWalletName.toUpperCase();
        } else {
            const bankInfo = await getBankInfo(bankOrWalletName);
            if (!bankInfo) throw new Error(`Không tìm thấy ngân hàng "${bankOrWalletName}".`);
            qrCodeDownloadUrl = `https://img.vietqr.io/image/${bankInfo.bin}-${accountNo}-qr_only.png?accountName=${encodeURIComponent(formattedName)}`;
            bankDisplayName = bankInfo.name;
        }

        qrImagePath = path.join(CACHE_DIR, `bot_qr_input_${Date.now()}.png`);
        if (!(await downloadAsset(qrCodeDownloadUrl, qrImagePath))) throw new Error("Không thể tải mã QR.");
        
        const renderData = { 
            accountName: formattedName, 
            accountNo, 
            bankName: bankDisplayName,
            qrImagePath, 
            backgroundPath, 
            cachePath: CACHE_DIR,
            isCustomQr: isCustomQr // Gửi tín hiệu cho file canvas
        };
        finalImagePath = await createQrImage(renderData);

        await api.sendMessage({ body: `✅ Tạo mã QR thành công!`, attachment: fs.createReadStream(finalImagePath) }, threadID, async () => {
            if (fs.existsSync(qrImagePath)) fs.unlinkSync(qrImagePath);
            if (fs.existsSync(finalImagePath)) fs.unlinkSync(finalImagePath);
            
            try {
                const turnsData = fs.readJsonSync(TURNS_FILE_PATH, { throws: false }) || {};
                const newTurns = (turnsData[senderID] || 0) - 1;
                turnsData[senderID] = newTurns;
                fs.writeJsonSync(TURNS_FILE_PATH, turnsData, { spaces: 2 });
                
                const userInfo = await api.getUserInfo(senderID);
                const userName = userInfo[senderID]?.name || "User";
                api.changeNickname(`${userName} | ${newTurns} lượt`, threadID, senderID, (err) => {
                    if (err) console.log(`[QR] Lỗi đổi biệt danh cho ${senderID}:`, err.errorDescription);
                });
            } catch (e) { console.error("[QR] Lỗi khi trừ lượt/đổi biệt danh:", e); }
        }, messageID);
    } catch (error) {
        if (fs.existsSync(qrImagePath)) fs.unlinkSync(qrImagePath);
        if (fs.existsSync(finalImagePath)) fs.unlinkSync(finalImagePath);
        console.error("[QR RUN ERROR]", error);
        api.sendMessage(`❌ Lỗi: ${error.message}`, threadID, messageID);
    }
};
