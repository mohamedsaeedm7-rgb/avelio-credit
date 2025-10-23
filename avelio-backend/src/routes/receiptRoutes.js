const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { requireAuth } = require('../middleware/authMiddleware');
const { generateReceiptPDF } = require('../utils/pdfGenerator');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

router.use(requireAuth);

// POST /api/v1/receipts - Create new receipt
router.post('/', receiptController.createReceipt);

// GET /api/v1/receipts - Get all receipts (with filters)
router.get('/', receiptController.getReceipts);

// GET /api/v1/receipts/:id/pdf - Generate PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, a.agency_id as agency_code, a.agency_name 
       FROM receipts r
       JOIN agencies a ON r.agency_id = a.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found.'
      });
    }

    const receipt = result.rows[0];

    // Company information for PDF header
    const companyInfo = {
      name: 'KUSH AIR',
      tagline: 'Spirit of the South',
      address: 'Juba International Airport, P.O. Box 123, Juba, South Sudan',
      contacts: 'finance@kushair.com | +211 920 000 000',
      iata_code: 'K9',
      website: 'www.kushair.com'
    };

    // ✅ Load company logo
    let logoBuffer = null;
    try {
      const logoPath = path.join(__dirname, '../assets/logo.png');
      logoBuffer = fs.readFileSync(logoPath);
    } catch (error) {
      console.warn('Logo file not found, using text logo');
    }

    const pdfData = {
      receipt_number: receipt.receipt_number,
      issue_date: receipt.issue_date,
      issue_time: receipt.issue_time,
      station: receipt.station_code,
      agency: {
        agency_id: receipt.agency_code,
        agency_name: receipt.agency_name
      },
      amount: receipt.amount,
      currency: receipt.currency,
      payment_method: receipt.payment_method,
      status: receipt.status,
      payment_date: receipt.payment_date,
      issued_by: receipt.issued_by_name,
      company: companyInfo,
      company_logo: logoBuffer // ✅ Added logo to PDF data
    };

    const pdfBuffer = await generateReceiptPDF(pdfData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receipt-${receipt.receipt_number}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF.'
    });
  }
});

// GET /api/v1/receipts/:id - Get single receipt
router.get('/:id', receiptController.getReceiptById);

// PUT /api/v1/receipts/:id - Update receipt status
router.put('/:id', receiptController.updateReceiptStatus);

// DELETE /api/v1/receipts/:id - Void receipt
router.delete('/:id', receiptController.voidReceipt);

module.exports = router;