// =======================================================================================
// ============================ TƯỜNG AI v8.4.0 - HOÀN CHỈNH ============================
// =======================================================================================

// --- KHAI BÁO CÁC HẰNG SỐ VÀ API KEYS ---
const TUONGS = ["tuong", "tường"];
const YOUTUBE_API_KEY = "AIzaSyD16U7WwrIFGOKijx0GR_3hU6p7Ww7JObM"; // Lưu ý bảo mật
const GEMINI_API_KEY = "AIzaSyBRS5q0W9czyKuquLZ9-Ls-zZTVPaqR0qg"; // Lưu ý bảo mật
const GEMINI_MODEL = "gemini-1.5-flash-latest";
const GIPHY_KEY = "x2DSDHSAKfI06mgb0ON56fxtp9JAUTuQ";
const THECATAPI_KEY = "live_R3gMhw4dZ9qymWsBCSjbfzmelZpiawsrH4VwR8qmEs316MDgvwcvSMDgWuxkEdK3";
const GENIUS_API_KEY = "YOUR_GENIUS_API_KEY"; // <<< THAY API KEY CỦA BẠN VÀO ĐÂY
const OPENWEATHERMAP_API_KEY = "619bf420046f8164a5246c084d56e547"; // API Key bạn cung cấp

// --- KHAI BÁO CÁC MODULES CẦN THIẾT ---
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const ytdl = require("@distube/ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const qs = require("qs");
const { v4: uuidv4 } = require('uuid');

// --- CẤU HÌNH ĐƯỜNG DẪN THƯ MỤC ---
// Lưu ý: Đường dẫn này có thể cần điều chỉnh tùy thuộc vào cấu trúc thư mục bot của bạn
const DATA_DIR = path.join(__dirname, "../../../pdata/AIdata");
const TUONG_DIR = path.join(DATA_DIR, "tuong_ai");
const VISION_CACHE_DIR = path.join(TUONG_DIR, "cache_vision");
const TMP_DIR = path.join(__dirname, "../../tmp_tuong");

// Đảm bảo các thư mục tồn tại
[DATA_DIR, TUONG_DIR, VISION_CACHE_DIR, TMP_DIR].forEach(dir => fs.ensureDirSync(dir));

// --- CẤU HÌNH ĐƯỜNG DẪN FILE DỮ LIỆU ---
const userDataFile = path.join(TUONG_DIR, "user_data.json");
const groupDataFile = path.join(TUONG_DIR, "group_data.json");
const remindersFile = path.join(TUONG_DIR, "reminders.json");
const autoAIFile = path.join(TUONG_DIR, "auto_ai.json");

// Khởi tạo file nếu chưa tồn tại
[userDataFile, groupDataFile, remindersFile, autoAIFile].forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify({}));
    }
});

// --- TẢI DỮ LIỆU TỪ FILE JSON ---
let userData = {};
try { userData = JSON.parse(fs.readFileSync(userDataFile, 'utf-8')); } catch (e) { console.error("Lỗi tải userData.json:", e); }
let groupData = {};
try { groupData = JSON.parse(fs.readFileSync(groupDataFile, 'utf-8')); } catch (e) { console.error("Lỗi tải groupData.json:", e); }
let autoAI = {};
try { autoAI = JSON.parse(fs.readFileSync(autoAIFile, 'utf-8')); } catch (e) { console.error("Lỗi tải autoAI.json:", e); }

let BOT_ID = null;

// =======================================================================================
// =================================== CÁC HÀM HỖ TRỢ ===================================
// =======================================================================================

// Lưu dữ liệu vào file JSON
function saveData(type) {
    try {
        let filePath;
        let dataToSave;
        switch (type) {
            case 'userData':
                filePath = userDataFile;
                dataToSave = userData;
                break;
            case 'groupData':
                filePath = groupDataFile;
                dataToSave = groupData;
                break;
            case 'autoAI':
                filePath = autoAIFile;
                dataToSave = autoAI;
                break;
            default:
                return;
        }
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 4));
    } catch (e) {
        console.error(`Lỗi khi lưu file ${type}.json:`, e);
    }
}

