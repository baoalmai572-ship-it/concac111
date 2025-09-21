const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage, registerFont } = require("canvas");
const moment = require("moment-timezone");

// --- ĐƯỜỜNG DẪN DÙNG CHUNG ---
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json');
const turnsFilePath = path.join(__dirname, "payment", "bank_user_turns.json");
const vohanFilePath = path.join(__dirname, "payment", "tinhdiem_vohan.json");
// Thêm đường dẫn đến file vohan_box.json
const vohanBoxFilePath = path.join(__dirname, "payment", "vohan_box.json");

// Đảm bảo các file dữ liệu tồn tại
fs.ensureFileSync(turnsFilePath);
fs.ensureFileSync(vohanFilePath);
fs.ensureFileSync(vohanBoxFilePath); // Đảm bảo file mới cũng tồn tại

const LAYOUT_ROOT = path.join(__dirname, "data", "FREEFIRE", "Lineup");

let cache = {};

const posMap = {
  t: "Tanker",
  s: "Sniper",
  b: "Bomber",
  sp: "Supports",
  r: "Rifler",
  c: "Coach",
};

function readJSONSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (err) {
      let msg = `Lỗi parse JSON: ${path.basename(filePath)}\n${err.message}`;
      throw new Error(msg);
    }
  } catch (e) {
    throw new Error(`Không thể đọc file JSON: ${filePath}\n${e.message}`);
  }
}

function drawText(ctx, text, cfg) {
  if (!text || !cfg) return;
  const weight = cfg.bold ? "bold" : "normal";
  const style = cfg.italic ? "italic" : "normal";
  const fontSize = cfg.size || 32;
  const fontFamily = cfg.font || "Arial";

  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = cfg.color || "#FFFFFF";
  ctx.textAlign = cfg.align || "left";
  ctx.textBaseline = "top";

  const lines = String(text).split("\n");
  const lineHeight = cfg.lineHeight || fontSize;

  ctx.save();
  if (cfg.rotate) {
    ctx.translate(cfg.x, cfg.y);
    ctx.rotate((cfg.rotate * Math.PI) / 180);
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, i * lineHeight);
    });
  } else {
    lines.forEach((line, i) => {
      ctx.fillText(line, cfg.x, cfg.y + i * lineHeight);
    });
  }
  ctx.restore();
}
 
function drawImageRotated(ctx, img, x, y, w, h, rotate = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
 
const API_KEYS = [
  "eqyYioAV9gRxRq4UHuoUqCeA", "gjxFfEicdq51h7ogoqWKfTpY", "2YVqySEhaeRwnTEsDX4pjDNx",
  "XFCvZYUJqoRmY9UdmrBr5siS", "JpDZB34DUULhD4oMo3d7oFZG", "VrJX2mS4PoT4Sqf16ZSUMHa8",
  "K1VF347LdTY3RgHHEgbrEaY6", "U9riSWLTNnAKxkatp1mh9viX", "ovGqHVLg2b7urSzN9BwZ895N",
  "1QHhzGaPPjb84kJUfcueyBKM", "UdN1nnFzaWRiRtbq6jqtbuFe",
];
let currentKeyIndex = 0;

async function removeBackground(imageUrl) {
  if (!API_KEYS || API_KEYS.length === 0) throw new Error("Chưa cấu hình API key nào cho remove.bg!");
  let lastErr = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[currentKeyIndex];
    try {
      const response = await axios({
        method: "post",
        url: "https://api.remove.bg/v1.0/removebg",
        data: { image_url: imageUrl, size: "auto" },
        headers: { "X-Api-Key": key },
        responseType: "arraybuffer",
        timeout: 30000,
      }); 
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      return response.data;  
    } catch (err) {
      console.warn(`❌ Key lỗi: ${key} → thử key khác...`);
      lastErr = err;
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    }
  }
  throw lastErr || new Error("Tất cả API key remove.bg đều lỗi!");
}
 
