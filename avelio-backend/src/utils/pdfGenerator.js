const PDFDocument = require('pdfkit');
const { generateReceiptQRBuffer } = require('./qrcode');
const fs = require('fs');
const path = require('path');

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

/** Convert integer part of amount to words (supports up to 999,999,999) */
function numberToWords(num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'zero';
  const a = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const b = ['','', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function chunk(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? '-' + a[n%10] : '');
    if (n < 1000) return a[Math.floor(n/100)] + ' hundred' + (n%100 ? ' ' + chunk(n%100) : '');
    return '';
  }
  const thousands = [
    {v: 1_000_000_000, name: 'billion'},
    {v: 1_000_000, name: 'million'},
    {v: 1_000, name: 'thousand'},
    {v: 1, name: ''}
  ];
  let out = '';
  let remaining = num;
  for (const t of thousands) {
    if (remaining >= t.v) {
      const count = Math.floor(remaining / t.v);
      remaining = remaining % t.v;
      if (t.name) {
        out += `${chunk(count)} ${t.name} `;
      } else {
        out += `${chunk(count)} `;
      }
    }
  }
  return out.trim();
}

async function generateReceiptPDF(receiptData) {
  return new Promise(async (resolve, reject) => {
    try {
      // create doc
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 48, bottom: 48, left: 48, right: 48 },
        autoFirstPage: false
      });

      // register optional premium fonts if available (swap to your uploaded fonts if desired)
      try {
        const fontsDir = path.join(__dirname, '../assets/fonts');
        if (fs.existsSync(path.join(fontsDir, 'Inter-Regular.ttf'))) {
          doc.registerFont('UI-Regular', path.join(fontsDir, 'Inter-Regular.ttf'));
          doc.registerFont('UI-Bold', path.join(fontsDir, 'Inter-Bold.ttf'));
          doc.registerFont('UI-Italic', path.join(fontsDir, 'Inter-Italic.ttf'));
        } else {
          // fallback to built-in fonts
          doc.registerFont('UI-Regular', 'Helvetica');
          doc.registerFont('UI-Bold', 'Helvetica-Bold');
          doc.registerFont('UI-Italic', 'Helvetica-Oblique');
        }
      } catch (e) {
        doc.registerFont('UI-Regular', 'Helvetica');
        doc.registerFont('UI-Bold', 'Helvetica-Bold');
        doc.registerFont('UI-Italic', 'Helvetica-Oblique');
      }

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // brand palette — refined, modern, neutral
      const PRIMARY = '#0B5F8A';       // deep teal/blue
      const ACCENT = '#00A6C7';        // bright accent
      const TEXT = '#0F1724';          // near-black
      const MUTED = '#6B7280';         // muted gray
      const SOFT = '#F3FBFF';          // soft background tint
      const CARD = '#FFFFFF';
      const BORDER = '#E6EEF4';

      // Shortcuts + safe fallbacks
      const companyName = receiptData?.company?.name || 'KUSH AIR';
      const companyTag = receiptData?.company?.tagline || 'Spirit of the South';
      const companyAddr = receiptData?.company?.address || 'Juba International Airport, P.O. Box 123, Juba, South Sudan';
      const companyContacts = receiptData?.company?.contacts || 'finance@kushair.com | +211 920 000 000';
      const iataCode = receiptData?.company?.iata_code || 'K9';
      const station = receiptData?.station || '—';
      const receiptNo = receiptData?.receipt_number || '—';
      const status = (receiptData?.status || '').toUpperCase();
      const cashier = receiptData?.issued_by || 'Authorized Staff';
      const method = receiptData?.payment_method || 'CASH';
      const currency = (receiptData?.currency || 'USD').toUpperCase();
      const agencyName = receiptData?.agency?.agency_name || '—';
      const agencyId = receiptData?.agency?.agency_id || '—';
      const amount = Number(receiptData?.amount || 0);

      // Times
      const issuedAt = receiptData?.issue_date || new Date().toISOString();
      const paymentAt = receiptData?.payment_date || issuedAt;
      const localDateStr = formatDate(issuedAt);
      const localTimeStr = formatTimeHHMM(issuedAt);
      const utc = new Date(issuedAt);
      const utcTimeStr = `${String(utc.getUTCHours()).padStart(2,'0')}:${String(utc.getUTCMinutes()).padStart(2,'0')} UTC`;

      // Add first page
      doc.addPage();

      // subtle page background strip top
      doc.rect(doc.page.margins.left, doc.page.margins.top - 12, doc.page.width - doc.page.margins.left - doc.page.margins.right, 88)
         .fillOpacity(1)
         .fill(SOFT);

      // Header area (logo left, company center-left, actions right)
      const headerY = doc.page.margins.top - 4;
      // Draw logo box with rounded background
      if (receiptData?.company_logo) {
        try {
          // logo container
          const logoX = doc.page.margins.left + 6;
          const logoY = headerY + 6;
          const logoSize = 64;
          // background rounded rect
          doc.roundedRect(logoX - 6, logoY - 6, logoSize + 12, logoSize + 12, 10)
             .fill('#FFFFFF');
          // draw logo (allow fit)
          doc.image(receiptData.company_logo, logoX, logoY, { fit: [logoSize, logoSize], align: 'center', valign: 'center' });
        } catch (e) {
          // fallback: circle glyph
          doc.circle(doc.page.margins.left + 40, headerY + 38, 30).fill(PRIMARY);
          doc.fillColor('#fff').font('UI-Bold').fontSize(20).text(companyName.charAt(0), doc.page.margins.left + 28, headerY + 20);
        }
      } else {
        // glyph fallback
        doc.circle(doc.page.margins.left + 40, headerY + 38, 30).fill(PRIMARY);
        doc.fillColor('#fff').font('UI-Bold').fontSize(20).text(companyName.charAt(0), doc.page.margins.left + 28, headerY + 20);
      }

      // Company name + tagline
      doc.fillColor(TEXT).font('UI-Bold').fontSize(18).text(companyName, doc.page.margins.left + 92, headerY + 8, { continued: false });
      doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text(companyTag, doc.page.margins.left + 92, headerY + 30);

      // Right: receipt title and status badge
      const rightX = doc.page.width - doc.page.margins.right - 220;
      doc.font('UI-Bold').fontSize(12).fillColor(PRIMARY).text('RECEIPT', rightX, headerY + 8, { align: 'right', width: 200 });
      doc.font('UI-Regular').fontSize(10).fillColor(MUTED).text(`No: ${receiptNo}`, rightX, headerY + 28, { align: 'right', width: 200 });

      // Status badge
      const badgeText = status || 'PENDING';
      const badgeW = 86, badgeH = 22;
      const bx = doc.page.width - doc.page.margins.right - badgeW;
      const by = headerY + 52;
      doc.roundedRect(bx, by, badgeW, badgeH, 6).fillOpacity(1).fill(status === 'PAID' ? ACCENT : '#FEEBC8');
      doc.fillColor(status === 'PAID' ? '#fff' : '#92400E').font('UI-Bold').fontSize(10)
         .text(badgeText, bx, by + 6, { width: badgeW, align: 'center' });

      // Horizontal meta info row
      const metaY = headerY + 96;
      doc.moveTo(doc.page.margins.left, metaY).lineTo(doc.page.width - doc.page.margins.right, metaY).strokeOpacity(0.06).lineWidth(1).stroke();

      // Two card columns: Agency (left), Transaction (right)
      const leftX = doc.page.margins.left;
      const mid = doc.page.width / 2;
      const rightColX = mid + 8;
      const cardW = mid - doc.page.margins.left - 12;

      // Agency Card
      const cardY = metaY + 12;
      const cardH = 140;
      doc.roundedRect(leftX, cardY, cardW, cardH, 8).fill(CARD).stroke(BORDER);
      // agency text
      doc.fillColor(MUTED).font('UI-Regular').fontSize(9).text('Agency', leftX + 16, cardY + 12);
      doc.font('UI-Bold').fontSize(12).fillColor(TEXT).text(agencyName, leftX + 16, cardY + 28, { width: cardW - 32 });

      doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text('Agency ID', leftX + 16, cardY + 68);
      doc.font('UI-Bold').fontSize(11).fillColor(TEXT).text(agencyId, leftX + 16, cardY + 84);

      // Transaction Card
      doc.roundedRect(rightColX, cardY, cardW, cardH, 8).fill(CARD).stroke(BORDER);
      doc.fillColor(MUTED).font('UI-Regular').fontSize(9).text('Transaction', rightColX + 16, cardY + 12, { continued: false });
      doc.font('UI-Bold').fontSize(12).fillColor(TEXT).text(formatCurrency(amount, currency), rightColX + 16, cardY + 28, { width: cardW - 32 });

      // transaction small rows
      const tStartY = cardY + 56;
      const kv = [
        ['Date', `${localDateStr}`],
        ['Time', `${localTimeStr} (${utcTimeStr})`],
        ['Method', method],
        ['Currency', currency],
        ['Station', station],
        ['Cashier', cashier]
      ];
      doc.font('UI-Regular').fontSize(9).fillColor(MUTED);
      kv.forEach((row, i) => {
        const ry = tStartY + (i * 16);
        doc.fillColor(MUTED).font('UI-Regular').fontSize(9).text(`${row[0]}`, rightColX + 16, ry);
        doc.font('UI-Bold').fontSize(9).fillColor(TEXT).text(row[1], rightColX + 110, ry, { width: cardW - 130, align: 'left' });
      });

      // Amount band full-width card below
      const amtY = cardY + cardH + 18;
      const amtH = 84;
      doc.roundedRect(leftX, amtY, doc.page.width - doc.page.margins.left - doc.page.margins.right, amtH, 10).fill(SOFT).stroke(BORDER);
      doc.fillColor(MUTED).font('UI-Regular').fontSize(9).text('Amount (in figures)', leftX + 20, amtY + 14);
      doc.font('UI-Bold').fontSize(28).fillColor(PRIMARY).text(formatCurrency(amount, currency), leftX + 20, amtY + 30);

      // amount in words (right side of band)
      const words = `${numberToWords(amount)} ${currency === 'USD' ? 'dollars' : currency}`.replace(/\s+/g,' ');
      doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text('Amount (in words)', doc.page.width - doc.page.margins.right - 260, amtY + 14, { width: 240, align: 'right' });
      doc.font('UI-Bold').fontSize(10).fillColor(TEXT).text(words.charAt(0).toUpperCase() + words.slice(1), doc.page.width - doc.page.margins.right - 260, amtY + 32, { width: 240, align: 'right' });

      // Verification area (QR + Reference + Paid stamp)
      const vY = amtY + amtH + 18;
      // left: QR
      try {
        const qrBuffer = await generateReceiptQRBuffer(receiptNo);
        doc.roundedRect(leftX, vY, 120, 120, 8).fill('#fff').stroke(BORDER);
        doc.image(qrBuffer, leftX + 12, vY + 12, { fit: [96, 96] });
        doc.font('UI-Regular').fontSize(8).fillColor(MUTED).text('Scan to verify', leftX, vY + 112, { width: 120, align: 'center' });
      } catch (e) {
        // ignore QR errors
      }

      // center: refs
      const refX = leftX + 144;
      doc.font('UI-Bold').fontSize(11).fillColor(TEXT).text('Verification & Details', refX, vY + 8);
      doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text(`Reference: ${receiptNo}`, refX, vY + 30);
      doc.text(`Issued: ${localDateStr} ${localTimeStr}`, refX, vY + 46);
      doc.text(`Processed: ${formatDate(paymentAt)} ${formatTimeHHMM(paymentAt)}`, refX, vY + 62);
      doc.text(`IATA Code: ${iataCode}`, refX, vY + 78);

      // right: paid box / status
      const statusBoxW = 170;
      const statusX = doc.page.width - doc.page.margins.right - statusBoxW;
      doc.roundedRect(statusX, vY, statusBoxW, 120, 8).fill('#fff').stroke(BORDER);
      if (status === 'PAID') {
        doc.fillColor(ACCENT).font('UI-Bold').fontSize(20).text('PAID', statusX, vY + 18, { width: statusBoxW, align: 'center' });
        doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text(companyName, statusX, vY + 48, { width: statusBoxW, align: 'center' });
        doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text(formatDate(paymentAt), statusX, vY + 64, { width: statusBoxW, align: 'center' });
      } else {
        doc.fillColor('#374151').font('UI-Bold').fontSize(14).text(status || 'PENDING', statusX, vY + 28, { width: statusBoxW, align: 'center' });
        doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text('Awaiting settlement', statusX, vY + 56, { width: statusBoxW, align: 'center' });
      }

      // Signature line & small notes
      const sY = vY + 140;
      doc.moveTo(leftX + 6, sY).lineTo(leftX + 220, sY).strokeOpacity(0.12).stroke();
      doc.font('UI-Regular').fontSize(9).fillColor(MUTED).text('Authorized signature', leftX + 6, sY + 8);
      doc.font('UI-Bold').fontSize(10).fillColor(TEXT).text(cashier, leftX + 6, sY + 24);

      // footer: compliance & contact (muted)
      const fY = sY + 58;
      doc.moveTo(doc.page.margins.left, fY).lineTo(doc.page.width - doc.page.margins.right, fY).strokeOpacity(0.06).lineWidth(1).stroke();
      const footerText = [
        'This receipt is electronically generated and verifiable via the QR code.',
        'Aligns with IATA financial handling practices. Records are immutable once issued.',
        `Contact: ${companyContacts} • ${companyAddr}`
      ].join('  •  ');
      doc.font('UI-Regular').fontSize(8).fillColor(MUTED).text(footerText, doc.page.margins.left, fY + 10, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' });

      // end
      doc.end();

    } catch (err) {
      console.error('PDF generation error:', err);
      reject(err);
    }
  });
}

module.exports = { generateReceiptPDF };