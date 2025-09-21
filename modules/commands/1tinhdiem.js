const moment = require("moment-timezone");
const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");

const FFRANK_PATH = path.join(__dirname, "ffrank");
const garenaApi = require(path.join(FFRANK_PATH, "api.js"));
const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dataRoot = path.join(__dirname, "data");
const fontsPath = path.join(dataRoot, "fonts");
const bxhRoot = path.join(dataRoot, "FREEFIRE");
const layoutsRoot = path.join(bxhRoot, "layouts");
const keysPath = path.join(dataRoot, "keys.json");
const limitPath = path.join(__dirname, '..', 'commands', 'cache', 'limit.json'); 

// --- THÊM ĐƯỜNG DẪN MỚI VÀ ĐẢM BẢO FILE TỒN TẠI ---
const turnsFilePath = path.join(__dirname, 'payment', 'bank_user_turns.json');
const vohanFilePath = path.join(__dirname, 'payment', 'tinhdiem_vohan.json');
const vohanBoxFilePath = path.join(__dirname, 'payment', 'vohan_box.json'); // Đường dẫn mới

fs.ensureDirSync(dataRoot);
fs.ensureDirSync(fontsPath);
fs.ensureDirSync(bxhRoot);
fs.ensureDirSync(layoutsRoot);

fs.ensureFileSync(turnsFilePath);
fs.ensureFileSync(vohanFilePath);
fs.ensureFileSync(vohanBoxFilePath); // Đảm bảo file mới tồn tại

fs.readdirSync(fontsPath).filter((f) => f.endsWith(".ttf") || f.endsWith(".otf")).forEach((f) => { const fontFile = path.join(fontsPath, f); const fontName = path.basename(f, path.extname(f)); try { registerFont(fontFile, { family: fontName }); console.log("✅ Loaded font:", fontName); } catch (err) { console.error("❌ Lỗi load font:", f, err.message); } });

const TIME_SLOTS = { 1: ["13:00", "15:00"], 2: ["15:00", "17:00"], 3: ["17:00", "19:00"], 4: ["20:00", "21:30"], 5: ["21:40", "23:00"], 6: ["23:30", "01:00"], 7: ["01:00", "03:00"], 8: ["10:00", "12:00"], };
const REPLY_NAME = "tinhdiem";