async function tryRemoveBgOrNull(imageUrl) {
  try {
    const buf = await removeBackground(imageUrl);
    return buf;
  } catch (e) {
    console.warn("⚠️ Không xoá được nền, dùng ảnh gốc. Lý do:", e?.message || e);
    return null;
  }
}

async function drawLineup(state) {
  const layoutPath = path.join(LAYOUT_ROOT, state.layoutName);
  const cfgPath = path.join(layoutPath, `layout-${state.num}.json`);
  const layoutConfig = readJSONSafe(cfgPath);

  let bgCandidates = [];
  const extensions = ['.png', '.jpg', '.jpeg'];

  if (state.useAvatar) {
    extensions.forEach(ext => {
        bgCandidates.push(path.join(layoutPath, `nhanvat-${state.num}${ext}`));
    });
  }

  extensions.forEach(ext => {
      bgCandidates.push(path.join(layoutPath, `${state.num}${ext}`));
  });

  const bgPath = bgCandidates.find(p => fs.existsSync(p));
  
  if (!bgPath) {
    const missingFiles = state.useAvatar 
      ? `nhanvat-${state.num}.png/jpg hoặc ${state.num}.png/jpg`
      : `${state.num}.png/jpg`;
    throw new Error(`Không tìm thấy background phù hợp cho ${state.num} người trong layout "${state.layoutName}".\nVui lòng kiểm tra lại sự tồn tại của file: ${missingFiles}`);
  }

  const bg = await loadImage(bgPath);
  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(bg, 0, 0, bg.width, bg.height);
 
  if (layoutConfig.tengiai) {
    drawText(ctx, state.tengiai, layoutConfig.tengiai);
  }
 
  if (layoutConfig.tenteam) {
    drawText(ctx, state.team, layoutConfig.tenteam);
  }
 
  if (state.logo && layoutConfig.logo) {
    try {
      const logoBuf = await tryRemoveBgOrNull(state.logo);
      const logoImg = await loadImage(logoBuf || state.logo);
      drawImageRotated(
        ctx,
        logoImg,
        layoutConfig.logo.x,
        layoutConfig.logo.y,
        layoutConfig.logo.w,
        layoutConfig.logo.h,
        layoutConfig.logo.rotate || 0
      );
    } catch (e) {
      console.error("Lỗi load/xoá nền logo:", e?.message || e);
    }
  }
 
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    const conf = layoutConfig.thanhvien?.[i];
    if (!conf) continue;
 
    if (conf.name) drawText(ctx, player.name, conf.name);
 
    if (conf.pos && player.pos) { 
      const fullPos = posMap[player.pos.toLowerCase()] || player.pos || "";
      drawText(ctx, fullPos, conf.pos);
    }
 
    if (state.logo && conf.logo) {
      try {
        const logoBuf = await tryRemoveBgOrNull(state.logo);
        const logoImg = await loadImage(logoBuf || state.logo);
        drawImageRotated(
          ctx,
          logoImg,
          conf.logo.x,
          conf.logo.y,
          conf.logo.w,
          conf.logo.h,
          conf.logo.rotate || 0
        );
      } catch (e) { console.error(`Lỗi logo thành viên #${i + 1}:`, e?.message || e); }
    }
 
    if (player.avatar && conf.avatar) {
      try {
        const avaBuf = await tryRemoveBgOrNull(player.avatar);
        const avaImg = await loadImage(avaBuf || player.avatar);
        drawImageRotated(
          ctx,
          avaImg,
          conf.avatar.x,
          conf.avatar.y,
          conf.avatar.w,
          conf.avatar.h,
          conf.avatar.rotate || 0
        );
      } catch (e) { console.error(`Lỗi avatar thành viên #${i + 1}:`, e?.message || e); }
    }
  }

  return canvas.toBuffer("image/png");
}
 
module.exports.config = {
  name: "lineup",
  version: "1.7.0",
  hasPermssion: 0,
  credits: "Dev by LEGI STUDIO - ZanHau | Upgraded by Gemini",
  description: "Tạo lineup FreeFire (có trừ lượt, vô hạn user, vô hạn box)",
  commandCategory: "game",
  usages: "Sử dụng để tạo ảnh lineup đội",
  cooldowns: 5,
};

