// Phiên bản 14.1.0 (Tích hợp API thật) - AI vẽ và gửi ảnh trực tiếp
// Tác giả: Gemini & J-JRT
// Hướng dẫn: Cần cài đặt axios (npm install axios) và có API Key từ một dịch vụ tạo ảnh.

const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Thư viện để gọi API

module.exports.config = {
    name: "taologo",
    version: "14.1.0",
    hasPermssion: 0,
    credits: "Gemini & J-JRT",
    description: "Tạo logo Esport qua quy trình hỏi-đáp và AI vẽ trực tiếp.",
    commandCategory: "tiện ích",
    cooldowns: 30, // Tăng thời gian chờ vì tạo ảnh tốn tài nguyên
    usages: ""
};

// --- HÀM TẠO ẢNH (QUAN TRỌNG!) ---
// Sử dụng API của Clipdrop (Stability AI) làm ví dụ.
async function generateImage(prompt) {
    // THAY THẾ API KEY CỦA BẠN VÀO ĐÂY
    const YOUR_API_KEY = 'API_KEY_CUA_BAN'; 

    if (YOUR_API_KEY === 'API_KEY_CUA_BAN') {
        console.log("LỖI: Bạn chưa thay thế API Key trong code taologo.js");
        return null;
    }

    const apiEndpoint = 'https://clipdrop-api.co/text-to-image/v1';
    const formData = new FormData();
    formData.append('prompt', `${prompt}, esport logo, vector, simple, minimalist, high quality`);

    try {
        console.log("🚀 Đang gửi yêu cầu tạo ảnh đến AI...");
        const response = await axios.post(apiEndpoint, formData, {
            headers: {
                'x-api-key': YOUR_API_KEY,
                ...formData.getHeaders()
            },
            responseType: 'arraybuffer' // Rất quan trọng để nhận dữ liệu ảnh
        });

        console.log("✅ Đã nhận được dữ liệu ảnh từ AI.");
        return Buffer.from(response.data, 'binary');

    } catch (error) {
        // In ra lỗi chi tiết để dễ dàng gỡ rối
        const errorData = error.response ? Buffer.from(error.response.data).toString() : error.message;
        console.error("❌ Lỗi khi gọi API tạo ảnh:", errorData);
        return null;
    }
}


module.exports.run = async function({ api, event }) {
    const { threadID, messageID, senderID } = event;
    api.sendMessage("Chào bạn! Để bắt đầu tạo logo, vui lòng trả lời câu hỏi sau:\n\n1. Tên chính của logo là gì?", threadID, (err, info) => {
        if (err) return console.error(err);
        global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: senderID,
            step: 1,
            data: {}
        });
    }, messageID);
};

module.exports.handleReply = async function({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;
    const { author, step, data } = handleReply;

    if (senderID !== author) return;

    const replyContent = body.trim();
    try { api.unsendMessage(handleReply.messageID); } catch (e) {}

    switch (step) {
        case 1:
            data.mainText = replyContent;
            api.sendMessage("2. Tên phụ (viết tắt) của logo là gì?\n(Nếu không có, ghi \"không\")", threadID, (err, info) => {
                if (err) return;
                global.client.handleReply.push({ ...handleReply, messageID: info.messageID, step: 2, data: data });
            }, messageID);
            break;
        case 2:
            data.subText = replyContent;
            api.sendMessage("3. Ý tưởng chính cho logo là gì?\n(Ví dụ: một con đại bàng, một chiến binh robot...)", threadID, (err, info) => {
                if (err) return;
                global.client.handleReply.push({ ...handleReply, messageID: info.messageID, step: 3, data: data });
            }, messageID);
            break;
        case 3:
            data.idea = replyContent;
            api.sendMessage("4. Màu sắc chủ đạo của logo là gì?\n(Ví dụ: xanh dương, bạc, trắng)", threadID, (err, info) => {
                if (err) return;
                global.client.handleReply.push({ ...handleReply, messageID: info.messageID, step: 4, data: data });
            }, messageID);
            break;
        case 4:
            data.colors = replyContent;
            await requestGenerationAndSend(api, event, data);
            break;
    }
};

async function requestGenerationAndSend(api, event, data) {
    const { threadID, messageID } = event;
    const { mainText, subText, idea, colors } = data;

    const subTextPrompt = (subText && subText.toLowerCase() !== 'không' && subText.trim() !== '') ? `with the secondary text "${subText}"` : '';
    const fullPrompt = `Esport logo for a team called "${mainText}", ${subTextPrompt}. Main mascot/idea: a ${idea}. Primary colors: ${colors}.`;

    try {
        await api.sendMessage(
            `✅ Đã tổng hợp xong yêu cầu! Đang gửi đến AI để vẽ, vui lòng chờ khoảng 30 giây...\n\n` +
            `📝 Prompt: "${fullPrompt}"`,
            threadID, messageID
        );

        // Gọi hàm tạo ảnh thật sự
        const imageBuffer = await generateImage(fullPrompt);

        if (imageBuffer) {
            const cachePath = path.join(__dirname, 'cache');
            if (!fs.existsSync(cachePath)) {
                fs.mkdirSync(cachePath);
            }
            const imagePath = path.join(cachePath, `logo_${Date.now()}.png`);
            
            // Lưu ảnh vào thư mục cache
            fs.writeFileSync(imagePath, imageBuffer);
            console.log(`✅ Đã lưu ảnh vào: ${imagePath}`);

            // Gửi ảnh vào messenger
            await api.sendMessage({
                body: `🎉 Đây là logo Esport cho đội "${mainText}" của bạn!`,
                attachment: fs.createReadStream(imagePath)
            }, threadID, (err) => {
                if (err) console.error("Lỗi khi gửi ảnh:", err);
                // Xóa file sau khi gửi để không làm đầy bộ nhớ
                fs.unlinkSync(imagePath);
            }, messageID);
        } else {
            api.sendMessage("❌ Rất tiếc, đã có lỗi xảy ra trong quá trình tạo ảnh từ AI. Vui lòng xem console của bot để biết chi tiết.", threadID, messageID);
        }

    } catch (error) {
        console.error("Lỗi trong quá trình xử lý cuối cùng:", error);
        api.sendMessage("❌ Đã có lỗi hệ thống xảy ra.", threadID, messageID);
    }
}
