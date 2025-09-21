module.exports.config = {
    name: "locmem",
    version: "1.3.1", // Final version
    hasPermssion: 1,
    credits: "MewMew (Fixed by Gemini for custom 'check' module)",
    description: "Lọc thành viên theo số tin nhắn, đồng bộ với module 'check'.",
    commandCategory: "Nhóm",
    usages: "locmem [số tin nhắn]",
    cooldowns: 10,
    dependencies: {
        "fs-extra": ""
    }
};

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID } = event;
    const fs = require('fs-extra');
    
    // Đường dẫn ĐÚNG đến thư mục dữ liệu của module 'check', nằm cùng cấp với file lệnh
    const checkttPath = __dirname + '/checktt/'; 
    const dataPath = checkttPath + threadID + '.json';

    // Kiểm tra xem file dữ liệu có tồn tại không
    if (!fs.existsSync(dataPath)) {
        return api.sendMessage("⚠️ Chưa có dữ liệu tương tác cho nhóm này (từ module 'check').", threadID, messageID);
    }

    // Đọc trực tiếp file dữ liệu của module 'check'
    const threadDataJSON = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Lấy mảng 'total' chứa tổng số tin nhắn
    const allUsersInData = threadDataJSON.total || [];

    let threadInfo;
    try {
        threadInfo = await api.getThreadInfo(threadID);
    } catch (e) {
        console.error(e);
        return api.sendMessage("Đã xảy ra lỗi khi lấy thông tin nhóm.", threadID, messageID);
    }

    const botIsAdmin = threadInfo.adminIDs.some(admin => admin.id === api.getCurrentUserID());
    if (!botIsAdmin) {
        return api.sendMessage("Bot cần là quản trị viên của nhóm để có thể lọc thành viên.", threadID, messageID);
    }

    const messageCount = parseInt(args[0]) || 0;
    const listUser = [];

    // Lặp qua dữ liệu từ file checktt.json để tìm người cần lọc
    for (const user of allUsersInData) {
        // user ở đây có dạng { id: "...", count: ... }
        if (user.count == messageCount) {
            listUser.push(user.id);
        }
    }
    
    // Lọc ra các quản trị viên và bot khỏi danh sách bị kick
    const adminIDs = threadInfo.adminIDs.map(admin => admin.id);
    const usersToKick = listUser.filter(uid => !adminIDs.includes(uid) && uid != api.getCurrentUserID());

    if (usersToKick.length === 0) {
        return api.sendMessage(`✅ Không tìm thấy thành viên nào có chính xác ${messageCount} tin nhắn trong dữ liệu của module 'check'.`, threadID, messageID);
    }

    api.sendMessage(`🔍 Phát hiện ${usersToKick.length} thành viên có ${messageCount} tin nhắn. Bắt đầu lọc...`, threadID, async () => {
        let successCount = 0;
        let failCount = 0;

        for (const userID of usersToKick) {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1 giây
                await api.removeUserFromGroup(userID, threadID);
                successCount++;
            } catch (e) {
                console.error(`Lỗi khi lọc user ID: ${userID}`, e);
                failCount++;
            }
        }

        let resultMessage = `✅ Đã lọc thành công ${successCount} thành viên.`;
        if (failCount > 0) {
            resultMessage += `\n❌ Lọc thất bại ${failCount} thành viên.`;
        }
        api.sendMessage(resultMessage, threadID);
    });
};
