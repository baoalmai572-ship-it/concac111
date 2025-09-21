const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const FONTS = [
    { filename: "Prompt-Bold.ttf", family: "Prompt" },
    { filename: "Prompt-Thin.ttf", family: "Prompt Thin" },
    { filename: "Prompt-ExtraBoldItalic.ttf", family: "PromptExtraBoldItalic" },
];

module.exports.draw = async function(data) {
    const { accountName, accountNo, qrImagePath, backgroundPath, cachePath, isCustomQr } = data;

    const background = await loadImage(backgroundPath);
    const canvas = createCanvas(background.width, background.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    for (const font of FONTS) {
        const fontPath = path.join(cachePath, font.filename);
        if (fs.existsSync(fontPath)) {
            registerFont(fontPath, { family: font.family });
        } else {
            console.error(`[QR-RIN-CANVAS] Không tìm thấy font: ${font.filename}`);
        }
    }

    let qrImage = await loadImage(qrImagePath);

    // ✨ [SỬA LỖI] Logic mới để chuẩn hóa ảnh QR
    // Nếu là ảnh setnotk, chúng ta sẽ tự thêm viền trong suốt cho nó
    if (isCustomQr) {
        const padding = 0.1; // 10% padding
        const qrCanvas = createCanvas(qrImage.width, qrImage.height);
        const qrCtx = qrCanvas.getContext('2d');
        
        // Vẽ nền trong suốt
        qrCtx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
        
        // Tính toán kích thước và vị trí của QR bên trong vùng đệm
        const innerSize = qrCanvas.width * (1 - padding * 2);
        const offset = qrCanvas.width * padding;
        
        // Vẽ ảnh QR gốc vào giữa, tạo ra một vùng đệm xung quanh
        qrCtx.drawImage(qrImage, offset, offset, innerSize, innerSize);
        
        // Gán lại qrImage bằng ảnh đã được thêm đệm
        qrImage = await loadImage(qrCanvas.toBuffer());
    }
    
    // Dòng này bây giờ sẽ vẽ các ảnh QR đã được chuẩn hóa, đảm bảo vị trí cố định
    ctx.drawImage(qrImage, 630, 930, 1140, 1140);


    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.save();
    
    ctx.setTransform(1, 0, -0.2, 1, 0, 0); 

    let nameY, accountNoY;

    if (isCustomQr) {
        nameY = 2500; 
        accountNoY = 2650;
    } else {
        nameY = 2500; 
        accountNoY = 2850;
    }

    const nameX = 1700;
    ctx.font = 'bold 120px PromptExtraBoldItalic';
    ctx.strokeText(accountName.toUpperCase(), nameX, nameY);
    ctx.fillText(accountName.toUpperCase(), nameX, nameY);

    const accountNoX = 1770; 
    ctx.font = 'bold 130px PromptExtraBoldItalic';
    ctx.strokeText(accountNo, accountNoX, accountNoY);
    ctx.fillText(accountNo, accountNoX, accountNoY);
    
    ctx.restore();
    
    const outputPath = path.join(cachePath, `final_qr_rin_${Date.now()}.png`);
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
    return outputPath;
};
