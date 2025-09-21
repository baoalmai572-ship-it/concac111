// Đây là file testapi.js dùng để chẩn đoán lỗi
const axios = require('axios');

module.exports.config = {
    name: "testapi",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Gemini",
    description: "Kiểm tra xem axios có hoạt động không.",
    commandCategory: "tiện ích",
    cooldowns: 5,
    usages: ""
};

module.exports.run = async function({ api, event }) {
    try {
        api.sendMessage("Đang kiểm tra kết nối API...", event.threadID, event.messageID);
        const response = await axios.get('https://api.kanye.rest/');
        const quote = response.data.quote;
        api.sendMessage(`✅ Kết nối thành công!\n\nAPI trả về câu nói: "${quote}"`, event.threadID);
    } catch (error) {
        console.error("Lỗi khi kiểm tra API:", error);
        api.sendMessage(`❌ Đã xảy ra lỗi khi kết nối tới API công khai. Lỗi: ${error.message}`, event.threadID);
    }
};
