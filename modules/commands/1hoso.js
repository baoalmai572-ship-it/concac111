const fs = require("fs-extra");
const path = require("path");
const downloader = require("image-downloader");
const axios = require("axios");

const DATA_ROOT = path.join(__dirname, "datateam");
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');

// --- START: CODE TÁCH NỀN (NÂNG CẤP THEO LOGIC SETKEY) ---
const REMOVEBG_API_KEYS = [
    'MRhAgWnTQEzyHp7VxNNWnns3',
    'DMd29c7BYcYtyn2tS4FdLRRF',
    '35LeBZZTDQbWuD8UseAbXgaG',
    '6hE4e3KV6FBxfgMPUwv3c7vi',
    'PNN9Utg9gmXjM7CMkzbU99ZF',
    '65NPNJpRg1qRec6JbfjmKKLC'
];

async function removeBackground(imageUrl) {
    // Trường hợp không có key nào được cung cấp
    if (!REMOVEBG_API_KEYS || REMOVEBG_API_KEYS.length === 0) {
        console.log("[HOSO-BG] Không có API key nào được cấu hình. Sử dụng ảnh gốc.");
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            return { buffer: response.data, success: false };
        } catch (e) {
            console.error("[HOSO-BG] Lỗi tải ảnh gốc:", e);
            return { buffer: null, success: false };
        }
    }

    // Lặp qua từng key để thử tách nền
    for (const key of REMOVEBG_API_KEYS) {
        try {
            const response = await axios.post(
                'https://api.remove.bg/v1.0/removebg', // <<< ĐÃ SỬA LỖI 404
                { image_url: imageUrl, size: 'auto' },
                {
                    headers: { 'X-Api-Key': key },
                    responseType: 'arraybuffer'
                }
            );
            console.log(`[HOSO-BG] Xóa nền thành công với key: ...${key.slice(-4)}`);
            // Trả về buffer ảnh đã tách nền và trạng thái thành công
            return { buffer: Buffer.from(response.data, 'binary'), success: true };
        } catch (error) {
            // Lỗi 402 hoặc 429 thường là do hết quota -> thử key tiếp theo
            if (error.response && (error.response.status === 402 || error.response.status === 429)) {
                console.warn(`[HOSO-BG] Key ...${key.slice(-4)} đã hết quota. Thử key tiếp theo.`);
            } else {
                // Các lỗi khác cũng sẽ thử key tiếp theo
                console.error(`[HOSO-BG] Lỗi với key ...${key.slice(-4)}:`, error.response?.data?.toString() || error.message);
            }
        }
    }

    // Nếu tất cả các key đều thất bại, tải và trả về ảnh gốc
    console.log("[HOSO-BG] Tất cả API key đều thất bại. Sử dụng ảnh gốc.");
    try {
        const originalImageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return { buffer: originalImageResponse.data, success: false };
    } catch (e) {
         console.error("[HOSO-BG] Lỗi tải ảnh gốc sau khi các key thất bại:", e);
         return { buffer: null, success: false };
    }
}
// --- END: CODE TÁCH NỀN ---


function getUserDir(uid) {
  return path.join(DATA_ROOT, uid.toString());
}

function getDataFile(uid) {
  return path.join(getUserDir(uid), "datateam.json");
}

function readData(uid) {
  const file = getDataFile(uid);
  if (!fs.existsSync(file)) return {};
  try {
    return fs.readJsonSync(file);
  } catch {
    return {};
  }
}

function writeData(uid, data) {
  const file = getDataFile(uid);
  fs.writeJsonSync(file, data, { spaces: 2 });
}

function maskID(id) {
  return id.slice(0, -2) + "**";
}

module.exports.config = {
  name: "hoso",
  version: "2.4", // Final version
  hasPermssion: 0,
  credits: "Dev by LEGI STUDIO - ZanHau | Tích hợp Limit/Tách nền by Gemini",
  description: "Thêm Hồ Sơ Tên Team or Logo Team (tự động tách nền).",
  commandCategory: "game",
  usages: "[add|list|info|remove|clear]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, messageReply, senderID } = event;

  try {
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
      const threadLimit = limitData[threadID];
      if (threadLimit && threadLimit.game === false) {
          return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID);
      }
  } catch (e) {
      console.log("Lỗi khi đọc file limit.json trong lệnh hoso:", e);
  }

  if (!args[0]) {
    return api.sendMessage(
      "Vui lòng sử dụng: add, list, info, remove, clear",
      threadID,
      messageID
    );
  }

  const uid = senderID;
  const userDir = getUserDir(uid);
  const dataFile = getDataFile(uid);
  if (!fs.existsSync(userDir)) fs.mkdirpSync(userDir);
  if (!fs.existsSync(dataFile)) writeData(uid, {});

  let data = readData(uid);

