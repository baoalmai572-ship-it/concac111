// ##### MODULE CORE #####
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const crypto = require('crypto');
const cron = require('node-cron');

// ##### CẤU HÌNH THUÊ BOT #####
const TIMEZONE = 'Asia/Ho_Chi_Minh';

// ##### PATHS & DIRECTORIES #####
const DATA_DIR = path.join(__dirname, 'cache', 'data_rentbot_pro');
const RENT_DATA_PATH = path.join(DATA_DIR, 'thuebot_pro.json');
const RENT_KEY_PATH = path.join(DATA_DIR, 'keys_pro.json');

// Đảm bảo thư mục data tồn tại
fs.ensureDirSync(DATA_DIR);

module.exports.config = {
    name: 'rent',
    version: '13.3.0-fix-add',
    hasPermssion: 0,
    credits: 'Pcoder & Gemini',
    description: "Hệ thống thuê bot chỉ sử dụng văn bản.",
    commandCategory: "System",
    usages: '[info | usekey | list | add | del | newkey | check | delkey]',
    cooldowns: 5,
};

// --- HÀM TIỆN ÍCH ---
function safeReadJSON(file, defaultValue) { try { if (!fs.existsSync(file)) return defaultValue; return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultValue; } }
function safeWriteJSON(file, data) { try { fs.ensureDirSync(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8'); } catch (e) { console.error(`[RENT] Lỗi ghi file JSON: ${file}`, e); } }
function hsdText(endDateStr, fullFormat = false) { const now = moment().tz(TIMEZONE); const endDate = moment(endDateStr, 'DD/MM/YYYY').endOf('day'); const daysDiff = endDate.diff(now, 'days'); const formattedEndDate = endDate.format('DD/MM/YYYY'); if (daysDiff >= 0) return `còn ${daysDiff + 1} ngày${fullFormat ? ` (đến ${formattedEndDate})` : ''}`; return `đã hết hạn ${Math.abs(daysDiff)} ngày${fullFormat ? ` (từ ${formattedEndDate})` : ''}`; }

async function changeBotNicknameInGroup(api, threadID, time_end) {
    try {
        const botID = api.getCurrentUserID();
        const now = moment().tz(TIMEZONE);
        const endDate = moment(time_end, 'DD/MM/YYYY').endOf('day');
        const daysDiff = endDate.diff(now, 'days');
        let nickname = (daysDiff >= 0) ? `[ ${daysDiff} days ] SCORING BOT` : `[ Hết hạn ] Bot thuê`;
        await api.changeNickname(nickname, threadID, botID);
    } catch (e) {
        // Bỏ qua lỗi
    }
}

module.exports.onLoad = async function ({ api }) {
    cron.schedule('5 0 * * *', async () => {
        const rentData = safeReadJSON(RENT_DATA_PATH, []);
        console.log('[RENT] Bắt đầu quét và cập nhật trạng thái thuê bot...');
        for (const group of rentData) {
            await changeBotNicknameInGroup(api, group.t_id, group.time_end);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log('[RENT] Quét xong.');
    }, { timezone: TIMEZONE });
};

module.exports.run = async function({ api, event, args, Users, Threads }) {
    const { threadID, senderID, messageID } = event;
    
    let rentData = safeReadJSON(RENT_DATA_PATH, []);
    let keyData = safeReadJSON(RENT_KEY_PATH, {});
    const saveData = () => safeWriteJSON(RENT_DATA_PATH, rentData);
    const saveKeys = () => safeWriteJSON(RENT_KEY_PATH, keyData);

    const command = args[0] ? args[0].toLowerCase() : '';
    const prefix = global.config.PREFIX || "!";
    
    const isAdmin = [...(global.config.ADMINBOT || []), ...(global.config.NDH || [])].includes(senderID);
    const send = (msg, callback) => api.sendMessage(msg, threadID, callback, messageID);

    switch (command) {
        case 'info': {
            const rentInfo = rentData.find(e => e.t_id === threadID);
            if (!rentInfo) return send(`❌ Nhóm này chưa thuê bot.`);
            
            const groupInfo = await Threads.getInfo(threadID);
            const groupName = groupInfo.threadName || groupInfo.name || "Nhóm này";
            const userName = await Users.getNameUser(rentInfo.id);
            const index = rentData.findIndex(e => e.t_id === threadID) + 1;
            
            const msg = `🌟 THÔNG TIN THUÊ BOT 🌟\n` +
                        `------------------------------------\n` +
                        `👤 Người thuê: ${userName}\n` +
                        `🏠 Nhóm: ${groupName}\n` +
                        `▶️ Ngày thuê: ${rentInfo.time_start}\n` +
                        `◀️ Ngày hết hạn: ${rentInfo.time_end}\n` +
                        `⏳ Tình trạng: ${hsdText(rentInfo.time_end, true)}\n` +
                        `🔑 Key: ${rentInfo.key || "Admin thêm trực tiếp"}\n` +
                        `🔢 STT: ${index}`;
            return send(msg);
        }
        case 'usekey': {
            const keyToUse = args[1]?.toLowerCase();
            if (!keyToUse || !keyData[keyToUse]) return send('❌ Mã key không hợp lệ!');
            if (keyData[keyToUse].used) return send(`❌ Mã key này đã được sử dụng.`);
            if (rentData.some(e => e.t_id === threadID)) return send(`❌ Nhóm này đã thuê bot. Dùng lệnh "rent add" để gia hạn.`);
            
            const keyInfo = keyData[keyToUse];
            const time_start = moment.tz(TIMEZONE).format('DD/MM/YYYY');
            const time_end = moment.tz(TIMEZONE).add(keyInfo.days, 'days').format('DD/MM/YYYY');
            
            rentData.push({ t_id: threadID, id: senderID, time_start, time_end, key: keyToUse });
            keyData[keyToUse].used = true;
            keyData[keyToUse].groupId = threadID;
            
            saveData();
            saveKeys();
            
            await changeBotNicknameInGroup(api, threadID, time_end);
            return send(`✅ Bot đã được kích hoạt thành công!\nHạn sử dụng: ${keyInfo.days} ngày (đến ${time_end}).`);
        }

        case 'add': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            if (args.length < 2) return send(`Sử dụng: ${prefix}rent add <số_ngày> [ID_nhóm_tùy_chọn]\n\nLệnh này dùng để THÊM MỚI hoặc GIA HẠN cho một nhóm.`);
            
            const soNgayThue = parseInt(args[1], 10);
            const targetTID = args[2] || threadID;

            if (isNaN(soNgayThue) || soNgayThue <= 0) return send(`❌ Số ngày không hợp lệ. Vui lòng nhập một số dương.`);

            const groupIndex = rentData.findIndex(e => e.t_id === targetTID);
            let message = '';

            if (groupIndex !== -1) { // GIA HẠN
                const existingGroup = rentData[groupIndex];
                const oldEndDate = moment(existingGroup.time_end, 'DD/MM/YYYY').tz(TIMEZONE);
                const newEndDate = oldEndDate.add(soNgayThue, 'days').format('DD/MM/YYYY');
                existingGroup.time_end = newEndDate;
                
                rentData[groupIndex] = existingGroup;
                
                await changeBotNicknameInGroup(api, targetTID, newEndDate);
                const groupInfo = await Threads.getInfo(targetTID);
                const groupName = groupInfo.threadName || groupInfo.name || `ID: ${targetTID}`;
                
                message = `✅ GIA HẠN thành công!\n` +
                          `------------------------------------\n` +
                          `🏠 Nhóm: ${groupName}\n` +
                          `🗓️ Số ngày gia hạn: ${soNgayThue} ngày\n` +
                          `◀️ Ngày hết hạn mới: ${newEndDate}`;
            } 
            else { // THÊM MỚI
                const time_start = moment.tz(TIMEZONE).format('DD/MM/YYYY');
                const endDateStr = moment.tz(TIMEZONE).add(soNgayThue, 'days').format('DD/MM/YYYY');
                
                rentData.push({ t_id: targetTID, id: senderID, time_start, time_end: endDateStr, key: "" });
                
                await changeBotNicknameInGroup(api, targetTID, endDateStr);
                const groupInfo = await Threads.getInfo(targetTID);
                const groupName = groupInfo.threadName || groupInfo.name || `ID: ${targetTID}`;
                
                message = `✅ THÊM MỚI nhóm thuê thành công!\n` +
                          `------------------------------------\n` +
                          `🏠 Nhóm: ${groupName}\n` +
                          `🗓️ Thời hạn: ${soNgayThue} ngày\n` +
                          `◀️ Ngày hết hạn: ${endDateStr}`;
            }
            
            saveData();
            return send(message);
        }

        case 'del': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            const identifier = args[1];
            if (!identifier) return send(`Sai cú pháp: ${prefix}rent del <STT|GroupID>`);
            
            let itemIndex = !isNaN(parseInt(identifier)) ? parseInt(identifier) - 1 : rentData.findIndex(e => e.t_id === identifier);
            if (itemIndex < 0 || itemIndex >= rentData.length) return send("❌ Không tìm thấy nhóm.");
            
            const removedItem = rentData.splice(itemIndex, 1);
            saveData();
            
            return send(`🗑️ Đã xóa thành công nhóm có ID: ${removedItem[0].t_id}.`);
        }
        
        case 'list': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            if (rentData.length === 0) return send('Chưa có nhóm nào đang thuê bot!');

            await send("Đang xử lý và lấy tên các nhóm, vui lòng đợi...");

            const promises = rentData.map((item, index) => {
                return Threads.getInfo(item.t_id)
                    .then(groupInfo => {
                        const groupName = groupInfo.threadName || groupInfo.name || `ID: ${item.t_id}`;
                        return `${index + 1}. ${groupName}\n   - ID: ${item.t_id}\n   - HSD: ${item.time_end} (${hsdText(item.time_end)})`;
                    })
                    .catch(() => {
                        return `${index + 1}. ID: ${item.t_id} (⚠️ Lỗi/Bot đã rời)\n   - HSD: ${item.time_end} (${hsdText(item.time_end)})`;
                    });
            });

            const results = await Promise.all(promises);
            let msg = `📝 DANH SÁCH ${rentData.length} NHÓM ĐANG THUÊ 📝\nReply tin nhắn này với "del <STT>"\n\n`;
            msg += results.join('\n\n');
            
            return send(msg, (err, info) => { 
                if (!err) global.client.handleReply.push({ name: this.config.name, messageID: info.messageID, author: senderID, rentalData: rentData }); 
            });
        }

        case 'newkey': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            const days = parseInt(args[1], 10);
            if (isNaN(days) || days <= 0) return send(`❌ Số ngày không hợp lệ.`);
            
            const generatedKey = `key_${crypto.randomBytes(4).toString('hex')}`;
            keyData[generatedKey] = { days: days, used: false, groupId: null };
            saveKeys();
            
            return send(`🔑 Đã tạo key mới: ${generatedKey}\nThời hạn: ${days} ngày`);
        }
        case 'check': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            if (Object.keys(keyData).length === 0) return send('Không có key nào trong hệ thống!');
            
            let msg = `🔑 DANH SÁCH KEY 🔑\n\n`;
            for (const [key, info] of Object.entries(keyData)) {
                msg += `> Key: ${key}\n - Hạn: ${info.days} ngày\n - Status: ${info.used ? `✅ Đã dùng (Nhóm: ${info.groupId || 'N/A'})` : '⏳ Chưa dùng'}\n\n`;
            }
            return send(msg.trim());
        }
        case 'delkey': {
            if (!isAdmin) return send("❌ Bạn không có quyền.");
            const keyToDelete = args[1]?.toLowerCase();
            if (!keyToDelete || !keyData[keyToDelete]) return send(`❌ Key không tồn tại!`);
            
            delete keyData[keyToDelete];
            saveKeys();
            
            return send(`🗑️ Đã xóa key "${keyToDelete}".`);
        }
        default: {
            const commands = [
                { cmd: "info", desc: "Xem thông tin thuê của nhóm hiện tại." },
                { cmd: "usekey <Mã_Key>", desc: "Kích hoạt thuê bot bằng key." },
                { cmd: "list", desc: "Xem danh sách các nhóm thuê (admin)." },
                { cmd: "add <số_ngày> [id_nhóm]", desc: "Thêm mới hoặc gia hạn nhóm thuê (admin)." },
                { cmd: "del <STT|GroupID>", desc: "Xóa nhóm khỏi danh sách thuê (admin)." },
                { cmd: "newkey <số_ngày>", desc: "Tạo key mới (admin)." },
                { cmd: "check", desc: "Kiểm tra tất cả các key (admin)." },
                { cmd: "delkey <Tên_Key>", desc: "Xóa một key (admin)." }
            ];
            let msg = "🌟 MENU QUẢN LÝ THUÊ BOT 🌟\n\n";
            commands.forEach(c => {
                msg += `» ${prefix}${this.config.name} ${c.cmd}\n   - ${c.desc}\n\n`;
            });
            return send(msg.trim());
        }
    }
};