// --- Các hàm tiện ích (giữ nguyên không đổi) ---
function parseXoaToken(tokens) { if (!Array.isArray(tokens)) return null; for (const t of tokens) { if (typeof t !== "string") continue; const token = t.trim(); const m = /^xoa\s*([\d,\s]+)$/i.exec(token); if (m) { return m[1].split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1); } } return null; }
function parseKeyToken(tokens) { if (!Array.isArray(tokens)) return null; for (const t of tokens) { if (typeof t !== "string") continue; const token = t.trim(); if (!token) continue; if (/^xoa[\d,\s]+$/i.test(token)) continue; if (/^cpr\d+$/i.test(token)) continue; if (/^\d{1,2}:\d{2}$/.test(token) || /^\d{2}\/\d{2}\/\d{4}$/.test(token)) continue; return token; } return null; }
function parseCprToken(tokens) { for (const t of tokens) { const m = /^cpr(\d+)$/i.exec(t); if (m) return parseInt(m[1], 10); } return null; }
function formatCustomTime(startMoment) { return startMoment.tz(TIME_ZONE).format("DD/MM HH:mm"); }
function ensureKeysConfig() { if (!fs.existsSync(keysPath)) { fs.writeFileSync(keysPath, JSON.stringify({ scoring: { ct: "SCO RING", ct2: "scoring", idbang: "lg1", logo: "", admins: [], ctvs: [], }, }, null, 2)); } try { return JSON.parse(fs.readFileSync(keysPath, "utf8")); } catch (e) { throw new Error("keys.json bị lỗi JSON: " + e.message); } }
async function loadLayoutById(idbang) { const layoutDir = path.join(layoutsRoot, idbang); const layoutJson = path.join(layoutDir, "layout.json"); const bgPath = path.join(layoutDir, "background.png"); if (!fs.existsSync(layoutJson)) { throw new Error(`Không tìm thấy layout.json cho layout "${idbang}"`); } if (!fs.existsSync(bgPath)) { throw new Error(`Không tìm thấy background.png cho layout "${idbang}"`); } const layoutConf = JSON.parse(fs.readFileSync(layoutJson, "utf8")); const bgImg = await loadImage(bgPath); return { layoutDir, layoutConf, bgImg }; }
function applyText(ctx, cfg, text) { if (!cfg || typeof text === "undefined" || text === null) return; ctx.fillStyle = cfg.color || "#FFF"; ctx.textAlign = cfg.align || "left"; ctx.font = `${cfg.bold ? "bold " : ""}${cfg.size || 22}px ${cfg.font || "Arial"}`; ctx.textBaseline = "alphabetic"; ctx.fillText(String(text), cfg.x || 0, cfg.y || 0); }
async function drawLogo(ctx, cfg, logoPath) { if (!cfg || !logoPath) return; try { const logo = await loadImage(logoPath); if (cfg.w && cfg.h) { ctx.drawImage(logo, cfg.x || 0, cfg.y || 0, cfg.w, cfg.h); } else { ctx.drawImage(logo, cfg.x || 0, cfg.y || 0); } } catch (e) { console.warn("⚠️ Không load logo:", logoPath, e.message); } }
function computeStartEndFromToday(slotId) { const [s, e] = TIME_SLOTS[slotId]; if (!s || !e) return null; const today = moment().tz(TIME_ZONE); const start = moment.tz(`${today.format("DD/MM/YYYY")} ${s}`, "DD/MM/YYYY HH:mm", TIME_ZONE); let end = moment.tz(`${today.format("DD/MM/YYYY")} ${e}`, "DD/MM/YYYY HH:mm", TIME_ZONE); if (end.isBefore(start)) end.add(1, "day"); return { start, end }; }
function aggregateTeams(matchDetails, mode = "normal", cprThreshold = 41) { const teamStats = new Map(); let champion = null; let finalMatchCount = matchDetails.length; for (let i = 0; i < matchDetails.length; i++) { const match = matchDetails[i]; const matchNumber = i + 1; const matchKeys = new Map(); for (const t of match.ranks) { let key = null; for (const [k, stats] of teamStats.entries()) { const overlap = (t.playerAccountIds || []).filter((id) => stats.playerIds.has(id)).length; if (overlap >= 2) { key = k; break; } } if (!key) { key = (t.playerAccountIds || []).sort().join(",") || `team_${Date.now()}_${Math.random()}`; } if (!teamStats.has(key)) { teamStats.set(key, { playerIds: new Set(), totalScore: 0, totalKills: 0, totalBooyahs: 0, BooyahsGame: [], isEligible: false, accountNames: Array.isArray(t.accountNames) ? t.accountNames.slice() : [], }); } else { const existing = teamStats.get(key); if ((!existing.accountNames || existing.accountNames.length === 0) && Array.isArray(t.accountNames) && t.accountNames.length) { existing.accountNames = t.accountNames.slice(); } } matchKeys.set(t, key); (t.playerAccountIds || []).forEach((id) => teamStats.get(key).playerIds.add(id)); } if (mode === "cpr") { const booyahTeam = match.ranks.find((r) => r.booyah > 0); if (booyahTeam) { const booyahKey = matchKeys.get(booyahTeam); const booyahStats = teamStats.get(booyahKey); if (booyahStats && booyahStats.isEligible) { champion = { teamKey: booyahKey, matchWon: matchNumber }; finalMatchCount = matchNumber; } } } match.ranks.forEach((t) => { const key = matchKeys.get(t); const stats = teamStats.get(key); if (stats) { stats.totalScore += Number(t.score) || 0; stats.totalKills += Number(t.kill) || 0; stats.totalBooyahs += Number(t.booyah) || 0; if (Number(t.booyah) > 0) { stats.BooyahsGame.push(matchNumber); } if (mode === "cpr" && !stats.isEligible && stats.totalScore >= cprThreshold) { stats.isEligible = true; } } }); if (champion) break; } let finalTeams = Array.from(teamStats.entries()).map(([key, stats]) => { let displayName; if (Array.isArray(stats.accountNames) && stats.accountNames.length && String(stats.accountNames[0]).trim()) { displayName = String(stats.accountNames[0]).trim(); } else { displayName = "Không tên"; } return { teamKey: key, displayName, ...stats, playerIds: Array.from(stats.playerIds), }; }); finalTeams.sort((a, b) => { if (mode === "cpr" && champion) { if (a.teamKey === champion.teamKey) return -1; if (b.teamKey === champion.teamKey) return 1; } if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore; if (b.totalBooyahs !== a.totalBooyahs) return b.totalBooyahs - a.totalBooyahs; return b.totalKills - a.totalKills; }); finalTeams.forEach((t, i) => { t.Top = i + 1; }); return { teams: finalTeams, champion, finalMatchCount }; }
function parseFullTimeArgs(args) { const accountId = args[0]; const tail = args.slice(1); if (tail.length < 4) throw new Error("❌ Thiếu thông tin start/end thời gian."); const normalizeDateTime = (inputDate, inputTime) => { let [d, m, y] = inputDate.split("/").map((s) => s.trim()); if (!d || !m || !y) throw new Error(`Ngày không hợp lệ: "${inputDate}"`); d = parseInt(d, 10); m = parseInt(m, 10); y = parseInt(y, 10); if (!(d >= 1 && d <= 31)) throw new Error(`Ngày phải từ 1-31: "${inputDate}"`); if (!(m >= 1 && m <= 12)) throw new Error(`Tháng phải từ 1-12: "${inputDate}"`); if (!/^\d{4}$/.test(String(y))) throw new Error(`Năm phải đủ 4 chữ số: "${inputDate}"`); const dd = d < 10 ? "0" + d : String(d); const mm = m < 10 ? "0" + m : String(m); const yyyy = String(y); let hh = null, min = null; let timeStr = inputTime.trim(); if (/^\d{1,2}h\d{1,2}$/.test(timeStr)) { [hh, min] = timeStr.split("h").map((n) => parseInt(n, 10)); } else if (/^\d{1,2}h$/.test(timeStr)) { hh = parseInt(timeStr.replace("h", ""), 10); min = 0; } else if (/^\d{1,2}:\d{1,2}$/.test(timeStr)) { [hh, min] = timeStr.split(":").map((n) => parseInt(n, 10)); } else { throw new Error(`Format giờ không hợp lệ: "${inputTime}"`); } if (!(hh >= 0 && hh <= 23)) throw new Error(`Giờ phải từ 0-23: "${inputTime}"`); if (!(min >= 0 && min <= 59)) throw new Error(`Phút phải từ 0-59: "${inputTime}"`); const HH = hh < 10 ? "0" + hh : String(hh); const MM = min < 10 ? "0" + min : String(min); return `${dd}/${mm}/${yyyy} ${HH}:${MM}`; }; let startStr, endStr; try { startStr = normalizeDateTime(tail[0], tail[1]); endStr = normalizeDateTime(tail[2], tail[3]); } catch (err) { throw new Error(`❌ Lỗi khung giờ: ${err.message}`); } const start = moment.tz(startStr, "DD/MM/YYYY HH:mm", TIME_ZONE); const end = moment.tz(endStr, "DD/MM/YYYY HH:mm", TIME_ZONE); if (!start.isValid()) throw new Error(`❌ Thời gian bắt đầu không hợp lệ: "${tail[0]} ${tail[1]}"`); if (!end.isValid()) throw new Error(`❌ Thời gian kết thúc không hợp lệ: "${tail[2]} ${tail[3]}"`); if (start.isSameOrAfter(end)) { throw new Error(`❌ Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.\nStart: ${startStr}\nEnd: ${endStr}`); } const extraTokens = tail.slice(4); const xoaN = parseXoaToken(extraTokens); const key = parseKeyToken(extraTokens) || "scoring"; const cpr = parseCprToken(extraTokens); const mode = cpr ? "cpr" : "normal"; return { accountId, start, end, key, xoaN, mode, cprThreshold: cpr }; }
// --------------------------------------------------

