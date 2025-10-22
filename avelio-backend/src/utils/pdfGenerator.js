const PDFDocument = require('pdfkit');
const { generateReceiptQRBuffer } = require('./qrcode');

/** currency: USD only in current app, but keep generic + safe */
function formatCurrency(amount, currency = 'USD') {
  const n = isFinite(parseFloat(amount)) ? parseFloat(amount) : 0;
  const head = currency === 'USD' ? '$' : `${currency} `;
  return `${head}${n.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

function formatDate(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTimeHHMM(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function generateReceiptPDF(receiptData) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ===== Brand palette (Avelio/Kush Air aligned) =====
      const brandBlue = '#074973';
      const brandBlueDark = '#0B629A';
      const textDark = '#1A202C';
      const textGray = '#64748B';
      const borderGray = '#E2E8F0';
      const pageBgLite = '#F8FAFC';

      // Shortcuts with safe fallbacks
      const companyName = receiptData?.company?.name || 'KUSH AIR';
      const companyTag = receiptData?.company?.tagline || 'Credit Management';
      const companyAddr = receiptData?.company?.address || 'Head Office: Juba International Airport, South Sudan';
      const companyContacts = receiptData?.company?.contacts || 'finance@kushair.com | +211 920 000 000';
      const iataCode = receiptData?.company?.iata_code || '—';
      const station = receiptData?.station || '—';
      const receiptNo = receiptData?.receipt_number || '—';
      const status = (receiptData?.status || '').toUpperCase();
      const cashier = receiptData?.issued_by || 'Authorized Staff';
      const method = receiptData?.payment_method || 'CASH';
      const currency = (receiptData?.currency || 'USD').toUpperCase();
      const agencyName = receiptData?.agency?.agency_name || '—';
      const agencyId = receiptData?.agency?.agency_id || '—';
      const amount = receiptData?.amount || 0;

      // Times: local + UTC for audit (IATA finance best practice)
      const issuedAt = receiptData?.issue_date || new Date().toISOString();
      const paymentAt = receiptData?.payment_date || issuedAt;
      const localDateStr = formatDate(issuedAt);
      const localTimeStr = formatTimeHHMM(issuedAt);
      const utc = new Date(issuedAt);
      const utcTimeStr = `${String(utc.getUTCHours()).padStart(2,'0')}:${String(utc.getUTCMinutes()).padStart(2,'0')} UTC`;

      // ===== HEADER BAR =====
      // full-bleed band
      doc.save();
      doc.rect(0, 0, doc.page.width, 100).fill(brandBlue);
      doc.restore();

      // Optional logo (Buffer/base64). Draw small white logo if provided.
      if (receiptData?.company_logo) {
        try {
          doc.image(receiptData.company_logo, 50, 20, { width: 54, height: 54, fit: [54, 54] });
        } catch (_) { /* ignore bad logo buffer */ }
      } else {
        // simple glyph fallback (roundel)
        doc.save()
          .circle(77, 47, 24)
          .fill('#FFFFFF')
          .fillColor(brandBlue)
          .restore();
      }

      // Company & tag
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold').fontSize(22)
        .text(companyName, 120, 26, { width: 280 });
      doc
        .font('Helvetica-Oblique').fontSize(10)
        .text(companyTag, 120, 55);

      // Receipt title + number (right)
      doc
        .font('Helvetica-Bold').fontSize(12)
        .text('CREDIT DEPOSIT RECEIPT', 350, 28, { width: 190, align: 'right' });
      doc
        .font('Helvetica').fontSize(10)
        .text(receiptNo, 350, 48, { width: 190, align: 'right' });

      // ===== DOCUMENT INFO STRIP =====
      doc
        .fontSize(9).fillColor(textGray).font('Helvetica')
        .text('OFFICIAL PAYMENT RECEIPT • IATA CASH HANDLING COMPLIANT', 50, 112, { align: 'left' });
      doc
        .text(`Issue: ${localDateStr} ${localTimeStr}  •  ${utcTimeStr}`, 340, 112, { width: 205, align: 'right' });

      // Separator
      doc.moveTo(50, 135).lineTo(545, 135).lineWidth(1).strokeColor(borderGray).stroke();

      // ===== TWO-COLUMN: AGENCY & TRANSACTION =====
      const col1X = 50;
      const col2X = 320;
      let y = 155;

      // Left column — Agency
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text('AGENCY INFORMATION', col1X, y);
      doc.moveTo(col1X, y + 13).lineTo(col1X + 120, y + 13).lineWidth(2).strokeColor(brandBlue).stroke();
      y += 22;

      doc.font('Helvetica').fontSize(9).fillColor(textGray).text('Agency Name', col1X, y);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark).text(agencyName, col1X, y + 12, { width: 230 });
      y += 32;

      doc.font('Helvetica').fontSize(9).fillColor(textGray).text('Account ID', col1X, y);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark).text(agencyId, col1X, y + 12);
      y += 30;

      // Right column — Transaction
      let rY = 155;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text('TRANSACTION DETAILS', col2X, rY);
      doc.moveTo(col2X, rY + 13).lineTo(col2X + 120, rY + 13).lineWidth(2).strokeColor(brandBlue).stroke();
      rY += 22;

      // small key facts table: Date, Method, Currency, Station, Cashier
      const kv = [
        ['Date', `${localDateStr}`],
        ['Time', `${localTimeStr}  (${utcTimeStr})`],
        ['Method', method],
        ['Currency', currency],
        ['Station', station],
        ['Cashier', cashier]
      ];
      doc.font('Helvetica').fontSize(9).fillColor(textGray);
      kv.forEach(([k, v], i) => {
        const rowY = rY + (i * 22);
        doc.text(k + ':', col2X, rowY);
        doc.font('Helvetica-Bold').fillColor(textDark).text(v, col2X + 60, rowY, { width: 165, align: 'left' });
        doc.font('Helvetica').fillColor(textGray);
      });

      // ===== AMOUNT BAND =====
      const amtY = 320;
      doc.save();
      doc.roundedRect(50, amtY, 495, 78, 8).fill(pageBgLite);
      doc.restore();
      doc.roundedRect(50, amtY, 495, 78, 8).strokeColor(borderGray).lineWidth(1).stroke();

      doc.font('Helvetica-Bold').fontSize(10).fillColor(textGray)
        .text('CREDIT DEPOSIT AMOUNT', 70, amtY + 12);
      doc.font('Helvetica-Bold').fontSize(34).fillColor(brandBlue)
        .text(formatCurrency(amount, currency), 70, amtY + 32);

      // ===== VERIFICATION =====
      let vY = 420;
      doc.moveTo(50, vY).lineTo(545, vY).lineWidth(1).strokeColor(borderGray).stroke();
      vY += 16;

      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark)
        .text('VERIFICATION & AUTHORIZATION', 50, vY);
      doc.moveTo(50, vY + 13).lineTo(195, vY + 13).lineWidth(2).strokeColor(brandBlue).stroke();
      vY += 24;

      // QR (left)
      try {
        const qrBuffer = await generateReceiptQRBuffer(receiptNo);
        doc.image(qrBuffer, 50, vY, { width: 90, height: 90 });
        doc.font('Helvetica').fontSize(8).fillColor(textGray)
          .text('Scan to verify receipt', 50, vY + 92, { width: 90, align: 'center' });
      } catch (_) {
        // ignore QR errors
      }

      // Online stamp (center/right)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(brandBlue)
        .text('GENERATED ONLINE', 170, vY + 6);
      doc.font('Helvetica').fontSize(8).fillColor(textGray)
        .text(`Ref: ${receiptNo}`, 170, vY + 22);
      doc.text(`Payment status: ${status || '—'}`, 170, vY + 36);
      doc.text(`Processed: ${formatDate(paymentAt)} ${formatTimeHHMM(paymentAt)}`, 170, vY + 50);

      // Paid stamp (boxed) only when PAID
      if (status === 'PAID') {
        const sx = 370, sy = vY - 4, sw = 170, sh = 96;
        doc.roundedRect(sx, sy, sw, sh, 8).strokeColor(brandBlue).lineWidth(2).stroke();
        doc.font('Helvetica-Bold').fontSize(10).fillColor(brandBlue)
          .text(companyName.toUpperCase(), sx, sy + 10, { width: sw, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(24).fillColor(brandBlue)
          .text('PAID', sx, sy + 32, { width: sw, align: 'center' });
        doc.font('Helvetica').fontSize(8).fillColor(textDark)
          .text(formatDate(paymentAt), sx, sy + 64, { width: sw, align: 'center' });
      }

      // ===== SIGNATURE =====
      let sY = 560;
      doc.font('Helvetica').fontSize(9).fillColor(textGray).text('Authorized Signature', 50, sY);
      sY += 18;
      doc.font('Helvetica-BoldOblique').fontSize(18).fillColor(textDark).text(cashier, 60, sY);
      sY += 4;
      doc.moveTo(60, sY).lineTo(250, sY).lineWidth(0.6).strokeColor('#C7CED9').stroke();
      sY += 10;
      doc.font('Helvetica').fontSize(8).fillColor(textGray).text(`${cashier}`, 60, sY);
      doc.text(`Finance | ${companyName}`, 60, sY + 12);

      // ===== FOOTER / IATA COMPLIANCE INFO =====
      let fY = 670;
      doc.moveTo(50, fY).lineTo(545, fY).lineWidth(1).strokeColor(borderGray).stroke();
      fY += 12;

      // Two-line compliance + company info
      doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark)
        .text('TERMS & COMPLIANCE', 50, fY);
      fY += 14;

      doc.font('Helvetica').fontSize(8).fillColor(textGray)
        .text('• Cash receipt issued electronically by Avelio Credit Management System; verifiable via QR.', 50, fY);
      fY += 11;
      doc.text('• Aligns with IATA Financial Reporting – Cash Handling (Sec. 8.3). Records are immutable once issued.', 50, fY);
      fY += 11;
      doc.text('• Credit validity and refund policy per airline–agency agreement; FIFO application of credit.', 50, fY);

      fY += 14;
      doc.text(`${companyAddr}`, 50, fY);
      fY += 11;
      doc.text(`IATA Code: ${iataCode}  •  Contact: ${companyContacts}`, 50, fY);

      fY += 16;
      doc.moveTo(50, fY).lineTo(545, fY).lineWidth(0.5).strokeColor(borderGray).stroke();
      fY += 8;
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#94A3B8')
        .text('Powered by Avelio Credit Management System • avelio.tech', 0, fY, { width: doc.page.width, align: 'center' });

      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      reject(err);
    }
  });
}

module.exports = { generateReceiptPDF };