const fs = require("fs");
const path = require("path");
const axios = require("axios");
// --- MỚI: Thêm fs-extra để đọc JSON an toàn hơn ---
const fse = require("fs-extra");

const LOGO_DIR = path.join(__dirname, "data", "FREEFIRE", "logokey");
const KEYS_FILE = path.join(__dirname, "data", "keys.json");
// --- MỚI: ĐƯỜNG DẪN FILE LIMIT ---
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');


function loadData() {
  if (!fs.existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  } catch (e) {
    console.error(e);
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

async function saveLogoLocal(url, keyName) {
  if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname) || ".png";

  const filePath = path.join(LOGO_DIR, `${keyName}${ext}`);

  const writer = fs.createWriteStream(filePath);
  const response = await axios.get(url, { responseType: "stream" });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

async function getAdminName(api, uid) {
  try {
    const info = await api.getUserInfo(uid);
    return info[uid]?.name || uid;
  } catch {
    return uid;
  }
}

function isAdminBot(id) {
  const admins = global.config.ADMINBOT || [];
  return admins.includes(id);
}

const BangThuong = { 
  1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "11", 12: "12", 13: "13", 14: "14", 15: "15", 16: "16", 17: "17", 18: "18", 19: "19", 20: "20",
  21: "21", 22: "22", 23: "23", 24: "24", 25: "25", 26: "26", 27: "27", 28: "28", 29: "29", 30: "30",
  31: "31", 32: "32", 33: "33", 34: "34", 35: "35", 36: "36",
  B13: "b13", B31: "b31", B32: "b32", B33: "b33"
};

const DocQuyen = { 
  LG1: "lg1", PHONG1: "phong1", LG3: "lg3", LG4: "lg4", LG5: "lg5",
  LG6: "lg6", LG7: "lg7", LG8: "lg8", LG9: "lg9", LG10: "lg10", LG11: "lg11"
};

module.exports.config = {
  name: "key",
  version: "1.0.1",
  hasPermssion: 0,
  credits: "Văn Hậu (Nhok) | Tích hợp Limit by Gemini",
  description: "Quản lý key tính điểm (tích hợp limit).",
  commandCategory: "game",
  usages: `[tao|edit|info|addctv|addadmin|delete]`,
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  // --- MỚI: KIỂM TRA HỆ THỐNG LIMIT ---
  try {
      const limitData = fse.readJsonSync(limitPath, { throws: false }) || {};
      const threadLimit = limitData[event.threadID];
      if (threadLimit && threadLimit.game === false) {
          return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", event.threadID, event.messageID);
      }
  } catch (e) {
      console.log("Lỗi khi đọc file limit.json trong lệnh key:", e);
  }
  // --- KẾT THÚC KIỂM TRA ---

  let data = loadData();
  const senderID = event.senderID;
  const [subcmd, ...params] = args;
  const modName = module.exports.config.name;

  function isAdminKey(keyName, userID) {
    if (!data[keyName]) return false;
    return (data[keyName].admins || []).includes(userID);
  }

  const subCommand = subcmd?.toLowerCase();

  switch (subCommand) {
    case "tao":
    case "create": {    
      let keyName = params[0];
      if (!keyName) return api.sendMessage("📛 Vui lòng nhập tên key muốn tạo!", event.threadID);
    
      if (!/^[a-zA-Z0-9]+$/.test(keyName)) {    
        return api.sendMessage("📛 Tên key chỉ được chứa chữ và số, không có ký tự đặc biệt!", event.threadID);
      }
      if (keyName.length > 7) {
        return api.sendMessage("📛 Tên key không được dài quá 7 ký tự!", event.threadID);
      }

      if (data[keyName]) return api.sendMessage("📛 Key đã tồn tại!", event.threadID);

      data[keyName] = {
        ct: "FREE FIRE VN",
        ct2: "FREE FIRE VN",
        idbang: "1", 
        logo: "C:\\Users\\Administrator\\Desktop\\LEGIBOT\\modules\\data\\logo\\default.png",
        admins: [senderID],
        ctvs: [],
      };
      saveData(data);
      return api.sendMessage(`✅Đã tạo thành công: ${keyName} Bạn là admin key này!\n\n💬 Sử dụng .key edit để chỉnh sửa key của bạn.`, event.threadID);
    }

    case "info": {
      let userKeys = Object.entries(data).filter(
        ([, v]) => (v.admins || []).includes(senderID) || (v.ctvs || []).includes(senderID)
      );

      if (userKeys.length === 0) {
        return api.sendMessage("📛 Bạn chưa có key nào.", event.threadID);
      }

      async function getName(uid) {
        try {
          const info = await api.getUserInfo(uid);
          return info[uid]?.name || uid;
        } catch {
          return uid;
        }
      }

      const page = 1;
      const limit = 10;
      const totalPages = Math.ceil(userKeys.length / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const sliceKeys = userKeys.slice(start, end);

      let msg = `📋 Danh Sách Key Của Bạn (Page ${page}/${totalPages}) 📋\n\n`;
      let i = start;
      for (const [keyName, val] of sliceKeys) {
        let adminNames = [];
        for (const adminId of (val.admins || [])) {
          let name = await getName(adminId);
          adminNames.push(name);
        }

        let ctvNames = [];
        for (const ctvId of (val.ctvs || [])) {
          let name = await getName(ctvId);
          ctvNames.push(name);
        }

        msg += `------------------------------------\n${++i}. 🔖Tên Key: ${keyName}\n` +
               `✅ Tên Custom\n🔹 ${val.ct || "Chưa có"}\n` +
               `✅ Tên Custom Viết Tắt\n🔹 ${val.ct2 || "Chưa có"}\n` +
               `✅ ID Bảng Điểm\n🔹 ${val.idbang || "Chưa có"}\n\n` +
               `🛡 Admins: ${adminNames.length > 0 ? adminNames.join(", ") : "Chưa có"}\n` +
               `👤 CTVs: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Chưa có"}\n`;
      }
      msg += `\n➡️ Reply: page {số} để chuyển trang.`;

      return api.sendMessage(msg, event.threadID, (err, info) => {
        if (err) console.error(err);
        global.client.handleReply.push({
          name: modName,
          step: "page_info",
          messageID: info.messageID,
          author: senderID,
          keys: userKeys
        });
      }, event.messageID);
    }

    case "edit": {
      let keyName = params[0];
      if (!keyName) return api.sendMessage("🗨 Vui lòng nhập tên key cần sửa!", event.threadID);
      if (!data[keyName]) return api.sendMessage("📛 Key không tồn tại!", event.threadID);
      if (!isAdminBot(senderID) && !isAdminKey(keyName, senderID))
        return api.sendMessage("⚠ Bạn không có quyền sửa key này!", event.threadID);

      return api.sendMessage(
        `🔧 CHỈNH SỬA KEY: ${keyName}\n\nChọn thông tin muốn sửa\n1. Tên Custom\n2. Tên Viết Tắt\n3. ID Bảng Điểm [1-36]\n4. Logo Custom\n5. Sửa tất cả\n\nReply tin nhắn bằng số tương ứng để chỉnh sửa`,
        event.threadID,
        (error, info) => {
          global.client.handleReply.push({
            step: 1,
            name: modName,
            messageID: info.messageID,
            author: senderID,
            keyName,
          });
        }
      );
    }

    case "addctv": {
      let keyName = params[0];
      if (!keyName) return api.sendMessage("📛 Vui lòng nhập key!", event.threadID);

      let uid;
      if (event.messageReply) {
        uid = event.messageReply.senderID;
      } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        uid = Object.keys(event.mentions)[0];
      } else {
        return api.sendMessage("Vui lòng tag hoặc reply người cần thêm làm cộng tác viên!", event.threadID);
      }

      if (!data[keyName]) return api.sendMessage("📛 Key không tồn tại!", event.threadID);
      if (!isAdminBot(senderID) && !isAdminKey(keyName, senderID))
        return api.sendMessage("⚠ Bạn không có quyền thêm cộng tác viên cho key này!", event.threadID);
      if (data[keyName].ctvs.includes(uid)) return api.sendMessage("🔹Người này đã là cộng tác viên rồi!", event.threadID);

      data[keyName].ctvs.push(uid);
      saveData(data);
      return api.sendMessage(`✅Đã thêm cộng tác viên ${uid} cho key ${keyName}`, event.threadID);
    }
      
    // ===================================================================== //
    // ======================== PHẦN MỚI ĐƯỢC THÊM ======================== //
    case "addadmin": {
        // Chỉ Admin Bot mới được dùng lệnh này
        if (!isAdminBot(senderID)) {
            return api.sendMessage("💢 Lệnh này chỉ dành cho Admin Bot!", event.threadID);
        }

        const keyName = params[0];
        if (!keyName) {
            return api.sendMessage("📛 Vui lòng nhập tên key!", event.threadID);
        }

        if (!data[keyName]) {
            return api.sendMessage("📛 Key không tồn tại!", event.threadID);
        }

        let uid;
        if (event.messageReply) {
            uid = event.messageReply.senderID;
        } else if (event.mentions && Object.keys(event.mentions).length > 0) {
            uid = Object.keys(event.mentions)[0];
        } else {
            return api.sendMessage("⚠️ Vui lòng reply hoặc tag người bạn muốn thêm làm admin key!", event.threadID);
        }
        
        uid = uid.toString().replace(/[^0-9]/g, "");

        if (data[keyName].admins.includes(uid)) {
            return api.sendMessage("🔹 Người này đã là admin của key này rồi!", event.threadID);
        }

        data[keyName].admins.push(uid);
        saveData(data);
        
        const targetName = await getAdminName(api, uid);
        return api.sendMessage(`✅ Đã thêm "${targetName}" (ID: ${uid}) làm admin cho key '${keyName}'.`, event.threadID);
    }
    // ====================== KẾT THÚC PHẦN THÊM MỚI ====================== //
    // ===================================================================== //

    case "list": {
      if (!isAdminBot(senderID)) {
        return api.sendMessage("💢Bạn không phải admin bot!", event.threadID);
      }

      async function getName(uid) {
        try {
          const info = await api.getUserInfo(uid);
          return info[uid]?.name || uid;
        } catch {
          return uid;
        }
      }

      let keys = Object.entries(data);
      if (keys.length === 0) {
        return api.sendMessage("❌Không có key nào!", event.threadID);
      }

      const page = 1;
      const limit = 10;
      const totalPages = Math.ceil(keys.length / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const sliceKeys = keys.slice(start, end);

      let msg = `📋 Danh Sách Tất Cả Key (Page ${page}/${totalPages}) 📋\n\n`;
      let index = start;
      for (const [keyName, val] of sliceKeys) {
        let adminNames = [];
        for (const adminId of (val.admins || [])) {
          let name = await getName(adminId);
          adminNames.push(name);
        }

        let ctvNames = [];
        for (const ctvId of (val.ctvs || [])) {
          let name = await getName(ctvId);
          ctvNames.push(name);
        }

        msg += `------------------------------------\n${++index}. 🔖Tên Key: ${keyName}\n` +
               `✅ Tên Custom\n🔹 ${val.ct || "Chưa có"}\n` +
               `✅ Tên Custom Viết Tắt\n🔹 ${val.ct2 || "Chưa có"}\n` +
               `✅ ID Bảng Điểm\n🔹 ${val.idbang || "Chưa có"}\n` +
               `🛡 Admins: ${adminNames.length > 0 ? adminNames.join(", ") : "Chưa có"}\n` +
               `👤 CTVs: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Chưa có"}\n`;
      }
      msg += `\n➡️ Reply: page {số} để chuyển trang.`;

      return api.sendMessage(msg, event.threadID, (err, info) => {
        if (err) console.error(err);
        global.client.handleReply.push({
          name: modName,
          step: "page_list",
          messageID: info.messageID,
          author: senderID,
          keys
        });
      });
    }

    case "add": {
      if (!isAdminBot(senderID))
        return api.sendMessage("💢Bạn không phải admin bot!", event.threadID);
    
      let keyName = params[0];
      let role = params[1];
      if (!keyName || !role)
        return api.sendMessage("🔹Thiếu tham số key hoặc role!", event.threadID);
      if (!data[keyName])
        return api.sendMessage("📛Key không tồn tại!", event.threadID);
      if (role !== "admin" && role !== "ctv")
        return api.sendMessage("🔹Role phải là admin hoặc ctv", event.threadID);
    
      let uid;
      if (event.messageReply) {
        uid = event.messageReply.senderID;
      } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        uid = Object.keys(event.mentions)[0];
      } else {
        return api.sendMessage("⚠️ Vui lòng reply hoặc tag người cần thêm!", event.threadID);
      }
   
      uid = uid.toString().replace(/[^0-9]/g, "");
    
      if (role === "admin" && !data[keyName].admins.includes(uid))
        data[keyName].admins.push(uid);
      if (role === "ctv" && !data[keyName].ctvs.includes(uid))
        data[keyName].ctvs.push(uid);
    
      saveData(data);
      return api.sendMessage(`✅ Đã thêm ${role} ${uid} cho key ${keyName}`, event.threadID);
    }

    case "remove": {
      if (!isAdminBot(senderID))
        return api.sendMessage("💢Bạn không phải admin bot!", event.threadID);
    
      let keyName = params[0];
      let role = params[1];
      if (!keyName || !role)
        return api.sendMessage("🔹Thiếu tham số key hoặc role!", event.threadID);
      if (!data[keyName])
        return api.sendMessage("📛Key không tồn tại!", event.threadID);
      if (role !== "admin" && role !== "ctv")
        return api.sendMessage("🔹Role phải là admin hoặc ctv", event.threadID);
    
      let uid;
      if (event.messageReply) {
        uid = event.messageReply.senderID;
      } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        uid = Object.keys(event.mentions)[0];
      } else {
        return api.sendMessage("⚠️ Vui lòng reply hoặc tag người cần xóa!", event.threadID);
      }
    
      uid = uid.toString().replace(/[^0-9]/g, "");
    
      if (role === "admin")
        data[keyName].admins = data[keyName].admins.filter(i => i !== uid);
      if (role === "ctv")
        data[keyName].ctvs = data[keyName].ctvs.filter(i => i !== uid);
    
      saveData(data);
      return api.sendMessage(`🗑 Đã xóa ${role} ${uid} khỏi key ${keyName}`, event.threadID);
    }
    case "delete": {
      let keyName = params[0];
      if (!keyName) return api.sendMessage("🔹Vui lòng nhập tên key muốn xóa!", event.threadID);
      if (!data[keyName]) return api.sendMessage("📛Key không tồn tại!", event.threadID);
      if (!isAdminBot(senderID) && !isAdminKey(keyName, senderID))
        return api.sendMessage("💢Bạn không có quyền xóa key này!", event.threadID);

      delete data[keyName];
      saveData(data);
      return api.sendMessage(`🗑Đã xóa key: ${keyName}`, event.threadID);
    }

    default:
      return api.sendMessage("📌 Hướng Dẫn Dùng Lệnh\n\n.key tao [tên key] - Tạo key mới\n\n.key edit [key] - Chỉnh sửa key\n\n.key info - Xem danh sách key\n\n.key addctv [key] [tag|reply] - Thêm cộng tác viên\n\n.key addadmin [key] [tag|reply] - (Chỉ ADMINBOT) Thêm admin cho key", event.threadID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  // --- MỚI: KIỂM TRA HỆ THỐNG LIMIT ---
  try {
      const limitData = fse.readJsonSync(limitPath, { throws: false }) || {};
      const threadLimit = limitData[event.threadID];
      if (threadLimit && threadLimit.game === false) return;
  } catch (e) { /* Lỗi thì bỏ qua */ }
  // --- KẾT THÚC KIỂM TRA ---

  let data = loadData();
  const senderID = event.senderID;
  const modName = this.config.name;
  if (handleReply.step === "page_info" || handleReply.step === "page_list") {
    if (senderID !== handleReply.author) return;
    const match = event.body.trim().match(/^page\s+(\d+)$/i);
    if (!match) return;

    const page = parseInt(match[1]);
    const limit = 10;
    const keys = handleReply.keys;
    const totalPages = Math.ceil(keys.length / limit);
    if (page < 1 || page > totalPages) {
      return api.sendMessage(`❌ Trang không hợp lệ! Tổng số trang: ${totalPages}`, event.threadID);
    }

    async function getName(uid) {
      try {
        const info = await api.getUserInfo(uid);
        return info[uid]?.name || uid;
      } catch {
        return uid;
      }
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const sliceKeys = keys.slice(start, end);

    let msg = `📋 Danh Sách Key (Page ${page}/${totalPages}) 📋\n\n`;
    let index = start;
    for (const [keyName, val] of sliceKeys) {
      let adminNames = [];
      for (const adminId of (val.admins || [])) {
        let name = await getName(adminId);
        adminNames.push(name);
      }

      let ctvNames = [];
      for (const ctvId of (val.ctvs || [])) {
        let name = await getName(ctvId);
        ctvNames.push(name);
      }

      msg += `------------------------------------\n${++index}. 🔖Tên Key: ${keyName}\n` +
             `✅ Tên Custom\n🔹 ${val.ct || "Chưa có"}\n` +
             `✅ Tên Custom Viết Tắt\n🔹 ${val.ct2 || "Chưa có"}\n` +
             `✅ ID Bảng Điểm\n🔹 ${val.idbang || "Chưa có"}\n\n` +
             `🛡 Admins: ${adminNames.length > 0 ? adminNames.join(", ") : "Chưa có"}\n` +
             `👤 CTVs: ${ctvNames.length > 0 ? ctvNames.join(", ") : "Chưa có"}\n`;
    }
    msg += `\n➡️ Reply: page {số} để chuyển trang.`;

    return api.sendMessage(msg, event.threadID, (err, info) => {
      if (err) console.error(err);
      global.client.handleReply.push({
        name: modName,
        step: handleReply.step,
        messageID: info.messageID,
        author: senderID,
        keys
      });
    });
  }

  if (!handleReply || handleReply.name !== "key") return;
  if (senderID !== handleReply.author) return;

  let keyName = handleReply.keyName;
  if (!data[keyName]) return api.sendMessage("🔹Key không tồn tại hoặc đã bị xóa!", event.threadID);

  async function getAdminName(uid) {
    try {
      const info = await api.getUserInfo(uid);
      return info[uid]?.name || uid;
    } catch {
      return uid;
    }
  }

  switch (handleReply.step) {
    case 1: {
      let choose = (event.body || "").trim();
      if (!["1", "2", "3", "4", "5"].includes(choose)) {
        return api.sendMessage(
          "Vui lòng reply số từ 1 đến 5 để chọn thông tin chỉnh sửa.",
          event.threadID,
          (error, info) => {
            global.client.handleReply.push({
              step: 1,
              name: "key",
              messageID: info.messageID,
              author: senderID,
              keyName,
            });
          }
        );
      }

      if (choose === "5") {
        api.sendMessage("Nhập giá trị mới cho Tên Custom:", event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 2,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: "all_ct",
          });
        });
      } else if (choose === "4") {
        api.sendMessage("Vui lòng gửi ảnh logo (gửi trực tiếp hoặc reply ảnh) hoặc gửi link ảnh trực tiếp (phải có đuôi .png/.jpg/...).", event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 2,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: "logo",
          });
        });
      } else {
        const fields = { "1": { key: "ct", text: "Tên Custom" }, "2": { key: "ct2", text: "Tên Viết Tắt" }, "3": { key: "idbang", text: "ID Bảng Điểm [1-36]" } };
        let fieldObj = fields[choose];
        api.sendMessage(`Nhập giá trị mới cho ${fieldObj.text}:`, event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 2,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: fieldObj.key,
          });
        });
      }
      break;
    }

    case 2: {
      let { subStep } = handleReply;
      let newVal = (event.body || "").trim();

      if (!newVal && subStep !== "logo" && subStep !== "all_ct") return api.sendMessage("Giá trị không được để trống!", event.threadID);

      if (subStep === "all_ct") {
        data[keyName].ct = newVal;
        saveData(data);
        api.sendMessage("Nhập giá trị mới cho Tên Viết Tắt:", event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 3,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: "all_ct2",
          });
        });
      } else if (subStep === "logo") {
        let candidate = "";

        if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
          const attach = event.messageReply.attachments.find((a) => a.type === "photo" || a.type === "image");
          if (attach && attach.url) candidate = attach.url;
        }

        if (!candidate && event.attachments && event.attachments.length > 0) {
          const attach = event.attachments.find((a) => a.type === "photo" || a.type === "image");
          if (attach && attach.url) candidate = attach.url;
        }

        if (!candidate && newVal) {
          if (!isImageUrl(newVal)) {
            return api.sendMessage(
              "Logo phải là ảnh gửi trực tiếp hoặc link ảnh hợp lệ (có đuôi .png/.jpg/.jpeg/.gif/.webp/.bmp). Vui lòng gửi lại ảnh hoặc link.",
              event.threadID,
              (error, info) => {
                global.client.handleReply.push({
                  step: 2,
                  name: "key",
                  messageID: info.messageID,
                  author: senderID,
                  keyName,
                  subStep: "logo",
                });
              }
            );
          }
          candidate = newVal;
        }

        if (!candidate) return api.sendMessage("Không tìm thấy ảnh hoặc link hợp lệ. Vui lòng gửi lại ảnh hoặc link.", event.threadID);

