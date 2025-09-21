// được code bởi Gemini & Pcoder - Phiên bản cuối cùng v15.0
// Cập nhật bởi Pcoder v16.1
// Sửa đổi bởi Gemini - v16.4 - Fix lỗi spam giao dịch
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ##### THÔNG TIN CẤU HÌNH BẮT BUỘC #####
const BANK_CONFIG = {
    BANK_ID: "970422", // MB Bank
    ACCOUNT_NO: "5127032006",
    ACCOUNT_NAME: "LE THANH NGHIA"
};
const PAY2S_CONFIG = {
    ACCESS_KEY: "2cc5f1d8237a2ceae854ea5d238f59499f4245a602474bbb83f8c1b5168067ea",
    SECRET_KEY: "99aa1a9aa7f297e594d44a9b2b782eec93442451ca2664ec43dc4b2c0ce85ab3"
};
const PREFIX_CODE = "pcoder";
const EXPIRED_TIME_MINUTE = 5;
// #########################################


// --- Quản lý file và đường dẫn ---
const paymentFolder = path.join(__dirname, 'payment');
if (!fs.existsSync(paymentFolder)) fs.mkdirSync(paymentFolder, { recursive: true });

const bankqrCacheFolder = path.join(__dirname, 'bankqr', 'cache');
if (!fs.existsSync(bankqrCacheFolder)) fs.mkdirSync(bankqrCacheFolder, { recursive: true });

const dataFolder = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder, { recursive: true });

const PENDING_FILE = path.join(paymentFolder, 'bank_pending.json');
const USER_TURNS_FILE = path.join(paymentFolder, 'bank_user_turns.json');
// ##### FIX LỖI SPAM ##### - Tạo file mới để lưu các giao dịch đã hoàn thành
const COMPLETED_IDS_FILE = path.join(paymentFolder, 'bank_completed_ids.json');
const COMPLETED_LOG_FILE = path.join(dataFolder, 'completed_transactions.log');


// --- Các hàm helper ---
function readJsonFile(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        const rawData = fs.readFileSync(filePath);
        return JSON.parse(rawData);
    } catch (error) { return defaultValue; }
}

function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) { console.error(`Lỗi khi ghi file ${filePath}:`, error); }
}

function logCompletedTransaction(data) {
    const logMessage = `[${new Date().toISOString()}] - ${JSON.stringify(data)}\n`;
    fs.appendFileSync(COMPLETED_LOG_FILE, logMessage);
}

async function getUserName(api, Users, uid) {
    try {
        const nameFromCache = (await Users.getData(uid))?.name;
        if (nameFromCache) return nameFromCache;
    } catch (error) {}
    try {
        const infoFromApi = await api.getUserInfo(uid);
        if (infoFromApi && infoFromApi[uid] && infoFromApi[uid].name) return infoFromApi[uid].name;
    } catch (error) {}
    try {
        const profileUrl = `https://www.facebook.com/profile.php?id=${uid}`;
        const res = await axios.get(`https://ffb.vn/api/tool/get-id-fb?idfb=${encodeURIComponent(profileUrl)}`);
        if (res.data.error === 0 && res.data.name) return res.data.name;
    } catch (e) {}
    return `Người dùng ${uid}`;
}

let bankingApi;

