const fs = require("fs");
const path = require("path");
const moment = require('moment-timezone');
const axios = require("axios");

module.exports = function ({ api, models }) {
  setInterval(function () {
    if (global.config.NOTIFICATION) {
      require("./handle/handleNotification.js")({ api });
    }
  }, 1000 * 60);
  
  const Users = require("./controllers/users.js")({ models, api }),
    Threads = require("./controllers/threads.js")({ models, api }),
    Currencies = require("./controllers/currencies.js")({ models });
  const logger = require("../utils/log.js");
  var day = moment.tz("Asia/Ho_Chi_Minh").day();

  (async function () {
    try {
      logger(global.getText("listen", "startLoadEnvironment"), "DATA");
      let threads = await Threads.getAll(),
        users = await Users.getAll(["userID", "name", "data"]),
        currencies = await Currencies.getAll(["userID"]);
      for (const data of threads) {
        const idThread = String(data.threadID);
        global.data.allThreadID.push(idThread),
          global.data.threadData.set(idThread, data["data"] || {}),
          global.data.threadInfo.set(idThread, data.threadInfo || {});
        if (data["data"] && data["data"]["banned"] == !![])
          global.data.threadBanned.set(idThread, {
            reason: data["data"]["reason"] || "",
            dateAdded: data["data"]["dateAdded"] || "",
          });
        if (
          data["data"] &&
          data["data"]["commandBanned"] &&
          data["data"]["commandBanned"]["length"] != 0
        )
          global["data"]["commandBanned"]["set"](
            idThread,
            data["data"]["commandBanned"],
          );
        if (data["data"] && data["data"]["NSFW"])
          global["data"]["threadAllowNSFW"]["push"](idThread);
      }
      logger.loader(global.getText("listen", "loadedEnvironmentThread"));
      for (const dataU of users) {
        const idUsers = String(dataU["userID"]);
        global.data["allUserID"]["push"](idUsers);
        if (dataU.name && dataU.name["length"] != 0)
          global.data.userName["set"](idUsers, dataU.name);
        if (dataU.data && dataU.data.banned == 1)
          global.data["userBanned"]["set"](idUsers, {
            reason: dataU["data"]["reason"] || "",
            dateAdded: dataU["data"]["dateAdded"] || "",
          });
        if (
          dataU["data"] &&
          dataU.data["commandBanned"] &&
          dataU["data"]["commandBanned"]["length"] != 0
        )
          global["data"]["commandBanned"]["set"](
            idUsers,
            dataU["data"]["commandBanned"],
          );
      }
      for (const dataC of currencies)
        global.data.allCurrenciesID.push(String(dataC["userID"]));
    } catch (error) {
      return logger.loader(
        global.getText("listen", "failLoadEnvironment", error),
        "error",
      );
    }
  })();

  const admin = global.config.ADMINBOT;
  const userId = api.getCurrentUserID();
  const user = api.getUserInfo([userId]);
  const userName = user[userId]?.name || null;
  logger.loader("┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
  for (let i = 0; i <= admin.length - 1; i++) {
    dem = i + 1;
    logger.loader(` ID ADMIN ${dem}: ${!admin[i] ? "Trống" : admin[i]}`);
  }
  logger.loader(` ID BOT: ${userId} - ${userName}`);
  logger.loader(` PREFIX: ${global.config.PREFIX}`);
  logger.loader(
    ` NAME BOT: ${!global.config.BOTNAME ? "This bot was made by Khôi" : global.config.BOTNAME}`,
  );
  logger.loader("┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛");

  const { exec } = require("child_process");
  exec("rm -fr modules/commands/cache/*.m4a");
  exec("rm -fr modules/commands/cache/*.mp4 ");
  exec("rm -fr modules/commands/cache/*.png");
  exec("rm -fr modules/commands/cache/*.jpg");
  exec("rm -fr modules/commands/cache/*.gif");
  exec("rm -fr modules/commands/cache/*.mp3");
  const adminID = "61575999835460"; // Thay ID của bạn nếu cần
  api.sendMessage(`[💌]Yêu cầu sử dụng file:\n[💫] Tên: ${global.config.AMDIN_NAME} (${global.config.ADMINBOT[0]})\n[🥨] Link Facebook: ${global.config.FACEBOOK_ADMIN}\n[🎃] Cam kết: Xin chào Khôi, tôi là bot của ${global.config.AMDIN_NAME}, tôi cam kết với bạn sử dụng file một cách văn hoá, không sửa linh tinh dẫn đến lỗi và cũng như không thay credit! Cảm ơn bạn`, adminID);

  const handleCommand = require("./handle/handleCommand.js")({ api, models, Users, Threads, Currencies });
  const handleCommandEvent = require("./handle/handleCommandEvent.js")({ api, models, Users, Threads, Currencies });
  const handleReply = require("./handle/handleReply.js")({ api, models, Users, Threads, Currencies });
  const handleReaction = require("./handle/handleReaction.js")({ api, models, Users, Threads, Currencies });
  const handleEvent = require("./handle/handleEvent.js")({ api, models, Users, Threads, Currencies });
  const handleRefresh = require("./handle/handleRefresh.js")({ api, models, Users, Threads, Currencies });
  const handleCreateDatabase = require("./handle/handleCreateDatabase.js")({ api, Threads, Users, Currencies, models });
  logger.loader(`Ping load toàn bộ commands và events • ${Date.now() - global.client.timeStart}ms •`);
  
  const datlichPath = __dirname + "/../modules/commands/cache/datlich.json";
  const monthToMSObj = { 1: 31 * 24 * 60 * 60 * 1000, 2: 28 * 24 * 60 * 60 * 1000, 3: 31 * 24 * 60 * 60 * 1000, 4: 30 * 24 * 60 * 60 * 1000, 5: 31 * 24 * 60 * 60 * 1000, 6: 30 * 24 * 60 * 60 * 1000, 7: 31 * 24 * 60 * 60 * 1000, 8: 31 * 24 * 60 * 60 * 1000, 9: 30 * 24 * 60 * 60 * 1000, 10: 31 * 24 * 60 * 60 * 1000, 11: 30 * 24 * 60 * 60 * 1000, 12: 31 * 24 * 60 * 60 * 1000 };
  const checkTime = (time) => new Promise((resolve) => {
    time.forEach((e, i) => (time[i] = parseInt(String(e).trim())));
    const getDayFromMonth = (month) => month == 0 ? 0 : month == 2 ? time[2] % 4 == 0 ? 29 : 28 : [1, 3, 5, 7, 8, 10, 12].includes(month) ? 31 : 30;
    if (time[1] > 12 || time[1] < 1) resolve(" Tháng của bạn có vẻ không hợp lệ");
    if (time[0] > getDayFromMonth(time[1]) || time[0] < 1) resolve("Ngày của bạn có vẻ không hợp lệ");
    if (time[2] < 2022) resolve("Bạn sống ở kỷ nguyên nào thế?");
    if (time[3] > 23 || time[3] < 0) resolve("Giờ của bạn có vẻ không hợp lệ");
    if (time[4] > 59 || time[3] < 0) resolve("Phút của bạn có vẻ không hợp lệ");
    if (time[5] > 59 || time[3] < 0) resolve("Giây của bạn có vẻ không hợp lệ");
    yr = time[2] - 1970;
    yearToMS = yr * 365 * 24 * 60 * 60 * 1000;
    yearToMS += ((yr - 2) / 4).toFixed(0) * 24 * 60 * 60 * 1000;
    monthToMS = 0;
    for (let i = 1; i < time[1]; i++) monthToMS += monthToMSObj[i];
    if (time[2] % 4 == 0) monthToMS += 24 * 60 * 60 * 1000;
    dayToMS = time[0] * 24 * 60 * 60 * 1000;
    hourToMS = time[3] * 60 * 60 * 1000;
    minuteToMS = time[4] * 60 * 1000;
    secondToMS = time[5] * 1000;
    oneDayToMS = 24 * 60 * 60 * 1000;
    timeMs = yearToMS + monthToMS + dayToMS + hourToMS + minuteToMS + secondToMS - oneDayToMS;
    resolve(timeMs);
  });
  const tenMinutes = 10 * 60 * 1000;
  const checkAndExecuteEvent = async () => {
    if (!fs.existsSync(datlichPath)) fs.writeFileSync(datlichPath, JSON.stringify({}, null, 4));
    var data = JSON.parse(fs.readFileSync(datlichPath));
    var timeVN = moment().tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY_HH:mm:ss");
    timeVN = timeVN.split("_");
    timeVN = [...timeVN[0].split("/"), ...timeVN[1].split(":")];
    let temp = [];
    let vnMS = await checkTime(timeVN);
    const compareTime = (e) => new Promise(async (resolve) => {
      let getTimeMS = await checkTime(e.split("_"));
      if (getTimeMS < vnMS) {
        if (vnMS - getTimeMS < tenMinutes) {
          data[boxID][e]["TID"] = boxID;
          temp.push(data[boxID][e]);
          delete data[boxID][e];
        } else delete data[boxID][e];
        fs.writeFileSync(datlichPath, JSON.stringify(data, null, 4));
      }
      resolve();
    });
    await new Promise(async (resolve) => {
      for (boxID in data) { for (e of Object.keys(data[boxID])) await compareTime(e); }
      resolve();
    });
    for (el of temp) {
      try {
        var all = (await Threads.getInfo(el["TID"])).participantIDs;
        all.splice(all.indexOf(api.getCurrentUserID()), 1);
        var body = el.REASON || "MỌI NGƯỜI ƠI", mentions = [], index = 0;
        for (let i = 0; i < all.length; i++) {
          if (i == body.length) body += " ‍ ";
          mentions.push({ tag: body[i], id: all[i], fromIndex: i - 1 });
        }
      } catch (e) { return console.log(e); }
      var out = { body, mentions };
      if ("ATTACHMENT" in el) {
        out.attachment = [];
        for (a of el.ATTACHMENT) {
          let getAttachment = (await axios.get(encodeURI(a.url), { responseType: "arraybuffer" })).data;
          fs.writeFileSync(__dirname + `/../modules/commands/cache/${a.fileName}`, Buffer.from(getAttachment, "utf-8"));
          out.attachment.push(fs.createReadStream(__dirname + `/../modules/commands/cache/${a.fileName}`));
        }
      }
      console.log(out);
      if ("BOX" in el) await api.setTitle(el["BOX"], el["TID"]);
      api.sendMessage(out, el["TID"], () => "ATTACHMENT" in el ? el.ATTACHMENT.forEach((a) => fs.unlinkSync(__dirname + `/../modules/commands/cache/${a.fileName}`)) : "");
    }
  };
  setInterval(checkAndExecuteEvent, tenMinutes / 10);

  // =================================================================
  // ============ HỆ THỐNG ANTI NÂNG CAO - BẮT ĐẦU =====================
  // =================================================================
  const antiPath = path.join(process.cwd(), 'modules/commands/cache/anti_settings.json');
  const chongCuopBoxDir = path.join(process.cwd(), 'modules/commands/cache/chongcuopbox');
  
  const getThreadData = (threadID) => {
      try {
          if (!fs.existsSync(antiPath)) fs.writeFileSync(antiPath, JSON.stringify({}));
          return JSON.parse(fs.readFileSync(antiPath, 'utf8'))[threadID] || {};
      } catch (e) { console.error("[ANTI HELPER ERROR]", e); return {}; }
  };
  
  const saveThreadData = (threadID, data) => {
      try {
          const allSettings = JSON.parse(fs.readFileSync(antiPath, 'utf8'));
          allSettings[threadID] = { ...(allSettings[threadID] || {}), ...data };
          fs.writeFileSync(antiPath, JSON.stringify(allSettings, null, 4));
      } catch (e) { console.error("[ANTI HELPER ERROR]", e); }
  };

  const readJSON = (filePath) => {
    const fullPath = path.join(chongCuopBoxDir, filePath);
    try {
        if (!fs.existsSync(fullPath)) {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
            fs.writeFileSync(fullPath, JSON.stringify({}));
        }
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (e) { return {}; }
  };

  const writeJSON = (filePath, data) => {
      const fullPath = path.join(chongCuopBoxDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 4));
  };

  const logAction = (threadID, message) => {
    const logDir = path.join(chongCuopBoxDir, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFilePath = path.join(logDir, `${threadID}.log`);
    const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
  };

  async function restoreGroupImage(api, threadID, settings) {
      try {
          let imageStream;
          if (settings.groupImagePath && fs.existsSync(settings.groupImagePath)) {
              imageStream = fs.createReadStream(settings.groupImagePath);
          } else if (settings.groupImage) {
              const response = await axios.get(settings.groupImage, { responseType: 'stream' });
              imageStream = response.data;
          } else {
              api.sendMessage("⚠️ Lỗi: Không tìm thấy ảnh cũ để khôi phục.", threadID);
              return;
          }
          api.changeGroupImage(imageStream, threadID, (err) => {
              if (err) { console.error("[ANTI-IMAGE ERROR] Lỗi khôi phục ảnh:", err); } 
              else { console.log(`[ANTI-IMAGE] Khôi phục ảnh nhóm ${threadID} thành công.`); }
          });
      } catch (e) {
          console.error(`[ANTI-IMAGE ERROR] Lỗi khôi phục ảnh:`, e.message);
      }
  }
  
  function checkRentStatus(threadID) {
    const RENT_DATA_PATH = path.join(process.cwd(), 'modules', 'commands', 'cache', 'data_rentbot_pro', 'thuebot_pro.json');
    if (!fs.existsSync(RENT_DATA_PATH)) {
      return { active: false, message: "Không tìm thấy file dữ liệu thuê bot" };
    }
    try {
      const rentData = JSON.parse(fs.readFileSync(RENT_DATA_PATH, 'utf8'));
      const rentInfo = rentData.find(e => e.t_id === threadID);

      if (!rentInfo) {
        return { active: false, message: "Nhóm chưa được thuê bot" };
      }

      const endDate = moment(rentInfo.time_end, 'DD/MM/YYYY').tz('Asia/Ho_Chi_Minh').endOf('day');
      if (moment().tz('Asia/Ho_Chi_Minh').isAfter(endDate)) {
        return { active: false, message: "Gói thuê bot của nhóm đã hết hạn" };
      }
      return { active: true, message: "Gói thuê bot đang hoạt động" };
    } catch (e) {
      console.error("Lỗi khi đọc file thuê bot trong listen.js:", e);
      return { active: false, message: "Lỗi đọc dữ liệu thuê bot" };
    }
  }

  return async (event) => {
    // =======================================================================
    // ======================= LOGIC ANTI TỔNG HỢP =========================
    // =======================================================================
    try {
        const { type, threadID, logMessageType, author, logMessageData, body, senderID, mentions } = event;
        const botID = api.getCurrentUserID();
        
        // <<< START EDIT: Thêm biến để xác định trường hợp bot thêm QTV
        const isBotAddingQTV = type === 'event' && 
                               logMessageType === "log:thread-admins" &&
                               logMessageData &&
                               logMessageData.ADMIN_EVENT === "add_admin" &&
                               author === botID;
        // <<< END EDIT
        
        // <<< START EDIT: Sửa điều kiện để bao gồm trường hợp bot thêm QTV
        if ((author && author !== botID) || ((type === "message" || type === "message_reply") && body && senderID !== botID) || isBotAddingQTV) {
        // <<< END EDIT
            const settings = getThreadData(threadID);
            const isAntiEnabled = Object.values(settings).some(val => val === true);
            const actorID = author || senderID;

            // <<< START EDIT: Sửa điều kiện để bot không bị bỏ qua khi thêm QTV
            if (isAntiEnabled && (!global.config.ADMINBOT.includes(actorID) || isBotAddingQTV)) {
            // <<< END EDIT
                const rentStatus = checkRentStatus(threadID);
                const threadInfo = await Threads.getInfo(threadID);
                const isGroupAdmin = threadInfo && threadInfo.adminIDs && threadInfo.adminIDs.some(item => item.id == actorID);

                if (rentStatus.active) {
                    if ((type === "event" || type === "change_thread_image") && author) {
                        if ((logMessageType === "log:thread-image" || logMessageType === "log:thread-icon" || type === "change_thread_image") && settings.antiChangeGroupImage) {
                            if (isGroupAdmin) {
                                console.log(`[ANTI-IMAGE] QTV đổi ảnh. Cập nhật...`);
                                setTimeout(async () => {
                                    try {
                                        const newImgUrl = (await api.getThreadInfo(threadID)).imageSrc;
                                        if (newImgUrl) {
                                            const imgPath = path.join(process.cwd(), 'modules/commands/cache/anti_images', `${threadID}.png`);
                                            if (!fs.existsSync(path.dirname(imgPath))) fs.mkdirSync(path.dirname(imgPath), { recursive: true });
                                            const response = await axios.get(newImgUrl, { responseType: 'stream' });
                                            response.data.pipe(fs.createWriteStream(imgPath));
                                            saveThreadData(threadID, { groupImage: newImgUrl, groupImagePath: imgPath });
                                            console.log(`[ANTI-IMAGE] Cập nhật ảnh mới thành công.`);
                                        }
                                    } catch (e) { console.error("[ANTI-IMAGE] Lỗi cập nhật ảnh QTV:", e); }
                                }, 3000);
                            } else {
                                const userName = await Users.getNameUser(author);
                                api.removeUserFromGroup(author, threadID, (err) => {
                                    restoreGroupImage(api, threadID, settings);
                                    if (err) return api.sendMessage(`⚠️ ${userName}, bạn không có quyền đổi ảnh. Ảnh đã được khôi phục.`, threadID);
                                    api.sendMessage(`🚫 Đã kick ${userName} vì tự ý đổi ảnh nhóm và ảnh đã được khôi phục.`, threadID);
                                });
                            }
                        }
                        switch (logMessageType) {
                            case "log:thread-name":
                                if (settings.antiChangeGroupName) {
                                    if (isGroupAdmin) {
                                        saveThreadData(threadID, { groupName: logMessageData.name });
                                        console.log(`[ANTI-NAME] QTV đổi tên, đã cập nhật.`);
                                    } else {
                                        const userName = await Users.getNameUser(author);
                                        api.removeUserFromGroup(author, threadID, (err) => {
                                            api.setTitle(settings.groupName || "Tên Nhóm Cũ", threadID);
                                            if (err) return api.sendMessage(`⚠️ ${userName}, bạn không có quyền đổi tên nhóm.`, threadID);
                                            api.sendMessage(`🚫 Đã kick ${userName} vì tự ý đổi tên nhóm.`, threadID);
                                        });
                                    }
                                }
                                break;
                            case "log:unsubscribe":
                                const victimID = logMessageData.leftParticipantFbId;
                                if (settings.antiOut && victimID === author) {
                                    api.addUserToGroup(author, threadID, async (err) => {
                                        if (err) return console.error("[ANTI-OUT ERROR]", err);
                                        const name = await Users.getNameUser(author);
                                        api.sendMessage(`Định out chùa à ${name}? Mơ đi cưng, vô lại đây.`, threadID);
                                    });
                                }
                                if (settings.antiQTV && author !== victimID) {
                                    const monitoring = readJSON("monitoring.json");
                                    if (monitoring[threadID]?.[author] && Date.now() < monitoring[threadID][author]) {
                                        const qtvList = readJSON("qtv_list.json");
                                        const wasVictimAdmin = qtvList[threadID]?.includes(victimID);
                                        
                                        if (wasVictimAdmin) {
                                            const authorName = await Users.getNameUser(author);
                                            const victimName = await Users.getNameUser(victimID);
                                            
                                            api.changeAdminStatus(threadID, author, false);
                                            api.removeUserFromGroup(author, threadID);
                                            
                                            const blacklist = readJSON("blacklist.json");
                                            blacklist[author] = { reason: `Kick QTV (${victimName}) khi đang bị giám sát`, timestamp: Date.now() };
                                            writeJSON("blacklist.json", blacklist);
                                            delete monitoring[threadID][author];
                                            writeJSON("monitoring.json", monitoring);

                                            api.addUserToGroup(victimID, threadID, (err) => {
                                                if (err) {
                                                    api.sendMessage(`❗️ VI PHẠM GIÁM SÁT ❗️\nQTV "${authorName}" đã kick QTV "${victimName}" khi đang bị theo dõi. Đã xử lý ${authorName} nhưng không thể thêm ${victimName} trở lại nhóm.`, threadID);
                                                    return console.error("[ANTI-QTV RE-ADD ERROR]", err);
                                                }
                                                api.changeAdminStatus(threadID, victimID, true, (err) => {
                                                    if (err) console.error(`[ANTI-QTV RE-PROMOTE ERROR] ${err}`);
                                                });
                                            });

                                            api.sendMessage(`❗️ VI PHẠM GIÁM SÁT ❗️\nQTV "${authorName}" đã kick QTV "${victimName}" khi đang bị theo dõi.\n\n=> Hậu quả: ${authorName} đã bị gỡ QTV, kick khỏi nhóm và blacklist.\n=> Khôi phục: ${victimName} đang được thêm lại và khôi phục QTV.`, threadID);
                                            logAction(threadID, `VIOLATION: ${authorName} (${author}) kicked admin ${victimName} (${victimID}). Action taken.`);
                                        }
                                    }
                                }
                                break;
                            case "log:subscribe":
                                if (settings.antiJoin && !isGroupAdmin) {
                                    for (const member of logMessageData.addedParticipants) {
                                        if (member.userFbId !== botID && member.userFbId !== author) {
                                            api.removeUserFromGroup(member.userFbId, threadID, (err) => {
                                                if (err) console.error("[ANTI-JOIN ERROR]", err);
                                                else api.sendMessage(`Thêm thành viên khi không có sự cho phép của QTV, cút!`, threadID);
                                            });
                                        }
                                    }
                                }
                                break;
                            case "log:thread-admins":
                               if (settings.antiQTV) {
                                    const { ADMIN_EVENT, TARGET_ID } = logMessageData;
                                    const qtvList = readJSON("qtv_list.json");
                                    if (!qtvList[threadID]) qtvList[threadID] = [];

                                    if (ADMIN_EVENT === "add_admin") {
                                        if (qtvList[threadID].length === 0) {
                                            const currentAdmins = threadInfo.adminIDs.map(admin => admin.id);
                                            qtvList[threadID] = currentAdmins;
                                        } else {
                                            if (!qtvList[threadID].includes(TARGET_ID)) {
                                                qtvList[threadID].push(TARGET_ID);
                                            }
                                        }
                                        writeJSON("qtv_list.json", qtvList);
                                        
                                        if (author !== TARGET_ID) {
                                            const blacklist = readJSON("blacklist.json");
                                            if (blacklist[TARGET_ID]) {
                                                api.changeAdminStatus(threadID, TARGET_ID, false);
                                                return api.sendMessage(`⚠️ Thành viên này trong danh sách đen, không thể thêm làm QTV.`, threadID);
                                            }
                                            const monitoring = readJSON("monitoring.json");
                                            if (!monitoring[threadID]) monitoring[threadID] = {};
                                            monitoring[threadID][TARGET_ID] = Date.now() + 48 * 60 * 60 * 1000;
                                            writeJSON("monitoring.json", monitoring);
                                            const targetName = await Users.getNameUser(TARGET_ID);
                                            api.sendMessage(`🔐 Bật chế độ giám sát QTV mới "${targetName}".\nThời gian theo dõi: 48 giờ.`, threadID);
                                        }
                                    } 
                                    else if (ADMIN_EVENT === "remove_admin") {
                                        const monitoring = readJSON("monitoring.json");
                                        if (monitoring[threadID]?.[author] && Date.now() < monitoring[threadID][author] && author !== TARGET_ID) {
                                            const authorName = await Users.getNameUser(author);
                                            const targetName = await Users.getNameUser(TARGET_ID);
                                            
                                            api.changeAdminStatus(threadID, author, false);
                                            api.removeUserFromGroup(author, threadID);
                                            const blacklist = readJSON("blacklist.json");
                                            blacklist[author] = { reason: `Gỡ QTV (${targetName}) khi đang bị giám sát`, timestamp: Date.now() };
                                            writeJSON("blacklist.json", blacklist);
                                            delete monitoring[threadID][author];
                                            writeJSON("monitoring.json", monitoring);
                                            
                                            api.changeAdminStatus(threadID, TARGET_ID, true);

                                            api.sendMessage(`❗️ VI PHẠM GIÁM SÁT ❗️\nQTV "${authorName}" đã gỡ QTV của "${targetName}" khi đang bị theo dõi.\n\n=> Hậu quả: Mất quyền QTV, bị kick khỏi nhóm và bị thêm vào danh sách đen.`, threadID);
                                            logAction(threadID, `VIOLATION: ${authorName} (${author}) demoted ${targetName} (${TARGET_ID}). Action taken.`);
                                        } else {
                                            const index = qtvList[threadID].indexOf(TARGET_ID);
                                            if (index > -1) {
                                                qtvList[threadID].splice(index, 1);
                                                writeJSON("qtv_list.json", qtvList);
                                            }
                                        }
                                    }
                                }
                                break;
                        }
                    }
                    if ((type === "message" || type === "message_reply") && body && !isGroupAdmin) {
                        if (settings.antiLink && /(http(s)?:\/\/.)/i.test(body)) {
                            const senderName = await Users.getNameUser(senderID);
                            api.removeUserFromGroup(senderID, threadID, (err) => {
                                if (err) return console.error(`[ANTI-LINK ERROR]`, err);
                                api.sendMessage(`Thành viên ${senderName} đã bị kick vì gửi link trái phép.`, threadID);
                            });
                        }
                        if (settings.antiTag) {
                            const mentionCount = mentions ? Object.keys(mentions).length : 0;
                            if (mentionCount >= 10 || /@mọi người|@everyone|@all/i.test(body)) {
                                const senderName = await Users.getNameUser(senderID);
                                api.removeUserFromGroup(senderID, threadID, (err) => {
                                    if (err) return console.error(`[ANTI-TAG ERROR]`, err);
                                    api.sendMessage(`Thành viên ${senderName} đã bị kick vì tag all/tag quá nhiều.`, threadID);
                                });
                            }
                        }
                    }
                }
                else {
                    const reason = rentStatus.message;
                    let notification = "";
                    if ((type === "event" || type === "change_thread_image") && author && !isGroupAdmin) {
                         if ((logMessageType === "log:thread-image" || logMessageType === "log:thread-icon" || type === "change_thread_image") && settings.antiChangeGroupImage) {
                            notification = `⚠️ Tính năng [Chống Đổi Ảnh Nhóm] đang bật nhưng không thể thực thi do ${reason}.`;
                        }
                        switch (logMessageType) {
                            case "log:thread-name":
                                if (settings.antiChangeGroupName) notification = `⚠️ Tính năng [Chống Đổi Tên Nhóm] đang bật nhưng không thể thực thi do ${reason}.`;
                                break;
                            case "log:unsubscribe":
                                if (settings.antiOut && logMessageData.leftParticipantFbId === author) notification = `⚠️ Tính năng [Chống Out Chùa] đang bật nhưng không thể thực thi do ${reason}.`;
                                break;
                            case "log:subscribe":
                                if (settings.antiJoin) notification = `⚠️ Tính năng [Chống Thêm Thành Viên] đang bật nhưng không thể thực thi do ${reason}.`;
                                break;
                        }
                    }
                    if ((type === "message" || type === "message_reply") && body && !isGroupAdmin) {
                        if (settings.antiLink && /(http(s)?:\/\/.)/i.test(body)) {
                            notification = `⚠️ Tính năng [Chống Gửi Link] đang bật nhưng không thể thực thi do ${reason}.`;
                        }
                        if (settings.antiTag) {
                            const mentionCount = mentions ? Object.keys(mentions).length : 0;
                            if (mentionCount >= 10 || /@mọi người|@everyone|@all/i.test(body)) {
                                notification = `⚠️ Tính năng [Chống Tag All] đang bật nhưng không thể thực thi do ${reason}.`;
                            }
                        }
                    }
                    if(notification) api.sendMessage(`[BẢO VỆ NHÓM]\n${notification}`, threadID);
                }
            }
        }
    } catch (error) {
        console.error("[LISTEN CRITICAL ERROR]", error);
    }
    
    // ===== HỆ THỐNG KIỂM TRA THUÊ BOT CHO CÁC LỆNH =====
    if (event.type === "message" || event.type === "message_reply") {
        const isAdmin = [...(global.config.ADMINBOT || []), ...(global.config.NDH || [])].includes(event.senderID);
        
        if (!isAdmin && event.senderID != api.getCurrentUserID()) {
            const rentStatus = checkRentStatus(event.threadID);
            if (!rentStatus.active) {
                const prefix = (global.data.threadData.get(event.threadID) || {}).PREFIX || global.config.PREFIX;
                if ((event.body || "").startsWith(prefix)) {
                    return api.sendMessage(`❌ ${rentStatus.message}. Vui lòng liên hệ Admin để kích hoạt/gia hạn và sử dụng các lệnh của bot.`, event.threadID, event.messageID);
                }
            }
        }
    }
    
    const checkttDataPath = __dirname + "/../modules/commands/checktt/";
    setInterval(async () => {
      const day_now = moment.tz("Asia/Ho_Chi_Minh").day();
      if (day != day_now) {
        day = day_now;
        const checkttData = fs.readdirSync(checkttDataPath);
        console.log("--> CHECKTT: Ngày Mới");
        checkttData.forEach(async (checkttFile) => {
          const checktt = JSON.parse(fs.readFileSync(checkttDataPath + checkttFile));
          
          checktt.last.day = JSON.parse(JSON.stringify(checktt.day));
          checktt.day.forEach((e) => { e.count = 0; });
          checktt.time = day_now;
          fs.writeFileSync(checkttDataPath + checkttFile, JSON.stringify(checktt, null, 4));
        });
        global.client.sending_top = false;
      }
    }, 1000 * 10);

    switch (event.type) {
      case "message":
      case "message_reply":
      case "message_unsend":
        handleCreateDatabase({ event });
        handleCommand({ event });
        handleReply({ event });
        handleCommandEvent({ event });
        break;
      case "event":
        handleEvent({ event });
        handleRefresh({ event });
        if (global.config.notiGroup) {
          var msg = "";
          msg += event.logMessageBody;
          if (event.author == api.getCurrentUserID()) {
            msg = msg.replace("Bạn", global.config.BOTNAME);
          }
          return api.sendMessage({ body: `${msg}` }, event.threadID);
        }
        break;
      case "message_reaction":
        var { iconUnsend } = global.config;
        if (iconUnsend.status && event.senderID == api.getCurrentUserID() && event.reaction == iconUnsend.icon) {
          api.unsendMessage(event.messageID);
        }
        handleReaction({ event });
        break;
      default:
        break;
    }
  };
};