try {
const filePath = await saveLogoLocal(candidate, keyName);
data[keyName].logo = filePath;
saveData(data);

  const adminName = await getAdminName(data[keyName].admins[0]);
  return api.sendMessage(
  {
    body: `✨ Cập Nhật Key Thành Công ✨\n\n✔ Logo Custom\n🔑 Key: ${keyName}\n🛡 Admin: ${adminName}`,
    attachment: fs.createReadStream(filePath)
  },
  event.threadID
);
} catch (e) {
  console.error(e);
  return api.sendMessage("Lỗi khi lưu logo local, vui lòng thử lại với ảnh khác.", event.threadID);
}
      } else if (subStep === "ct2") {
        data[keyName].ct2 = newVal;
        saveData(data);
        const adminName = await getAdminName(data[keyName].admins[0]);
        return api.sendMessage(
          `✨ Cập Nhật Key Thành Công ✨\n\n✔ Tên Custom Viết Tắt\n👉 ${newVal}\n🔑 Key: ${keyName}\n🛡 Admin: ${adminName}`,
          event.threadID
        );
      } else if (subStep === "idbang") {
        let newVal = (event.body || "").trim().toUpperCase();
  
        if (!/^[a-zA-Z0-9]+$/.test(newVal)) {
          return api.sendMessage("❗ ID Bảng không hợp lệ. Chỉ được chứa chữ và số.", event.threadID);
        }

        if (BangThuong[newVal]) {
          data[keyName].idbang = newVal.toLowerCase();
        } 
        else if (DocQuyen[newVal]) {
          if (!isAdminBot(senderID)) {
            return api.sendMessage("❗ Bảng độc quyền chỉ admin mới có thể chọn!", event.threadID);
          }
          data[keyName].idbang = newVal.toLowerCase();
        } 
        else {
          return api.sendMessage("❗ Không tồn tại bảng này. Hãy chọn bảng hợp lệ!", event.threadID);
        }
      
        saveData(data);
        const adminName = await getAdminName(data[keyName].admins[0]);
        return api.sendMessage(
          `✨ Cập Nhật Key Thành Công ✨\n\n✔ ID Bảng Điểm\n👉 ${data[keyName].idbang}\n🔑 Key: ${keyName}\n🛡 Admin: ${adminName}`,
          event.threadID
        );
      } else if (subStep === "ct") {
        data[keyName].ct = newVal;
        saveData(data);
        const adminName = await getAdminName(data[keyName].admins[0]);
        return api.sendMessage(
          `✨ Cập Nhật Key Thành Công ✨\n\n✔ Tên Custom\n👉 ${newVal}\n🔑 Key: ${keyName}\n🛡 Admin: ${adminName}`,
          event.threadID
        );
      }

      break;
    }

    case 3: {
      let { subStep } = handleReply;
      let newVal = (event.body || "").trim();
      if (!newVal) return api.sendMessage("Giá trị không được để trống!", event.threadID);

      if (subStep === "all_ct2") {
        data[keyName].ct2 = newVal;
        saveData(data);
        api.sendMessage("Nhập giá trị mới cho ID Bảng Điểm [1-36]:", event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 4,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: "all_idbang",
          });
        });
      } else {
        return api.sendMessage("Lỗi không xác định trong quá trình sửa tất cả.", event.threadID);
      }
      break;
    }

    case 4: {
      let { subStep } = handleReply;
    
      if (subStep === "all_idbang") {
        let newVal = (event.body || "").trim().toUpperCase();
  
        if (!/^[a-zA-Z0-9]+$/.test(newVal)) {
          return api.sendMessage("❗ ID Bảng không hợp lệ. Chỉ được chứa chữ và số.", event.threadID);
        }

        if (BangThuong[newVal]) {
          data[keyName].idbang = newVal.toLowerCase();
        } 
        else if (DocQuyen[newVal]) {
          if (!isAdminBot(senderID)) {
            return api.sendMessage("❗ Bảng độc quyền chỉ admin mới có thể chọn!", event.threadID);
          }
          data[keyName].idbang = newVal.toLowerCase();
        } 
        else {
          return api.sendMessage("❗ Không tồn tại bảng này. Hãy chọn bảng hợp lệ!", event.threadID);
        }
    
        saveData(data);
        api.sendMessage("Vui lòng gửi ảnh logo (gửi trực tiếp hoặc reply ảnh) hoặc gửi link ảnh hợp lệ (có đuôi):", event.threadID, (error, info) => {
          global.client.handleReply.push({
            step: 5,
            name: "key",
            messageID: info.messageID,
            author: senderID,
            keyName,
            subStep: "all_logo",
          });
        });
      } else {
        return api.sendMessage("Lỗi không xác định trong quá trình sửa tất cả.", event.threadID);
      }
      break;
    }

    case 5: {
      let { subStep } = handleReply;
      let candidate = "";

      if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
        const attach = event.messageReply.attachments.find((a) => a.type === "photo" || a.type === "image");
        if (attach && attach.url) candidate = attach.url;
      }

      if (!candidate && event.attachments && event.attachments.length > 0) {
        const attach = event.attachments.find((a) => a.type === "photo" || a.type === "image");
        if (attach && attach.url) candidate = attach.url;
      }

      if (!candidate) {
        let newVal = (event.body || "").trim();
        if (!isImageUrl(newVal)) {
          return api.sendMessage(
            "Logo phải là ảnh gửi trực tiếp hoặc link ảnh hợp lệ (có đuôi .png/.jpg/.jpeg/.gif/.webp/.bmp). Vui lòng gửi lại ảnh.",
            event.threadID,
            (error, info) => {
              global.client.handleReply.push({
                step: 5,
                name: "key",
                messageID: info.messageID,
                author: senderID,
                keyName,
              });
            }
          );
        }
        candidate = newVal;
      }

try {
const filePath = await saveLogoLocal(candidate, keyName);
data[keyName].logo = filePath;
saveData(data);

  const adminName = await getAdminName(data[keyName].admins[0]);
  return api.sendMessage(
  {
    body: `✨ Cập Nhật Key Thành Công ✨\n\n✔ Tên Custom\n👉 ${data[keyName].ct}\n✔ Tên Custom Viết Tắt\n👉 ${data[keyName].ct2}\n✔ ID Bảng Điểm\n👉 ${data[keyName].idbang}\n✔ Logo Custom\n🔑 Key: ${keyName}\n🛡 Admin: ${adminName}`,
    attachment: fs.createReadStream(filePath)
  },
  event.threadID
);
} catch (e) {
  console.error(e);
  return api.sendMessage("Lỗi khi lưu logo local, vui lòng thử lại với ảnh khác.", event.threadID);
}
    }

    default:
      return api.sendMessage("Lỗi trong quá trình chỉnh sửa.", event.threadID);
  }
};