module.exports.config = { name: "tinhdiem", version: "2.7", hasPermssion: 0, credits: "Dev by LEGI STUDIO - ZanHau | Upgraded by Gemini", description: "Tính Điểm Custom (có trừ lượt, vô hạn user/box, đổi biệt danh, giới hạn).", commandCategory: "game", usages: "[id] [key] [xoaN] [cprN]", cooldowns: 5, };

module.exports.run = async ({ args, api, event }) => {
  const { threadID, messageID, senderID } = event;
  try { 
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {}; 
      const threadLimit = limitData[threadID]; 
      if (threadLimit && threadLimit.game === false) { 
          return api.sendMessage("❎ Thánh Địa Của Bạn Không Được Phép Dùng Thuật Chú Trong 'Game'", threadID, messageID); 
      } 
  } catch (e) { 
      console.log("Lỗi khi đọc file limit.json trong lệnh tinhdiem:", e); 
  }
  if (!args.length) { return api.sendMessage("• Hướng dẫn sử dụng:\n.tinhdiem [id] [xoaN] [cprN]\n.tinhdiem [id] [key] [xoaN] [cprN]\n\n• Chú thích:\n  » xoaN: Xóa trận lỗi (N là STT trận, vd: xoa1,2,3)\n  » cprN: Tính CPR (N là điểm CPR cần đạt, vd: cpr41)", threadID, messageID); }
  if (args.length >= 5) { try { const flowArgs = parseFullTimeArgs(args); if (!flowArgs.start.isValid() || !flowArgs.end.isValid()) { return api.sendMessage("❌ Lỗi parse ngày giờ, kiểm tra lại format.", threadID, messageID); } if (flowArgs.start.isSameOrAfter(flowArgs.end)) { return api.sendMessage(`❌ Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.\nStart: ${flowArgs.start.format("DD/MM/YYYY HH:mm")}\nEnd: ${flowArgs.end.format("DD/MM/YYYY HH:mm")}`, threadID, messageID); } return executeFlow({ ...flowArgs, api, event }); } catch (err) { return api.sendMessage(err.message, threadID, messageID); } }
  const accountId = args[0]; const tail = args.slice(1); const xoaN = parseXoaToken(tail); const key = parseKeyToken(tail) || "scoring"; const cpr = parseCprToken(tail); const mode = cpr ? "cpr" : "normal";
  let keysConf = {}; try { keysConf = ensureKeysConfig(); } catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }
  const keyConf = keysConf[key] || keysConf["scoring"]; if (!keyConf) { return api.sendMessage(`❌ Không tìm thấy key "${key}" và key mặc định.`, threadID, messageID); }
  const allowAdmins = Array.isArray(keyConf.admins) ? keyConf.admins : []; const allowCtvs = Array.isArray(keyConf.ctvs) ? keyConf.ctvs : [];
  if ((allowAdmins.length || allowCtvs.length) && !(allowAdmins.includes(String(senderID)) || allowCtvs.includes(String(senderID)))) { return api.sendMessage(`❌ Bạn không có quyền dùng key "${key}".`, threadID, messageID); }
  const uInfo = await api.getUserInfo(senderID).catch(() => ({})); const senderName = uInfo?.[senderID]?.name || "Người dùng";
  return api.sendMessage(`⏳ Vui lòng chọn khung giờ tính điểm:\n\n1. 13:00 ➟ 15:00\n2. 15:00 ➟ 17:00\n3. 17:00 ➟ 19:00\n4. 20:00 ➟ 21:30\n5. 21:40 ➟ 23:00\n6. 23:30 ➟ 01:00\n7. 01:00 ➟ 03:00\n8. 10:00 ➟ 12:00\n\n📌 Reply (phản hồi) tin nhắn này bằng số tương ứng để chọn.\nYêu cầu bởi: ${senderName}`, threadID, (err, info) => { if (err) return; global.client = global.client || {}; global.client.handleReply = global.client.handleReply || []; global.client.handleReply.push({ name: REPLY_NAME, messageID: info.messageID, author: senderID, type: "chon_khung_gio", data: { accountId, key, xoaN, mode, cprThreshold: cpr }, }); }, messageID );
};

