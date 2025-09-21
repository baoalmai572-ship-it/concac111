const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios');
const Fuse = require('fuse.js');
const fse = require('fs-extra');

const DATA_FILE = path.join(__dirname, '..', '..', 'pdata', 'custom_tournaments.json');
const limitPath = path.join(__dirname, 'cache', 'limit.json');
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function readData() {
    const dbPath = path.dirname(DATA_FILE);
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
        return {};
    }
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } 
    catch (e) { return {}; }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

async function getBankInfo(bankInput) {
    try {
        const res = await axios.get('https://api.vietqr.io/v2/banks');
        const fuse = new Fuse(res.data.data, { keys: ['name', 'shortName'], threshold: 0.3 });
        return fuse.search(bankInput.trim())[0]?.item || null;
    } catch (e) { return null; }
}

function formatAnnouncement(threadData) {
    if (!threadData || !threadData.name) return null;
    const numberIcons = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿", "⓫", "⓬"];
    let msg = `✨ CUSTOM ${threadData.name.toUpperCase()} ✨\n`;
    msg += `    Ngày: ${moment().tz(TIME_ZONE).format('DD/MM')}\n`;
    msg += `──────────────────\n`;
    msg += `📜 LUẬT CHƠI\n`;
    threadData.rules.split('\n').forEach(rule => { if (rule.trim()) msg += `» ${rule.trim()}\n`; });
    if (threadData.discount && threadData.discount.toLowerCase() !== 'no') msg += `» Tạo phòng được giảm ${threadData.discount}.\n`;
    msg += `──────────────────\n`;
    msg += `🗓️ CÁC KHUNG GIỜ\n\n`;
    for (const slot of threadData.timeSlots) {
        msg += `⏳ Khung Giờ: ${slot.time}\n`;
        msg += `• Phí: ${slot.price}\n`;
        msg += `• Thể thức: ${slot.format}${slot.note ? ` (${slot.note})` : ''}\n`;
        for (let i = 0; i < 12; i++) {
            const teamEntry = slot.teams[i];
            let teamName = '';
            let paidMark = '';
            if (teamEntry) {
                if (typeof teamEntry === 'string') { teamName = teamEntry; } 
                else { teamName = teamEntry.name; if (teamEntry.paid) paidMark = ' (succes)'; }
            }
            msg += `${numberIcons[i]} ${teamName}${paidMark}\n`;
        }
        msg += `\n`;
    }
    msg += `──────────────────\n`;
    msg += `🏆 GIẢI THƯỞNG\n\n`;
    for (const prize of threadData.prizes) {
        msg += `Gói giải: ${prize.price}\n`;
        msg += `› Top 1: ${prize.top1}\n`;
        msg += `› Top 2: ${prize.top2}\n`;
        msg += `› Top 3: ${prize.top3}\n\n`;
    }
    msg += `──────────────────\n`;
    msg += `💳 THÔNG TIN THANH TOÁN\n`;
    if (threadData.payment) {
        msg += `• Chủ TK: ${threadData.payment.accountName}\n`;
        msg += `• ${threadData.payment.bankName || threadData.payment.method}: ${threadData.payment.accountNo}\n`;
        msg += `(Hoặc quét mã QR đính kèm)\n`;
    }
    return msg.trim();
}

async function checkPermission(api, senderID, threadID) {
    if (global.config.ADMINBOT.includes(senderID)) return true;
    try {
        const threadInfo = await new Promise((r, j) => api.getThreadInfo(threadID, (e, i) => e ? j(e) : r(i)));
        return threadInfo.adminIDs.map(a => a.id).includes(senderID);
    } catch { return false; }
}

async function startAutosend(api, threadID) {
    if (global.customAnnouncements[threadID]) {
        clearInterval(global.customAnnouncements[threadID]);
    }

    const allData = readData();
    const threadData = allData[threadID];

    if (threadData && threadData.autosend) {
        global.customAnnouncements[threadID] = setInterval(async () => {
            const currentData = readData()[threadID];
            if (!currentData || !currentData.autosend) {
                clearInterval(global.customAnnouncements[threadID]);
                delete global.customAnnouncements[threadID];
                return;
            }
            
            const body = formatAnnouncement(currentData);
            if (!body) return;

            const attachments = [];
            if (currentData.payment) {
                try {
                    if (currentData.payment.method === 'E-Banking' && currentData.payment.qrPath && fs.existsSync(currentData.payment.qrPath)) {
                        attachments.push(fs.createReadStream(currentData.payment.qrPath));
                    } else if (currentData.payment.method === 'Ngân hàng' && currentData.payment.acqId && currentData.payment.accountNo) {
                        const qrUrl = `https://img.vietqr.io/image/${currentData.payment.acqId}-${currentData.payment.accountNo}-compact2.png?accountName=${encodeURIComponent(currentData.payment.accountName)}`;
                        const imageStream = await axios.get(qrUrl, { responseType: 'stream' }).then(r => r.data);
                        attachments.push(imageStream);
                    }
                } catch (e) {
                     console.error(`Lỗi khi tạo QR cho autosend nhóm ${threadID}:`, e);
                }
            }
            api.sendMessage({ body, attachment: attachments }, threadID);
        }, 15 * 60 * 1000);
    }
}