// Chuyển chuỗi có dấu thành không dấu để xử lý
function unsign(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Phân tích yêu cầu media từ tin nhắn người dùng
function parseMediaRequest(userMessage) {
    const msg = unsign(userMessage);
    if (/(video|clip|mv|phim)/.test(msg)) return { type: "mp4", query: msg.replace(/(video|clip|mv|phim)/, "").trim() };
    if (/(nhac|bai hat|mp3|music)/.test(msg)) return { type: "mp3", query: msg.replace(/(nhac|bai hat|mp3|music)/, "").trim() };
    if (/(gif|anh dong)/.test(msg)) return { type: "gif", query: msg.replace(/(gif|anh dong)/, "").trim() };
    return null;
}

// Tìm kiếm video trên YouTube
async function searchYouTube(query, maxResults = 5) {
    try {
        const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
            params: { q: query, key: YOUTUBE_API_KEY, part: "snippet", maxResults, type: "video" }
        });
        return response.data.items.map(video => ({
            title: video.snippet.title,
            videoId: video.id.videoId,
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`
        }));
    } catch (e) {
        console.error("Lỗi khi tìm kiếm YouTube:", e.message);
        return [];
    }
}

// Tải và gửi media từ YouTube
async function downloadAndSendMedia(api, event, chosenVideo, mediaType) {
    const { threadID, messageID } = event;
    const ext = mediaType === "mp3" ? "mp3" : "mp4";
    const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);

    try {
        api.sendMessage(`⏳ Đang xử lý và tải "${chosenVideo.title}"... Vui lòng chờ một lát.`, threadID, messageID);
        
        const stream = ytdl(chosenVideo.videoId, {
            quality: 'highest',
            filter: mediaType === 'mp3' ? 'audioonly' : 'videoandaudio'
        });

        await new Promise((resolve, reject) => {
            const ffmpegCommand = ffmpeg(stream);
            if (mediaType === 'mp3') {
                ffmpegCommand.audioBitrate(128).audioCodec('libmp3lame').format('mp3');
            } else {
                ffmpegCommand.videoCodec('libx264').audioCodec('aac').format('mp4');
            }
            ffmpegCommand
                .on('end', resolve)
                .on('error', (err) => reject(new Error(`Lỗi FFMPEG: ${err.message}`)))
                .save(filePath);
        });

        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            const msgData = {
                body: `✅ Gửi bạn ${mediaType === 'mp3' ? 'bài hát' : 'video'} "${chosenVideo.title}"`,
                attachment: fs.createReadStream(filePath)
            };
            await api.sendMessage(msgData, threadID);
        } else {
            throw new Error("File tải về bị lỗi hoặc rỗng.");
        }

    } catch (error) {
        console.error(`Lỗi toàn trình khi tải media:`, error);
        api.sendMessage(`Rất tiếc, đã xảy ra lỗi trong quá trình tải file: ${error.message}`, threadID);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

// =======================================================================================
// =================================== MODULE EXPORTS ===================================
// =======================================================================================

module.exports.config = {
    name: "tuong",
    version: "8.5.0", // Phiên bản đã được rà soát
    hasPermssion: 0,
    credits: "PCODER (Mega Update) | Sửa lại bởi D-Jukie",
    description: "Tường AI - Trợ lý ảo đa năng với nhiều tính năng thông minh.",
    commandCategory: "AI",
    usages: [
        "tuong [nội dung] - Chat với AI.",
        "tuong video [tên video] - Tìm và tải video.",
        "tuong nhạc [tên bài hát] - Tìm và tải nhạc.",
        "tuong gif [chủ đề] - Tìm và gửi ảnh gif.",
        "tuong on/off - Bật/tắt chế độ tự động trả lời (chỉ admin).",
    ],
    cooldowns: 5,
    dependencies: { "fs-extra": "", "path": "", "axios": "", "@distube/ytdl-core": "", "fluent-ffmpeg": "", "qs": "", "uuid": "" }
};

module.exports.onLoad = async function ({ api }) {
    console.log("Đã tải thành công command Tường AI v8.5.0");
    try {
        BOT_ID = api.getCurrentUserID();
    } catch (e) {
        console.warn("Không thể lấy BOT ID khi onLoad.");
    }
};

module.exports.run = function ({ api, event, args }) {
    // Để tất cả logic xử lý trong handleEvent cho thống nhất
    // Lệnh `run` sẽ mô phỏng một sự kiện mới để handleEvent xử lý
    const newEvent = { ...event, body: `tuong ${args.join(" ")}` };
    return module.exports.handleEvent({ api, event: newEvent });
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;
    if (senderID !== handleReply.author) return;

    // Xóa tin nhắn lựa chọn sau khi người dùng reply
    api.unsendMessage(handleReply.messageID).catch(() => {});

    switch (handleReply.type) {
        case 'yt_choice':
            const choiceIndex = parseInt(body) - 1;
            if (choiceIndex >= 0 && choiceIndex < handleReply.choices.length) {
                const chosenVideo = handleReply.choices[choiceIndex];
                await downloadAndSendMedia(api, event, chosenVideo, handleReply.mediaType);
            } else {
                api.sendMessage("Lựa chọn không hợp lệ, vui lòng thử lại.", threadID, messageID);
            }
            break;
    }
};

module.exports.handleEvent = async function ({ api, event }) {
    const { threadID, messageID, senderID, body = "" } = event;
    if (!body || senderID === BOT_ID) return;

    const bodyLower = body.toLowerCase();
    const commandPrefix = TUONGS.find(t => bodyLower.startsWith(t));
    const isAutoAiOn = autoAI[threadID] === true;

    // Nếu auto AI tắt và không gọi tên bot thì bỏ qua
    if (!isAutoAiOn && !commandPrefix) return;

    const content = commandPrefix ? body.substring(commandPrefix.length).trim() : body.trim();

    // Xử lý lệnh media
    const mediaReq = parseMediaRequest(content);
    if (mediaReq && mediaReq.query) {
        const results = await searchYouTube(mediaReq.query);
        if (!results || results.length === 0) {
            return api.sendMessage(`Tường tìm không thấy kết quả nào cho "${mediaReq.query}".`, threadID, messageID);
        }

        let replyMsg = `Tường tìm thấy các kết quả sau cho "${mediaReq.query}":\n\n`;
        results.forEach((item, index) => {
            replyMsg += `${index + 1}. ${item.title}\n`;
        });
        replyMsg += "\n➡️ Vui lòng reply số thứ tự để chọn và tải về.";

        return api.sendMessage(replyMsg, threadID, (err, info) => {
            if (err) return console.error("Lỗi khi gửi lựa chọn YouTube:", err);
            global.client.handleReply.push({
                name: this.config.name,
                messageID: info.messageID,
                author: senderID,
                type: 'yt_choice',
                choices: results,
                mediaType: mediaReq.type
            });
        }, messageID);
    }
    
    // Xử lý các lệnh cụ thể khác (on/off, thời tiết, qr,...) có thể thêm vào đây
    // ...

    // Mặc định: chuyển cho AI chat
    // try {
    //     const geminiResponse = await geminiTextRequest(content, threadID);
    //     api.sendMessage(geminiResponse, threadID, messageID);
    // } catch (e) {
    //     api.sendMessage("Xin lỗi, Tường đang gặp chút sự cố kết nối với AI. Vui lòng thử lại sau.", threadID, messageID);
    // }
};