module.exports.handleReply = async ({ api, event, handleReply }) => {
  const { threadID, messageID, senderID, body } = event;
  try { 
      const limitData = fs.readJsonSync(limitPath, { throws: false }) || {}; 
      const threadLimit = limitData[threadID]; 
      if (threadLimit && threadLimit.game === false) return; 
  } catch (e) { /* Lỗi thì bỏ qua */ }
  if (senderID !== handleReply.author || handleReply.name !== REPLY_NAME || handleReply.type !== "chon_khung_gio") return;
  const selected = body.split(",").map((s) => s.trim()).filter((s) => s !== ""); const slotIds = selected.map((n) => parseInt(n, 10)).filter((n) => TIME_SLOTS[n]);
  if (!slotIds.length) { return api.sendMessage("❌ Lựa chọn không hợp lệ. Hãy reply số từ 1-8.", threadID, messageID); }
  api.unsendMessage(handleReply.messageID).catch(() => {});
  for (const slotId of slotIds) { const timeRange = computeStartEndFromToday(slotId); if (!timeRange) continue; const { accountId, key, xoaN, mode, cprThreshold } = handleReply.data; await executeFlow({ api, event, accountId, start: timeRange.start, end: timeRange.end, key, xoaN, mode, cprThreshold, }); }
};