module.exports.config = {
    name: "custom",
    version: "1.9.1",
    hasPermssion: 0,
    credits: "Pcoder & Gemini",
    description: "Quản lý và tự động thông báo giải đấu custom (tích hợp limit).",
    commandCategory: "Quản Trị Viên",
    usages: "[set|add|del|succes|on|off|view|reset [giờ?]]",
    cooldowns: 5,
    dependencies: { "fuse.js": "", "fs-extra": "" }
};

module.exports.onLoad = ({ api }) => {
    global.customAnnouncements = {};
    const allData = readData();
    for (const tid in allData) {
        if (allData[tid] && allData[tid].autosend) {
            startAutosend(api, tid);
        }
    }
};

module.exports.run = async function({ api, event, args }) {
    const { threadID, senderID, messageID } = event;
    
    try {
        const limitData = fse.readJsonSync(limitPath, { throws: false }) || {};
        const threadLimit = limitData[threadID];
        if (threadLimit && threadLimit.autopost === false) {
            return api.sendMessage("❎ Admin đã tắt nhóm lệnh 'Tự Động Lên Bảng' trong nhóm này.", threadID, messageID);
        }
    } catch (e) {
        console.log("Lỗi khi đọc file limit.json trong lệnh custom:", e);
    }

    const allData = readData();
    let threadData = allData[threadID] || {};
    const cmd = args[0]?.toLowerCase();
    const hasPermission = await checkPermission(api, senderID, threadID);

    const sendAnnouncement = async (body, msg_id = messageID) => {
        const attachments = [];
        if (threadData.payment) {
            if (threadData.payment.method === 'E-Banking' && threadData.payment.qrPath && fs.existsSync(threadData.payment.qrPath)) {
                attachments.push(fs.createReadStream(threadData.payment.qrPath));
            } else if (threadData.payment.method === 'Ngân hàng' && threadData.payment.acqId && threadData.payment.accountNo) {
                try {
                    const qrUrl = `https://img.vietqr.io/image/${threadData.payment.acqId}-${threadData.payment.accountNo}-compact2.png?accountName=${encodeURIComponent(threadData.payment.accountName)}`;
                    const imageStream = await axios.get(qrUrl, { responseType: 'stream' }).then(r => r.data);
                    attachments.push(imageStream);
                } catch (e) { console.error("Lỗi tạo QR khi gửi:", e); }
            }
        }
        api.sendMessage({ body, attachment: attachments }, threadID, msg_id);
    };

    switch (cmd) {
        case 'set':
            if (!hasPermission) return api.sendMessage("🚫 Chỉ QTV hoặc Admin BOT mới có thể dùng lệnh.", threadID, messageID);
            return api.sendMessage("Vui lòng nhập Tên Custom (không icon):", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author: senderID, type: 'setName', data: { autosend: true } }), messageID);

        case 'reset':
        case 'succes':
        case 'add':
        case 'del':
        case 'on':
        case 'off': {
            if (!hasPermission) return api.sendMessage("🚫 Chỉ QTV hoặc Admin BOT mới có thể dùng lệnh.", threadID, messageID);
            if (!threadData.name) return api.sendMessage("⚠️ Nhóm này chưa thiết lập custom.", threadID, messageID);

            if (cmd === 'reset') {
                const timeSlotToReset = args[1];

                if (timeSlotToReset) {
                    const slotIndex = threadData.timeSlots.findIndex(s => s.time.includes(timeSlotToReset));
                    if (slotIndex === -1) {
                        return api.sendMessage(`❌ Không tìm thấy khung giờ "${timeSlotToReset}" để reset.`, threadID, messageID);
                    }
                    const slotTime = threadData.timeSlots[slotIndex].time;
                    threadData.timeSlots[slotIndex].teams = Array(12).fill(null);
                    allData[threadID] = threadData;
                    saveData(allData);
                    return sendAnnouncement(`✅ Đã reset danh sách team cho khung giờ ${slotTime}.\n\n` + formatAnnouncement(threadData));
                } else {
                    if (!threadData.timeSlots || threadData.timeSlots.length === 0) {
                        return api.sendMessage("ℹ️ Không có khung giờ nào để reset.", threadID, messageID);
                    }
                    threadData.timeSlots.forEach(slot => {
                        slot.teams = Array(12).fill(null);
                    });
                    allData[threadID] = threadData;
                    saveData(allData);
                    return sendAnnouncement("✅ Đã reset lại toàn bộ danh sách team.\n\n" + formatAnnouncement(threadData));
                }
            }
            
            if (cmd === 'on' || cmd === 'off') {
                const isOn = cmd === 'on';
                if (threadData.autosend === isOn) return api.sendMessage(`ℹ️ Autosend đã ở trạng thái '${cmd}'.`, threadID, messageID);
                threadData.autosend = isOn;
                allData[threadID] = threadData;
                saveData(allData);
                if (isOn) {
                    startAutosend(api, threadID);
                    api.sendMessage(`✅ Đã bật tự động gửi thông báo mỗi 15 phút.`, threadID, messageID);
                } else {
                    if (global.customAnnouncements[threadID]) clearInterval(global.customAnnouncements[threadID]);
                    delete global.customAnnouncements[threadID];
                    api.sendMessage(`✅ Đã tắt tự động gửi thông báo.`, threadID, messageID);
                }
                return;
            }
            
            const timeSlotInput = args[1];
            if (!timeSlotInput) return api.sendMessage(`⚠️ Cú pháp: .custom ${cmd} [khung giờ] ...`, threadID, messageID);
            const slotIndex = threadData.timeSlots.findIndex(s => s.time.includes(timeSlotInput));
            if (slotIndex === -1) return api.sendMessage(`❌ Không tìm thấy khung giờ "${timeSlotInput}".`, threadID, messageID);

            if (cmd === 'add') {
                const teamsToAdd = args.slice(2).join(" ").split(',').map(t => t.trim()).filter(Boolean);
                if (teamsToAdd.length === 0) return api.sendMessage("⚠️ Bạn chưa nhập tên team để thêm.", threadID, messageID);
                let addedCount = 0;
                for (const teamName of teamsToAdd) {
                    let emptyIndex = threadData.timeSlots[slotIndex].teams.indexOf(null);
                    if (emptyIndex !== -1) {
                        threadData.timeSlots[slotIndex].teams[emptyIndex] = { name: teamName, paid: false };
                        addedCount++;
                    } else { api.sendMessage(`⚠️ Khung giờ ${timeSlotInput} đã đủ 12 team.`, threadID); break; }
                }
                if (addedCount > 0) {
                    allData[threadID] = threadData;
                    saveData(allData);
                    sendAnnouncement(`✅ Đã thêm ${addedCount} team.\n\n` + formatAnnouncement(threadData));
                }
            }

            if (cmd === 'del') {
                const slotToDel = threadData.timeSlots[slotIndex];
                let delMsg = `Reply số hoặc icon của team muốn xóa (khung giờ ${slotToDel.time}):\n\n`;
                const numberIcons = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿", "⓫", "⓬"];
                const teamsWithContent = slotToDel.teams.map((t, i) => ({team: t, index: i})).filter(item => item.team);
                if (teamsWithContent.length === 0) return api.sendMessage(`ℹ️ Khung giờ ${slotToDel.time} chưa có team nào.`, threadID, messageID);
                teamsWithContent.forEach(item => {
                    const teamName = typeof item.team === 'string' ? item.team : item.team.name;
                    delMsg += `${numberIcons[item.index]} ${teamName}\n`;
                });
                api.sendMessage(delMsg, threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author: senderID, type: 'deleteTeam', timeSlot: slotToDel.time }), messageID);
            }
            
            if (cmd === 'succes') {
                 const teamNumbers = args.slice(2).map(n => parseInt(n)).filter(n => n > 0 && n < 13);
                 if (teamNumbers.length === 0) return api.sendMessage("⚠️ Bạn chưa nhập số thứ tự team. Ví dụ: .custom succes 12h30 1 5 8", threadID, messageID);
                 let updatedCount = 0;
                 teamNumbers.forEach(num => {
                     const index = num - 1;
                     let teamEntry = threadData.timeSlots[slotIndex].teams[index];
                     if (teamEntry) {
                         if (typeof teamEntry === 'string') {
                             threadData.timeSlots[slotIndex].teams[index] = { name: teamEntry, paid: true };
                         } else {
                             teamEntry.paid = true;
                         }
                         updatedCount++;
                     }
                 });
                 if (updatedCount > 0) {
                     allData[threadID] = threadData;
                     saveData(allData);
                     sendAnnouncement(`✅ Đã xác nhận thanh toán cho ${updatedCount} team.\n\n` + formatAnnouncement(threadData));
                 } else {
                     api.sendMessage("⚠️ Không tìm thấy team nào ở các vị trí đã cho.", threadID, messageID);
                 }
            }
            break;
        }

        case 'view':
            if (!threadData.name) return api.sendMessage("⚠️ Nhóm này chưa thiết lập custom.", threadID, messageID);
            sendAnnouncement(formatAnnouncement(threadData));
            break;

        default:
            api.sendMessage("✨--- QUẢN LÝ CUSTOM ---✨\n» .custom set: Thiết lập thông báo mới.\n» .custom add [giờ] [tên team]: Thêm team.\n» .custom del [giờ]: Xóa team.\n» .custom succes [giờ] [số]: Đánh dấu đã thanh toán.\n» .custom on/off: Bật/tắt tự động gửi.\n» .custom view: Xem lại thông báo.\n» .custom reset [giờ?]: Xóa danh sách team (để trống giờ để reset tất cả).", threadID, messageID);
            break;
    }
};

