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

// Hàm chính để vẽ ảnh Itachi
async function createItachiImage({ imagePath, title, subtitle, roomType, line1, line2, bankingInfo }) {
    if (!require('fs').existsSync(imagePath)) throw new Error(`Không tìm thấy ảnh nền Itachi tại '${imagePath}'.`);
    
    const background = await loadImage(imagePath);
    const canvas = createCanvas(4800, 2700);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.font = 'bold 280px Prompt';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;
    drawTextWithStroke(ctx, title, 3260, 250, '#fff9f9', '#FFFFFF', 15);
    ctx.shadowColor = 'transparent';

    const subtitleY = 600;
    ctx.font = 'bold 170px Prompt';
    const subtitleGradient = ctx.createLinearGradient(0, subtitleY - 75, 0, subtitleY + 75);
    subtitleGradient.addColorStop(0, '#EAEAEA');
    subtitleGradient.addColorStop(0.5, '#FFFFFF');
    subtitleGradient.addColorStop(1, '#DCDCDC');
    drawTextWithStroke(ctx, subtitle, 3240, subtitleY, '#0E0101', subtitleGradient, 8);

    ctx.font = 'bold 130px Prompt';
    drawTextWithStroke(ctx, roomType.toUpperCase(), 3240, 890, '#fff9f9', '#FFFFFF', 8);
    drawTextWithStroke(ctx, line1, 3250, 1100, '#4CAF50', '#FFFFFF', 8);
    drawTextWithStroke(ctx, line2, 3250, 1270, '#FFC107', '#FFFFFF', 8);

    ctx.font = 'bold 95px Prompt';
    drawTextWithStroke(ctx, bankingInfo, 965, 2350, '#fff9f9', '#FFFFFF', 6);

    return canvas.toBuffer('image/png');
}

module.exports = createItachiImage;