async function executeFlow({ api, event, accountId, start, end, key = "scoring", xoaN = null, mode = "normal", cprThreshold = null, }) {
    const { threadID, messageID, senderID } = event;
    let isFreeForUser = false; // Cờ chung để xác định quyền miễn phí

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
                delete vohanBoxData[threadID];
                fs.writeJsonSync(vohanBoxFilePath, vohanBoxData, { spaces: 2 });
            }
        }
    } catch (e) {
        console.error("[TINHDIEM] Lỗi khi kiểm tra file vohan_box:", e);
    }

    // --- BƯỚC 2: KIỂM TRA VOHAN CÁ NHÂN (Nếu box không miễn phí) ---
    if (!isFreeForUser) {
        try {
            const vohanData = fs.readJsonSync(vohanFilePath, { throws: false }) || {};
            if (vohanData[senderID] && moment().isBefore(moment(vohanData[senderID]))) {
                isFreeForUser = true;
            } else if (vohanData[senderID]) {
                delete vohanData[senderID];
                fs.writeJsonSync(vohanFilePath, vohanData, { spaces: 2 });
            }
        } catch (e) {
            console.error("[TINHDIEM] Lỗi khi kiểm tra file vô hạn cá nhân:", e);
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
            console.error("[TINHDIEM] Lỗi khi đọc file lượt:", e);
            return api.sendMessage("❌ Đã có lỗi xảy ra với hệ thống lượt, vui lòng thử lại sau.", threadID, messageID);
        }
    }

    // --- PHẦN LOGIC CÒN LẠI CỦA LỆNH ---
    let keysConf = {}; try { keysConf = ensureKeysConfig(); } catch (e) { return api.sendMessage("❌ " + e.message, threadID, messageID); }
    const keyConf = keysConf[key] || keysConf["scoring"]; if (!keyConf) { return api.sendMessage("❌ Không tìm thấy key và key mặc định.", threadID, messageID); }
    const allowAdmins = Array.isArray(keyConf.admins) ? keyConf.admins : []; const allowCtvs = Array.isArray(keyConf.ctvs) ? keyConf.ctvs : [];
    if ((allowAdmins.length || allowCtvs.length) && !(allowAdmins.includes(String(senderID)) || allowCtvs.includes(String(senderID)))) { return api.sendMessage(`❌ Bạn không có quyền dùng key "${key}".`, threadID, messageID); }
    let matchIds = []; try { matchIds = await garenaApi.findMatches(accountId, start, end); } catch (e) { console.error(e); return api.sendMessage("ID đã hết lượt tính hoặc trang web Garena đang lỗi, vui lòng thử lại sau.", threadID, messageID); }
    if (!matchIds || !matchIds.length) { return api.sendMessage("❌ Không tìm thấy trận đấu nào của ID trong khung giờ đã chọn!", threadID, messageID); }
    let matchDetails = []; try { matchDetails = await garenaApi.getMatchDetails(matchIds); } catch (e) { console.error(e); return api.sendMessage("ID đã hết lượt tính hoặc trang web Garena đang lỗi, vui lòng thử lại sau.", threadID, messageID); }
    if (Array.isArray(xoaN) && xoaN.length > 0) { const sorted = [...xoaN].sort((a, b) => b - a); for (const idx of sorted) { if (Number.isInteger(idx) && idx >= 1 && idx <= matchDetails.length) { matchDetails.splice(idx - 1, 1); } } }
    const { teams, champion, finalMatchCount } = aggregateTeams(matchDetails, mode, cprThreshold); if (!teams.length) { return api.sendMessage("❌ Không có dữ liệu đội nào!", threadID, messageID); }
    const layoutId = keyConf.idbang || "lg1"; let layoutPack; try { layoutPack = await loadLayoutById(layoutId); } catch (e) { console.error(e); return api.sendMessage("❌ " + e.message, threadID, messageID); }
    try { const { layoutConf, bgImg } = layoutPack; const canvas = createCanvas(bgImg.width, bgImg.height); const ctx = canvas.getContext("2d"); ctx.drawImage(bgImg, 0, 0); const customName = keyConf.ct || key; const customName2 = keyConf.ct2 || key; const customTime = formatCustomTime(start); if (layoutConf.header) { if (layoutConf.header.customName) applyText(ctx, layoutConf.header.customName, customName); if (layoutConf.header.customName2) applyText(ctx, layoutConf.header.customName2, customName2); if (layoutConf.header.customTime) applyText(ctx, layoutConf.header.customTime, customTime); const logoFromKey = keyConf.logo && String(keyConf.logo).trim() ? keyConf.logo : null; if (layoutConf.header.logos && Array.isArray(layoutConf.header.logos)) { for (let i = 0; i < teams.length; i++) { const team = teams[i]; const logoCfg = layoutConf.header.logos[i]; if (!logoCfg) continue; if (team) await drawLogo(ctx, logoCfg, logoFromKey); } for (const customKey of ["custom1", "custom2", "custom3"]) { const customLogo = layoutConf.header.logos.find((l) => String(l.top).toLowerCase() === customKey); if (customLogo) { if (logoFromKey) await drawLogo(ctx, customLogo, logoFromKey); } } } } const maxRow = layoutConf.limit || 10; const rows = Math.min(maxRow, teams.length); for (let i = 0; i < rows; i++) { const team = teams[i]; const slotKey = `Top${i + 1}`; const slotCfg = layoutConf[slotKey]; if (!slotCfg) continue; const teamName = team.displayName || "Không tên"; if (slotCfg.Top) applyText(ctx, slotCfg.Top, String(team.Top || i + 1)); if (slotCfg.Name) applyText(ctx, slotCfg.Name, teamName); if (slotCfg.Kill) applyText(ctx, slotCfg.Kill, String(team.totalKills || 0)); if (slotCfg.Booyah) applyText(ctx, slotCfg.Booyah, String(team.totalBooyahs || 0)); if (slotCfg.Score) applyText(ctx, slotCfg.Score, String(team.totalScore || 0)); } if (layoutConf.BooyahGames) { for (const team of teams) { if (!team.BooyahsGame || team.BooyahsGame.length === 0) continue; for (const g of team.BooyahsGame) { const slotCfg = layoutConf.BooyahGames[`Game${g}`]; if (slotCfg) { applyText(ctx, slotCfg, team.displayName); } if (Array.isArray(layoutConf.BooyahGames.LogosBooyah)) { const logoCfg = layoutConf.BooyahGames.LogosBooyah.find((l) => l.game === g); if (logoCfg) { const logoFromKey = keyConf.logo && String(keyConf.logo).trim() ? keyConf.logo : null; if (logoFromKey) await drawLogo(ctx, logoCfg, logoFromKey); } } } } } const outPath = path.join(bxhRoot, `bxh-${layoutId}-${key}-${Date.now()}.png`); fs.writeFileSync(outPath, canvas.toBuffer()); let msgBody = "🤖 SCORING BOT 🤖\n\n"; msgBody += `📊 ID: ${accountId}\n`; msgBody += `🎯 Số Trận: ${finalMatchCount}\n`; msgBody += `⏳ Khung Giờ: ${start.format("HH:mm")} | ${end.format("HH:mm DD/MM")}\n`; msgBody += `🔑 Key: ${key}\n`; if (xoaN) msgBody += `🗑️ Đã Xóa Trận: ${xoaN.join(", ")}\n`; if (mode === "cpr" && cprThreshold) msgBody += `🔹 CPR Mode: ${cprThreshold} Điểm\n`;

        api.sendMessage({ body: msgBody, attachment: fs.createReadStream(outPath) }, threadID, async (err, info) => {
            if (err) { console.error("[TINHDIEM] Lỗi khi gửi tin nhắn kết quả:", err); try { fs.unlinkSync(outPath); } catch {} return; }
            
            // --- BƯỚC 4: TRỪ LƯỢT VÀ ĐỔI BIỆT DANH (Chỉ khi không được miễn phí) ---
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
                        
                        api.changeNickname(newNickname, threadID, senderID, (err) => {
                           if (err) console.log(`[TINHDIEM] Không thể đổi biệt danh cho ${senderID}:`, err.errorDescription);
                        });
                    }
                } catch (e) {
                    console.error("[TINHDIEM] Lỗi khi trừ lượt hoặc đổi biệt danh:", e);
                }
            }

            try { fs.unlinkSync(outPath); } catch {}
        }, messageID);
    } catch (e) { console.error(e); api.sendMessage("❌ Lỗi khi tạo ảnh bảng xếp hạng: " + e.message, threadID, messageID); }
}