async function generateAndSendImage(api, event, state) {
    const { threadID, messageID, senderID } = event;
    let isFreeForUser = false; // Cờ xác định người dùng có được miễn phí không

    // --- BƯỚC 1: KIỂM TRA VOHANBOX (Ưu tiên cao nhất) ---
    try {
        const vohanBoxData = fs.readJsonSync(vohanBoxFilePath, { throws: false }) || {};
        const boxStatus = vohanBoxData[threadID];
        if (boxStatus && boxStatus.expiry) {
            const expiryDate = moment(boxStatus.expiry);
            if (moment().isBefore(expiryDate)) {
                if (boxStatus.scope === 'all') {
                    isFreeForUser = true;
                } else if (boxStatus.scope === 'admin') {
                    const threadInfo = await api.getThreadInfo(threadID);
                    if (threadInfo.adminIDs.some(admin => admin.id == senderID)) {
                        isFreeForUser = true;
                    }
                }
            } else {
                // Dọn dẹp box hết hạn
                delete vohanBoxData[threadID];
                fs.writeJsonSync(vohanBoxFilePath, vohanBoxData, { spaces: 2 });
            }
        }
    } catch (e) {
        console.error("[LINEUP] Lỗi khi kiểm tra file vohan_box:", e);
    }

    // --- BƯỚC 2: KIỂM TRA VOHAN CÁ NHÂN (Nếu box không miễn phí) ---
    if (!isFreeForUser) {
        try {
            const vohanData = fs.readJsonSync(vohanFilePath, { throws: false }) || {};
            const userExpiry = vohanData[senderID];
            if (userExpiry) {
                if (moment().isBefore(moment(userExpiry))) {
                    isFreeForUser = true;
                } else {
                    // Dọn dẹp user hết hạn
                    delete vohanData[senderID];
                    fs.writeJsonSync(vohanFilePath, vohanData, { spaces: 2 });
                }
            }
        } catch (e) {
            console.error("[LINEUP] Lỗi khi kiểm tra file vô hạn cá nhân:", e);
        }
    }
    
    // --- BƯỚC 3: KIỂM TRA LƯỢT (Nếu không có quyền miễn phí nào) ---
    if (!isFreeForUser) {
        try {
            const turnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
            const userTurns = turnsData[senderID] || 0;
            if (userTurns <= 0) {
                return api.sendMessage(`🚫 Bạn đã hết lượt sử dụng lệnh này.\nVui lòng nạp thêm lượt để tiếp tục!`, threadID, messageID);
            }
        } catch (e) {
            console.error("[LINEUP] Lỗi khi đọc file lượt:", e);
            return api.sendMessage("❌ Đã có lỗi xảy ra với hệ thống lượt, vui lòng thử lại sau.", threadID, messageID);
        }
    }

    // --- BƯỚC 4: TẠO ẢNH VÀ GỬI ---
    api.sendMessage("⏳ Đang dựng ảnh, vui lòng chờ...", threadID, async (err, info) => {
        if (err) return;
        try {
            const outPath = path.join(__dirname, "cache", `lineup_${Date.now()}.png`);
            fs.ensureDirSync(path.dirname(outPath));

            const buffer = await drawLineup(state);
            fs.writeFileSync(outPath, buffer);

            api.sendMessage({ attachment: fs.createReadStream(outPath) }, threadID, async (err, sentInfo) => {
                if (err) {
                    console.error("[LINEUP] Lỗi khi gửi ảnh:", err);
                    try { fs.unlinkSync(outPath); } catch {}
                    return;
                }
                
                // --- BƯỚC 5: TRỪ LƯỢT VÀ ĐỔI BIỆT DANH (Chỉ khi không được miễn phí) ---
                if (!isFreeForUser) {
                    try {
                        const currentTurnsData = fs.readJsonSync(turnsFilePath, { throws: false }) || {};
                        const currentUserTurns = currentTurnsData[senderID] || 0;
                        if (currentUserTurns > 0) {
                            const newTurns = currentUserTurns - 1;
                            currentTurnsData[senderID] = newTurns;
                            fs.writeJsonSync(turnsFilePath, currentTurnsData, { spaces: 2 });
                            
                            const userInfo = await api.getUserInfo(senderID);
                            const userName = userInfo[senderID]?.name || "Người dùng";
                            const newNickname = `${userName} | ${newTurns} lượt`;
                            
                            api.changeNickname(newNickname, threadID, senderID, (nickErr) => {
                               if (nickErr) console.log(`[LINEUP] Không thể đổi biệt danh cho ${senderID}:`, nickErr.errorDescription);
                            });
                        }
                    } catch (e) {
                        console.error("[LINEUP] Lỗi khi trừ lượt hoặc đổi biệt danh:", e);
                    }
                }
                
                try { fs.unlinkSync(outPath); } catch {}
            }, messageID);
        } catch (e) {
            api.sendMessage("❌ Lỗi khi dựng ảnh lineup: " + (e?.message || e), threadID, messageID);
        } finally {
            delete cache[senderID];
        }
    });
}
 
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try { 
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {}; 
      const threadLimit = limitData[threadID]; 
      if (threadLimit && threadLimit.game === false) { 
          return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID); 
      } 
  } catch (e) { 
      console.log("Lỗi khi đọc file limit.json trong lệnh lineup:", e); 
  }
 
  if (!fs.existsSync(LAYOUT_ROOT)) {
    return api.sendMessage("⚠️ Thư mục `data/FREEFIRE/Lineup` không tồn tại. Vui lòng tạo thư mục và thêm layout.", threadID, messageID);
  }

  const layouts = fs.readdirSync(LAYOUT_ROOT).filter(f =>
    fs.statSync(path.join(LAYOUT_ROOT, f)).isDirectory()
  );

  if (layouts.length === 0) {
    return api.sendMessage("⚠️ Không có layout nào trong thư mục `Lineup`.", threadID, messageID);
  }

  let msg = "🤖 SCORING LINEUP BOT 🤖\n\nChọn Layout LineUp Bạn Muốn\n━━━━━━━━━━━━━━━━━━━━\n";
  layouts.forEach((name, i) => {
    msg += `${i + 1}. ${name}\n`;
  });
  msg += "━━━━━━━━━━━━━━━━━━━━\n\nReply tin nhắn này bằng số thứ tự để chọn layout.";

  cache[senderID] = { step: "layout" };

  api.sendMessage(msg, threadID, (err, info) => {
    if (err) return;
    global.client.handleReply.push({
      name: module.exports.config.name,
      messageID: info.messageID,
      author: senderID,
      type: "layout",
      layouts,
    });
  }, messageID);
};
 
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;
  
  try { 
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {}; 
      const threadLimit = limitData[threadID]; 
      if (threadLimit && threadLimit.game === false) return; 
  } catch (e) { /* Lỗi thì bỏ qua */ }
  
  if (senderID !== handleReply.author) return;

  const state = cache[senderID];
  if (!state) return;

  const sendStep = (msg, type, extra = {}) => {
    api.sendMessage(msg, threadID, (err, info) => {
      if (err) return;
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        type,
        ...extra,
      });
    }, messageID);
  };

  try {
    switch (handleReply.type) { 
      case "layout": {
        const idx = parseInt(body.trim(), 10) - 1;
        const layoutName = handleReply.layouts[idx];
        if (!layoutName) return api.sendMessage("❌ Lựa chọn không hợp lệ. Vui lòng reply lại bằng một số.", threadID, messageID);

        state.layoutName = layoutName;
        const layoutPath = path.join(LAYOUT_ROOT, layoutName);
 
        const nums = ["4", "5", "6"];
        const available = nums.filter(n => {
          const hasBg = [".png", ".jpg", ".jpeg"].some(ext => 
            fs.existsSync(path.join(layoutPath, `${n}${ext}`)) || 
            fs.existsSync(path.join(layoutPath, `nhanvat-${n}${ext}`))
          );
          const hasCfg = fs.existsSync(path.join(layoutPath, `layout-${n}.json`));
          return hasBg && hasCfg;
        });

        if (available.length === 0) {
          return api.sendMessage("❌ Layout này không có file background và/hoặc file cấu hình phù hợp (ví dụ: `5.png` và `layout-5.json`).", threadID, messageID);
        }

        let msg = "🔹 Vui lòng chọn số lượng thành viên:\n\n";
        available.forEach(n => { msg += `→ ${n} thành viên\n`; });
        msg += "\nReply tin nhắn này bằng số lượng bạn muốn."

        sendStep(msg, "num", { available });
        break;
      }
 
      case "num": {
        const choice = body.trim();
        if (!handleReply.available.includes(choice)) {
          return api.sendMessage("❌ Số lượng thành viên không hợp lệ cho layout này.", threadID, messageID);
        }
        state.num = choice;
        sendStep("🔹 Vui lòng nhập tên giải đấu:", "tengiai");
        break;
      }
 
      case "tengiai": {
        state.tengiai = body.trim();
        sendStep("🔹 Vui lòng nhập tên đội của bạn:", "tenteam");
        break;
      }
 
      case "tenteam": {
        state.team = body.trim();
        sendStep("📷 Bạn có muốn thêm logo cho đội không? (Reply `có` hoặc `không`)", "askLogo");
        break;
      }
 
      case "askLogo": {
        const ans = body.toLowerCase().trim();
        if (ans === "có") {
          sendStep("📷 Vui lòng reply tin nhắn này bằng ảnh logo của đội.", "logo");
        } else {
          state.logo = null;
          sendStep("📷 Bạn có muốn thêm avatar cho các thành viên không? (Reply `có` hoặc `không`)", "askAvatar");
        }
        break;
      }
 
      case "logo": {
        if (!event.attachments || event.attachments.length === 0 || event.attachments[0].type !== 'photo') {
          return api.sendMessage("❌ Vui lòng reply bằng 1 ảnh logo.", threadID, messageID);
        }
        state.logo = event.attachments[0].url;
        sendStep("📷 Bạn có muốn thêm avatar cho các thành viên không? (Reply `có` hoặc `không`)", "askAvatar");
        break;
      }
 
      case "askAvatar": {
        const ans = body.toLowerCase().trim();
        state.useAvatar = (ans === "có");
        state.players = [];
        sendStep(`🔹 Vui lòng nhập tên của thành viên 1:`, "player", { idx: 1 });
        break;
      }

      case "player": {
        const idx = handleReply.idx;
        const name = body.trim();

        if (!name) {
          return api.sendMessage("❌ Tên thành viên không được để trống. Vui lòng nhập lại.", threadID, messageID);
        }

        state.players.push({ name, pos: null, avatar: null });

        if (state.useAvatar) {
          sendStep(`📷 Vui lòng reply ảnh avatar cho '${name}' hoặc nhập "không" để bỏ qua.`, "playerAvatar", { idx });
        } else {
          if (idx < parseInt(state.num, 10)) {
            sendStep(`🔹 Vui lòng nhập tên của thành viên ${idx + 1}:`, "player", { idx: idx + 1 });
          } else {
            await generateAndSendImage(api, event, state);
          }
        }
        break;
      }
 
      case "playerAvatar": {
        const idx = handleReply.idx;
        const sayNo = body.toLowerCase().trim() === "không";
        
        if (!sayNo && event.attachments?.length > 0 && event.attachments[0].type === 'photo') {
          state.players[idx - 1].avatar = event.attachments[0].url;
        }

        if (idx < parseInt(state.num, 10)) {
          sendStep(`🔹 Vui lòng nhập tên của thành viên ${idx + 1}:`, "player", { idx: idx + 1 });
        } else {
            await generateAndSendImage(api, event, state);
        }
        break;
      }
    }
  } catch (err) {
    console.error(err);
    api.sendMessage("❌ Đã xảy ra lỗi trong quá trình xử lý: " + (err?.message || err), threadID, messageID);
    delete cache[senderID];
  }
};