module.exports.handleReply = async function({ api, event, handleReply }) {
    const { threadID, senderID, messageID, body } = event;
    
    try {
        const limitData = fse.readJsonSync(limitPath, { throws: false }) || {};
        const threadLimit = limitData[threadID];
        if (threadLimit && threadLimit.autopost === false) {
            return;
        }
    } catch (e) {}

    const { author, type, data } = handleReply;
    if (senderID !== author) return;
    api.unsendMessage(handleReply.messageID).catch(e => {});
    const allData = readData();

    const sendFinalAnnouncement = async (finalData) => {
        allData[threadID] = finalData;
        saveData(allData);
        startAutosend(api, threadID);
        
        const announcementBody = "✅ Đã thiết lập custom thành công!\n\n" + formatAnnouncement(finalData);
        const attachments = [];
        if (finalData.payment) {
            if (finalData.payment.method === 'E-Banking' && finalData.payment.qrPath && fs.existsSync(finalData.payment.qrPath)) {
                attachments.push(fs.createReadStream(finalData.payment.qrPath));
            } else if (finalData.payment.method === 'Ngân hàng' && finalData.payment.acqId && finalData.payment.accountNo) {
                try {
                    const qrUrl = `https://img.vietqr.io/image/${finalData.payment.acqId}-${finalData.payment.accountNo}-compact2.png?accountName=${encodeURIComponent(finalData.payment.accountName)}`;
                    const imageStream = await axios.get(qrUrl, { responseType: 'stream' }).then(r => r.data);
                    attachments.push(imageStream);
                } catch (e) { console.error("Lỗi tạo QR khi set:", e); }
            }
        }
        api.sendMessage({ body: announcementBody, attachment: attachments }, threadID, messageID);
    };

    switch (type) {
        case 'setName':
            data.name = body;
            return api.sendMessage("Nhập Luật Custom (có thể xuống dòng):", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setRules', data }), messageID);

        case 'setRules':
            data.rules = body;
            return api.sendMessage("Nhập Khung Giờ:\n[Giờ] [Giá] [Thể thức] (Ghi chú)\n\nVí dụ:\n12h30 7k cpr (logo) | 19h30 10k thường", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setTimeSlots', data }), messageID);

        case 'setTimeSlots':
            data.timeSlots = body.split('|').map(s => {
                const m = s.trim().match(/(\S+)\s+(\S+)\s+([^()]+)(?:\((.*?)\))?/);
                return m ? { time: m[1], price: m[2], format: m[3].trim(), note: m[4]?.trim()||'', teams: Array(12).fill(null) } : null;
            }).filter(Boolean);
            if (data.timeSlots.length === 0) return api.sendMessage("❌ Định dạng khung giờ không hợp lệ.", threadID, messageID);
            return api.sendMessage("Người tạo phòng có được giảm giá không? (Vd: 5k, hoặc 'no')", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setDiscount', data }), messageID);

        case 'setDiscount':
            data.discount = body.toLowerCase();
            return api.sendMessage("Nhập Giải Thưởng:\n[Giá] top1 [giải] top2 [giải]\n\nVí dụ:\n7k top1 40k+pro | 10k top1 50k", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setPrizes', data }), messageID);

        case 'setPrizes':
            data.prizes = body.split('|').map(p => {
                const parts = p.trim().split(/\s+top\d\s+/);
                if (parts.length < 2) return null;
                const price = parts[0];
                const tops = p.trim().substring(price.length).trim();
                const t1 = tops.match(/top1\s+([^]+?)(?=\s+top2|\s+top3|$)/);
                const t2 = tops.match(/top2\s+([^]+?)(?=\s+top3|$)/);
                const t3 = tops.match(/top3\s+([^]+)/);
                return { price, top1: t1?.[1].trim()||'N/A', top2: t2?.[1].trim()||'N/A', top3: t3?.[1].trim()||'N/A' };
            }).filter(Boolean);
            if (data.prizes.length === 0) return api.sendMessage("❌ Định dạng giải thưởng không hợp lệ.", threadID, messageID);
            return api.sendMessage("Nhập Tên Chủ Tài Khoản (viết hoa, không dấu):", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setAccountName', data }), messageID);
            
        case 'setAccountName':
            data.payment = { accountName: body.toUpperCase() };
            return api.sendMessage("Chọn phương thức thanh toán:\n1. E-Banking (QR tự tải lên)\n2. Ngân hàng (QR tự tạo)\n\nReply 1 hoặc 2.", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setPaymentMethod', data }), messageID);

        case 'setPaymentMethod':
            if (body === '1') {
                data.payment.method = 'E-Banking';
                return api.sendMessage("Reply tin nhắn này kèm ảnh mã QR của bạn:", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setQrCode', data }), messageID);
            }
            if (body === '2') {
                data.payment.method = 'Ngân hàng';
                 return api.sendMessage("Nhập Tên Ngân Hàng và STK:\nVí dụ: mbbank 0123456789", threadID, (e, i) => global.client.handleReply.push({ name: this.config.name, messageID: i.messageID, author, type: 'setBankInfo', data }), messageID);
            }
            return api.sendMessage("⚠️ Lựa chọn không hợp lệ.", threadID, messageID);
        
        case 'setQrCode':
            if (!event.attachments || event.attachments[0]?.type !== 'photo') return api.sendMessage("⚠️ Vui lòng reply kèm một ảnh QR.", threadID, messageID);
            const qrUrl = event.attachments[0].url;
            const cacheFolder = path.join(__dirname, 'cache');
            if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder);
            const qrPath = path.join(cacheFolder, `qr_${threadID}.jpg`);
            try {
                const res = await axios.get(qrUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(qrPath, res.data);
                data.payment.qrPath = qrPath;
                data.payment.accountNo = "Không có";
                data.payment.bankName = "MOMO/ZALOPAY";
                sendFinalAnnouncement(data);
            } catch (e) {
                return api.sendMessage("❌ Không thể tải ảnh QR. Vui lòng thử lại.", threadID, messageID);
            }
            break;

        case 'setBankInfo':
            const match = body.trim().match(/^(\S+)\s+(.+)$/);
            if (!match) return api.sendMessage("⚠️ Cú pháp sai. Ví dụ: mbbank 0123456789", threadID, messageID);
            const [_, bankInput, accountNo] = match;
            const bank = await getBankInfo(bankInput);
            if (!bank) return api.sendMessage(`❌ Không tìm thấy ngân hàng "${bankInput}". Vui lòng thử lại tên khác (vd: mbbank, vcb...).`, threadID, messageID);
            data.payment.accountNo = accountNo;
            data.payment.bankName = bank.shortName;
            data.payment.acqId = bank.bin;
            sendFinalAnnouncement(data);
            break;

        case 'deleteTeam':
            const numberIcons = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿", "⓫", "⓬"];
            let teamIndex = -1;
            const repliedNum = parseInt(body);
            if (!isNaN(repliedNum) && repliedNum > 0 && repliedNum < 13) {
                teamIndex = repliedNum - 1;
            } else {
                teamIndex = numberIcons.indexOf(body.trim().toUpperCase());
            }
            if (teamIndex === -1) return api.sendMessage("⚠️ Lựa chọn không hợp lệ, vui lòng reply một số từ 1 đến 12.", threadID, messageID);
            
            const slotToDel = allData[threadID]?.timeSlots.find(s => s.time === handleReply.timeSlot);
            if (!slotToDel || !slotToDel.teams[teamIndex]) return api.sendMessage("⚠️ Vị trí này không có team.", threadID, messageID);
            
            const teamEntry = slotToDel.teams[teamIndex];
            const teamName = typeof teamEntry === 'string' ? teamEntry : teamEntry.name;
            slotToDel.teams[teamIndex] = null;
            allData[threadID] = allData[threadID];
            saveData(allData);
            
            sendAnnouncement(`✅ Đã xóa team "${teamName}" khỏi khung giờ ${handleReply.timeSlot}.\n\n` + formatAnnouncement(allData[threadID]));
            break;
    }
};