if (["add", "them", "tao"].includes(args[0].toLowerCase())) {
  let input = args.slice(1).join(" ").split("\n").map(i => i.trim());
  if (!input[0]) {
    return api.sendMessage(
      "Dùng add [Tên team], [ID1], [ID2]\nHoặc add nhiều dòng: [Tên team], [ID]",
      threadID,
      messageID
    );
  }

  const attachments = messageReply?.attachments || [];
  let updates = [];
  
  if (attachments.length > 0) {
      api.sendMessage("⏳ Đang xử lý và tách nền logo (nếu có)...", threadID);
  }

  for (let i = 0; i < input.length; i++) {
    let line = input[i];
    const parts = line.split(",").map(p => p.trim()).filter(Boolean);

    let teamName = "";
    let memberIDs = [];

    parts.forEach(p => {
      if (/^\d{8,20}$/.test(p)) {
        memberIDs.push(maskID(p));
      } else {
        if (!teamName) teamName = p.toUpperCase();
      }
    });

    if (!teamName) {
      updates.push("⚠️ Không xác định được tên team trong dòng: " + line);
      continue;
    }
    if (memberIDs.length > 8) {
      updates.push(`⚠️ Team ${teamName}: Tối đa 8 ID!`);
      continue;
    }

    let logoPath = null;
    let logoStatus = "Không";

    if (attachments[i]?.url) {
        const dest = path.join(userDir, `${Date.now()}_${teamName.replace(/\s/g, '_')}.png`);
        
        // Gọi hàm tách nền mới, nó sẽ trả về cả buffer và trạng thái thành công
        const { buffer: imageBuffer, success: bgRemoveSuccess } = await removeBackground(attachments[i].url);

        if (imageBuffer) { // Kiểm tra xem có buffer ảnh không (kể cả ảnh gốc)
            fs.writeFileSync(dest, imageBuffer);
            logoPath = dest;
            // Cập nhật trạng thái dựa trên việc tách nền có thành công hay không
            logoStatus = bgRemoveSuccess ? "Có (đã tách nền)" : "Có (ảnh gốc)";
        } else {
            // Trường hợp không tải được cả ảnh
            logoPath = null;
            logoStatus = "Lỗi tải ảnh";
        }
    }

    if (!data[teamName]) {
      data[teamName] = [{
        accountID: memberIDs,
        logo: logoPath
      }];

      updates.push(
        `✅ Đã Tạo Thành Công Hồ Sơ\n` +
        `⭐ Team⭐: ${teamName}\n` +
        `📋 ID: ${memberIDs.join(", ")}\n` +
        `🖼 Logo: ${logoStatus}`
      );
    } else {
      let team = data[teamName][0];
      team.accountID = Array.from(new Set([...team.accountID, ...memberIDs]));
      
      let updateLogoStatus = "Giữ nguyên";
      if (logoPath) {
        if (team.logo && fs.existsSync(team.logo)) fs.unlinkSync(team.logo);
        team.logo = logoPath;
        updateLogoStatus = logoStatus.replace('Có', 'Đã cập nhật');
      }
      
      data[teamName][0] = team;
      updates.push(
        `♻️ Đã Cập Nhật Hồ Sơ \n` +
        `⭐ Team: ${teamName}\n` +
        `📋 ID: ${memberIDs.length ? memberIDs.join(", ") : "Không thêm"}\n` +
        `🖼 Logo: ${updateLogoStatus}\n` +
        `👤 Tổng thành viên: ${team.accountID.length}`
      );
    }
  }
  writeData(uid, data);
  return api.sendMessage(updates.join("\n\n"), threadID, messageID);
}


  if (["remove", "rm", "delete", "del", "xoa"].includes(args[0].toLowerCase())) {
    let teamName = args.slice(1).join(" ").toUpperCase();
    if (!teamName) return api.sendMessage("Vui lòng nhập tên team cần xóa.", threadID, messageID);

    if (data[teamName]) {
      if (data[teamName][0].logo && fs.existsSync(data[teamName][0].logo)) {
        fs.unlinkSync(data[teamName][0].logo);
      }
      delete data[teamName];
      writeData(uid, data);
      return api.sendMessage(`🗑️ Đã xóa team ${teamName}`, threadID, messageID);
    } else {
      return api.sendMessage(`⚠️ Không tìm thấy team ${teamName}`, threadID, messageID);
    }
  }

  if (["list", "danhsach"].includes(args[0].toLowerCase())) {
    const keys = Object.keys(data);
    if (keys.length === 0) return api.sendMessage("📌 Hiện không có team nào.", threadID, messageID);

    const pageSize = 15;
    let page = parseInt(args[1]) || 1;
    let totalPage = Math.ceil(keys.length / pageSize);

    if (page < 1) page = 1;
    if (page > totalPage) page = totalPage;

    let start = (page - 1) * pageSize;
    let end = start + pageSize;
    let showKeys = keys.slice(start, end);

    let msg = `📋 Danh sách team (Trang ${page}/${totalPage}):\n`;
    showKeys.forEach((team, idx) => {
      msg += `${start + idx + 1}. ${team}, ${data[team][0].accountID.join(", ")}\n`;
    });
    msg += "\nReply del + stt để xóa, reply stt để xem info team.\n";
    msg += "Hoặc reply 'page [số]' (vd: page 2) để chuyển trang.";

    return api.sendMessage(msg, threadID, (err, info) => {
      global.client.handleReply.push({
        name: this.config.name,
        messageID: info.messageID,
        author: senderID,
        type: "list",
        data: keys,
        page,
        pageSize,
        totalPage
      });
    }, messageID);
  }

  if (["info", "thongtin"].includes(args[0].toLowerCase())) {
    let teamName = args.slice(1).join(" ").toUpperCase();
    if (!teamName) return api.sendMessage("Vui lòng nhập tên team.", threadID, messageID);

    if (!data[teamName]) return api.sendMessage(`⚠️ Không tìm thấy team ${teamName}`, threadID, messageID);

    let team = data[teamName][0];
    let msg = `📌 Thông tin team ${teamName}\n👥 Số lượng thành viên: ${team.accountID.length}`;

    if (team.logo && fs.existsSync(team.logo)) {
      return api.sendMessage({ body: msg, attachment: fs.createReadStream(team.logo) }, threadID, messageID);
    } else {
      msg += `\n🖼 Logo: Không có`;
      return api.sendMessage(msg, threadID, messageID);
    }
  }

  if (["clear", "xoaall"].includes(args[0].toLowerCase())) {
    fs.removeSync(userDir);
    return api.sendMessage("🗑️ Đã xóa toàn bộ dữ liệu team của bạn!", threadID, messageID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, body, senderID } = event;

  try {
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {};
      const threadLimit = limitData[threadID];
      if (threadLimit && threadLimit.game === false) return;
  } catch (e) { /* Lỗi thì bỏ qua */ }

  if (handleReply.type !== "list" || handleReply.author !== senderID) return;
  api.unsendMessage(handleReply.messageID).catch(() => {});

  const uid = senderID;
  let data = readData(uid);
  let input = body.trim().toLowerCase();

  const pageSize = handleReply.pageSize || 15;

  if (input.startsWith("page")) {
    let page = parseInt(input.replace("page", "").trim());
    if (isNaN(page) || page < 1 || page > handleReply.totalPage) {
      return api.sendMessage(`⚠️ Trang không hợp lệ! Có ${handleReply.totalPage} trang.`, threadID, messageID);
    }

    let start = (page - 1) * pageSize;
    let end = start + pageSize;
    let showKeys = handleReply.data.slice(start, end);

    let msg = `📋 Danh sách team (Trang ${page}/${handleReply.totalPage}):\n`;
    showKeys.forEach((team, idx) => {
      msg += `${start + idx + 1}. ${team}, ${data[team][0].accountID.join(", ")}\n`;
    });
    msg += "\nReply del + stt để xóa, reply stt để xem info team.\n";
    msg += "Hoặc reply \"page {số}\" để chuyển trang.";

    return api.sendMessage(msg, threadID, (err, info) => {
      global.client.handleReply.push({
        ...handleReply,
        messageID: info.messageID,
        page
      });
    }, messageID);
  }

  if (input.startsWith("del")) {
    let indices = input.replace("del", "").split(",").map(i => parseInt(i.trim())).filter(i => !isNaN(i));
    let deleted = [];
    let invalid = [];

    for (let i of indices) {
      let idx = i - 1;
      if (idx >= 0 && idx < handleReply.data.length) {
        let teamName = handleReply.data[idx];
        if (data[teamName]) {
          if (data[teamName][0].logo && fs.existsSync(data[teamName][0].logo)) {
            fs.unlinkSync(data[teamName][0].logo);
          }
          delete data[teamName];
          deleted.push(teamName);
        } else invalid.push(i);
      } else invalid.push(i);
    }

    writeData(uid, data);

    let msg = "";
    if (deleted.length) msg += "🗑️ Đã xóa: " + deleted.join(", ");
    if (invalid.length) msg += "\n⚠️ Không hợp lệ: " + invalid.join(", ");
    return api.sendMessage(msg, threadID, messageID);
  }

  let index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= handleReply.data.length) {
    if (/^\d+$/.test(input) && parseInt(input) <= handleReply.totalPage) {
        return;
    }
    return api.sendMessage("⚠️ Số thứ tự không hợp lệ!", threadID, messageID);
  }

  let teamName = handleReply.data[index];
  let team = data[teamName][0];
  let msg = `📌 Thông tin team ${teamName}\n👥 Thành viên: ${team.accountID.join(", ")}`;

  if (team.logo && fs.existsSync(team.logo)) {
    return api.sendMessage({ body: msg, attachment: fs.createReadStream(team.logo) }, threadID, messageID);
  } else {
    msg += `\n🖼 Logo: Không có`;
    return api.sendMessage(msg, threadID, messageID);
  }
};