module.exports.handleReply = async function({ api, event, handleReply }) {
    const { senderID, threadID, body } = event;
    const isAdmin = [...(global.config.ADMINBOT || []), ...(global.config.NDH || [])].includes(senderID);

    if (senderID !== handleReply.author || !isAdmin) return;
    
    let rentData = safeReadJSON(RENT_DATA_PATH, []);
    const saveData = () => safeWriteJSON(RENT_DATA_PATH, rentData);
    
    const { rentalData } = handleReply;
    const [command, stt] = body.split(" ");
    
    if (command.toLowerCase() !== 'del' || !stt || isNaN(parseInt(stt))) return;
    
    const index = parseInt(stt) - 1;
    if (index < 0 || index >= rentalData.length) return api.sendMessage("❌ STT không hợp lệ.", threadID);
    
    const targetGroupTID = rentalData[index].t_id;
    const globalIndex = rentData.findIndex(e => e.t_id === targetGroupTID);
    
    if (globalIndex === -1) return api.sendMessage("❌ Nhóm này có thể đã bị xóa.", threadID);
    
    rentData.splice(globalIndex, 1); 
    saveData();
    return api.sendMessage(`🗑️ Đã xóa thành công nhóm STT ${stt} (ID: ${targetGroupTID}).`, threadID);
};
