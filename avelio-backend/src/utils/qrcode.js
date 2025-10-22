const QRCode = require('qrcode');

/**
 * Generate QR code for receipt verification
 * @param {string} receiptNumber - The receipt number
 * @returns {Promise<string>} Base64 encoded QR code image
 */
async function generateReceiptQR(receiptNumber) {
  try {
    // Verification URL
    const verificationUrl = `https://avelio.app/verify/${receiptNumber}`;
    
    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H', // High error correction (30% redundancy)
      type: 'image/png',
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',  // Black
        light: '#FFFFFF'  // White
      }
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as buffer (for PDF embedding)
 * @param {string} receiptNumber - The receipt number
 * @returns {Promise<Buffer>} QR code as buffer
 */
async function generateReceiptQRBuffer(receiptNumber) {
  try {
    const verificationUrl = `https://avelio.app/verify/${receiptNumber}`;
    
    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 200,
      margin: 1
    });
    
    return qrCodeBuffer;
  } catch (error) {
    console.error('QR code buffer generation error:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

module.exports = {
  generateReceiptQR,
  generateReceiptQRBuffer
};