module.exports = {
    config: {
        name: "bankqr",
        version: "16.4-SpamFix",
        author: "Gemini & Pcoder",
        description: "Tạo QR để nạp lượt và tự động đổi biệt danh theo số lượt.",
        commandCategory: "Tiện ích",
        usages: ".bankqr [số tiền]",
        cooldowns: 20
    },
    
    onLoad: function({ api }) {
        bankingApi = api;

        setInterval(async () => {
            if (!bankingApi) return;

            let pending = readJsonFile(PENDING_FILE);
            if (Object.keys(pending).length === 0) return;

            // ##### FIX LỖI SPAM ##### - Đọc "sổ ghi nhớ" các giao dịch đã hoàn thành
            let completedIds = new Set(readJsonFile(COMPLETED_IDS_FILE, []));
            let hasPendingChanges = false;
            let hasCompletedChanges = false;

            try {
                const now = Date.now();
                for (const content in pending) {
                    if (now - pending[content].createdAt > EXPIRED_TIME_MINUTE * 60 * 1000) {
                        delete pending[content];
                        hasPendingChanges = true;
                        console.log(`[BANKING] Đã xóa giao dịch hết hạn: ${content}`);
                    }
                }

                const today = new Date();
                const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                const pay2sToken = Buffer.from(PAY2S_CONFIG.SECRET_KEY).toString('base64');
                const response = await axios.post('https://my.pay2s.vn/userapi/transactions', {
                    bankAccounts: [BANK_CONFIG.ACCOUNT_NO],
                    begin: formattedDate,
                    end: formattedDate
                }, {
                    headers: { 'Content-Type': 'application/json', 'pay2s-access-key': PAY2S_CONFIG.ACCESS_KEY, 'pay2s-token': pay2sToken }
                });
                
                if (!response.data || !response.data.transactions) return;
                
                const history = response.data.transactions;
                for (const content in pending) {
                    const txData = pending[content];
                    const foundTx = history.find(transaction => 
                        transaction.description.toLowerCase().includes(content.toLowerCase()) && 
                        transaction.amount === txData.amount &&
                        transaction.type === 'IN'
                    );

                    if (foundTx) {
                        // ##### FIX LỖI SPAM ##### - Kiểm tra xem giao dịch này đã được xử lý trước đó chưa
                        if (completedIds.has(foundTx.transaction_id)) {
                            // Đã xử lý rồi -> xóa khỏi danh sách chờ và bỏ qua
                            delete pending[content];
                            hasPendingChanges = true;
                            console.log(`[BANKING] Bỏ qua giao dịch đã xử lý: ${foundTx.transaction_id}`);
                            continue; // Chuyển sang giao dịch chờ tiếp theo
                        }

                        const { senderID, amount, threadID } = txData;
                        const currentSenderName = await getUserName(bankingApi, global.Users, senderID);
                        const turnsToAdd = Math.floor(amount / 1000);

                        if (turnsToAdd > 0) {
                            let userData = readJsonFile(USER_TURNS_FILE, {});
                            userData[senderID] = (userData[senderID] || 0) + turnsToAdd;
                            writeJsonFile(USER_TURNS_FILE, userData);
                            const newTotalTurns = userData[senderID];
                            
                            const successMsgBody = `🎉 Giao dịch thành công!\n- Người dùng: @${currentSenderName}\n- Số tiền nạp: ${amount.toLocaleString('vi-VN')} VND\n- Số lượt được cộng: +${turnsToAdd} lượt\n- Tổng lượt hiện tại: ${newTotalTurns} lượt.`;
                            
                            bankingApi.sendMessage({ body: successMsgBody, mentions: [{ tag: `@${currentSenderName}`, id: senderID }] }, threadID);

                            const newNickname = `${currentSenderName} ${newTotalTurns} lượt`;
                            bankingApi.changeNickname(newNickname, threadID, senderID, (err) => {
                                if (err) {
                                    console.error(`[BANKING] Lỗi đổi biệt danh: `, err.errorDescription);
                                    bankingApi.sendMessage(`(i) Không thể tự động đặt biệt danh cho bạn. Lý do có thể là bot không có quyền Quản trị viên.`, threadID);
                                }
                            });

                            logCompletedTransaction({ ...txData, transaction_id: foundTx.transaction_id });
                        }
                        
                        // ##### FIX LỖI SPAM ##### - Ghi nhớ ID giao dịch này vào "sổ"
                        completedIds.add(foundTx.transaction_id);
                        hasCompletedChanges = true;

                        delete pending[content];
                        hasPendingChanges = true;
                    }
                }
            } catch (error) {
                 if (error.response) console.error("[BANKING PAY2S] Lỗi API:", error.response.status, error.response.data);
                 else console.error("[BANKING PAY2S] Lỗi không xác định:", error.message);
            } finally {
                if (hasPendingChanges) writeJsonFile(PENDING_FILE, pending);
                if (hasCompletedChanges) writeJsonFile(COMPLETED_IDS_FILE, Array.from(completedIds));
            }
        }, 20000);
    },

    run: async function({ api, event, args, Users }) {
        // ... (Phần run không thay đổi, vì nó đã hoạt động đúng) ...
        bankingApi = api;
        const { threadID, messageID, senderID } = event;
        const senderName = await getUserName(api, Users, senderID);
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1000) {
            return api.sendMessage("❌ Vui lòng nhập một số tiền hợp lệ (tối thiểu 1,000 VND để đổi lấy lượt).", threadID, messageID);
        }
        const transactionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const content = `${PREFIX_CODE}${transactionCode}`;
        try {
            api.sendMessage("⏳ Đang khởi tạo giao dịch, vui lòng chờ trong giây lát...", threadID, messageID);
            const qrResponse = await axios.post('https://api.vietqr.io/v2/generate', { 
                acqId: BANK_CONFIG.BANK_ID, 
                accountNo: BANK_CONFIG.ACCOUNT_NO, 
                accountName: BANK_CONFIG.ACCOUNT_NAME, 
                amount: amount, 
                addInfo: content, 
                template: "compact2" 
            });
            if (!qrResponse.data?.data?.qrDataURL) throw new Error("API VietQR không trả về dữ liệu QR hợp lệ.");
            const qrDataURL = qrResponse.data.data.qrDataURL;
            const imageBuffer = Buffer.from(qrDataURL.split(',')[1], 'base64');
            const imagePath = path.join(bankqrCacheFolder, `${content}.png`);
            fs.writeFileSync(imagePath, imageBuffer);
            const pending = readJsonFile(PENDING_FILE);
            pending[content] = { senderID, amount, threadID, senderName, createdAt: Date.now() };
            writeJsonFile(PENDING_FILE, pending);
            const turnsToGet = Math.floor(amount / 1000);
            const msg = { 
                body: `✅ Giao dịch của bạn đã được tạo!\n\n- Ngân hàng: ${BANK_CONFIG.ACCOUNT_NAME}\n- STK: ${BANK_CONFIG.ACCOUNT_NO}\n- Số tiền: ${amount.toLocaleString('vi-VN')} VND (sẽ nhận được ${turnsToGet} lượt)\n- Nội dung: ${content}\n\n⚠️ Vui lòng quét mã QR và **CHUYỂN KHOẢN ĐÚNG NỘI DUNG**. Giao dịch sẽ tự hủy sau ${EXPIRED_TIME_MINUTE} phút.`, 
                attachment: fs.createReadStream(imagePath) 
            };
            api.sendMessage(msg, threadID, (err) => {
                if (err) console.error(err);
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            });
        } catch (error) {
            console.error("[BANKING] Lỗi khi tạo QR:", error.response?.data || error.message);
            api.sendMessage("❌ Đã có lỗi xảy ra khi tạo mã QR. Vui lòng thử lại sau.", threadID, messageID);
        }
    }
};
