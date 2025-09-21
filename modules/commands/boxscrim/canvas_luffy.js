const { createCanvas, loadImage } = require('canvas');

// Hàm helper để vẽ chữ có viền
function drawTextWithStroke(ctx, text, x, y, strokeColor, textColor, lineWidth) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
}

// Hàm chính để vẽ ảnh Luffy
async function createLuffyImage({ imagePath, title, subtitle, roomType, line1, line2, bankingInfo }) {
    if (!require('fs').existsSync(imagePath)) throw new Error(`Không tìm thấy ảnh nền Luffy tại '${imagePath}'.`);
    
    const background = await loadImage(imagePath);
    const canvas = createCanvas(4800, 2700);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    
    // Đặt textAlign mặc định là center cho các dòng trên
    ctx.textAlign = 'center';

    const titleY = 250;
    ctx.font = 'bold 280px Prompt';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;
    drawTextWithStroke(ctx, title, 3350, titleY, '#120101', '#FFFFFF', 15);
    ctx.shadowColor = 'transparent';

    // PHẦN ĐÃ SỬA LẠI
    const subtitleY = 568;
    ctx.font = 'bold 150px Prompt';
    const subtitleGradient = ctx.createLinearGradient(0, subtitleY - 75, 0, subtitleY + 75);
    subtitleGradient.addColorStop(0, '#EAEAEA');
    subtitleGradient.addColorStop(0.5, '#FFFFFF');
    subtitleGradient.addColorStop(1, '#DCDCDC');
    
    // Chuyển sang căn lề trái
    ctx.textAlign = 'left';
    
    // Cập nhật tọa độ X thành 3200
    drawTextWithStroke(ctx, subtitle, 2910, subtitleY, '#000000', subtitleGradient, 8);
    // KẾT THÚC PHẦN SỬA

    // Quay lại căn lề giữa cho các dòng tiếp theo
    ctx.textAlign = 'center';
    ctx.font = 'bold 130px Prompt';
    drawTextWithStroke(ctx, roomType.toUpperCase(), 3300, 870, '#FFFFFF', '#FFFFFF', 8);
    drawTextWithStroke(ctx, line1, 3270, 1100, '#4CAF50', '#FFFFFF', 8);
    drawTextWithStroke(ctx, line2, 3270, 1270, '#FFC107', '#FFFFFF', 8);

    // Chuyển sang căn lề trái cho dòng cuối
    ctx.textAlign = 'left';
    ctx.font = 'bold 95px Prompt';
    drawTextWithStroke(ctx, bankingInfo, 360, 2350, '#9E9E9E', '#FFFFFF', 6);

    return canvas.toBuffer('image/png');
}

module.exports = createLuffyImage;
