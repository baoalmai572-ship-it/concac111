const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const FONTS = [
    { filename: "Prompt-Bold.ttf", family: "Prompt" },
];

/**
 * Main drawing function for the layout.
 * @param {object} data - The data required to draw the image.
 * @returns {string} - The path to the created image file.
 */
module.exports.draw = async function(data) {
    const { accountName, accountNo, qrImagePath, backgroundPath, cachePath } = data;

    const background = await loadImage(backgroundPath);
    const canvas = createCanvas(background.width, background.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    for (const font of FONTS) {
        const fontPath = path.join(cachePath, font.filename);
        if (fs.existsSync(fontPath)) {
            registerFont(fontPath, { family: "Prompt", weight: 'bold' });
        } else {
            console.error(`[CANVAS] Font not found: ${font.filename}`);
        }
    }

    // ===================================
    // ===       KHU VỰC ĐIỀU CHỈNH      ===
    // ===================================

    // 1. Toạ độ & Kích thước QR
    const qrX = 2470;
    const qrY = 680;
    const qrSize = 1100;

    // 2. Toạ độ Số tài khoản
    const accountNoX = 2020;
    const accountNoY = 2030;

    // 3. Toạ độ Tên tài khoản
    const accountNameX = 2010;
    const accountNameY = 2160;
    
    // 4. Kích thước chữ (px)
    const accountNoSize = 100;
    const accountNameSize = 90;

    // 5. Màu sắc (Mã màu HEX)
    const accountNoColor = '#DD1C16';
    const accountNameColor = '#FFFFFF';
    const textColorStroke = '';

    // 6. Hiệu ứng
    const skewX = -0.3;
    const angleDegrees = 8;

    // ===================================

    // --- Vẽ ảnh QR ---
    try {
        const qrImage = await loadImage(qrImagePath);
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    } catch (error) {
        console.error(`[CANVAS] LỖI: Không thể tải ảnh QR từ đường dẫn: ${qrImagePath}.`);
    }
    
    const angleRadians = angleDegrees * Math.PI / 180;
    
    // --- Vẽ Số tài khoản ---
    ctx.save();
    ctx.translate(accountNoX, accountNoY);
    ctx.rotate(angleRadians);
    ctx.transform(1, 0, skewX, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = textColorStroke;
    ctx.font = `bold ${accountNoSize}px "Prompt"`; // Sử dụng biến kích thước
    ctx.fillStyle = accountNoColor;
    ctx.strokeText(accountNo, 0, 0);
    ctx.fillText(accountNo, 0, 0);
    ctx.restore();

    // --- Vẽ Tên tài khoản ---
    ctx.save();
    ctx.translate(accountNameX, accountNameY);
    ctx.rotate(angleRadians);
    ctx.transform(1, 0, skewX, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = textColorStroke;
    ctx.font = `bold ${accountNameSize}px "Prompt"`; // Sử dụng biến kích thước
    ctx.fillStyle = accountNameColor;
    ctx.strokeText(accountName.toUpperCase(), 0, 0);
    ctx.fillText(accountName.toUpperCase(), 0, 0);
    ctx.restore();
    
    const outputPath = path.join(cachePath, `final_qr_fixed_${Date.now()}.png`);
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
    return outputPath;
};

