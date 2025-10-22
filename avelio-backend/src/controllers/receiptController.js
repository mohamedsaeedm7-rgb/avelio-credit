const db = require('../config/db');
const { generateReceiptQR } = require('../utils/qrcode');

// Generate receipt number
// Format: KSH-CR-JUB-20251015-0001
function generateReceiptNumber(stationCode) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  
  return `KSH-CR-${stationCode}-${year}${month}${day}-${random}`;
}

// CREATE RECEIPT
const createReceipt = async (req, res) => {
  try {
    const { agency_id, amount, currency, payment_method, status, remarks, due_date } = req.body;
    const user = req.user; // From auth middleware

    // Debug logging
    console.log('📥 Received request body:', req.body);
    console.log('🔍 agency_id value:', agency_id);
    console.log('🔍 agency_id type:', typeof agency_id);

    // Validate required fields
    if (!agency_id || !amount || !status) {
      return res.status(400).json({
        success: false,
        message: 'Agency ID, amount, and status are required.'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0.'
      });
    }

    // Check if agency exists - Handle both UUID id and agency_id code
    console.log('🔎 Looking for agency with value:', agency_id);
    
    // Try to determine if it's a UUID or agency_id code
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agency_id);
    
    let agencyCheck;
    if (isUUID) {
      // It's a UUID, search by id
      agencyCheck = await db.query(
        'SELECT id, agency_name, agency_id FROM agencies WHERE id = $1 AND is_active = true',
        [agency_id]
      );
    } else {
      // It's an agency_id code, search by agency_id
      agencyCheck = await db.query(
        'SELECT id, agency_name, agency_id FROM agencies WHERE agency_id = $1 AND is_active = true',
        [agency_id]
      );
    }
    
    console.log('📋 Query result:', agencyCheck.rows);

    if (agencyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agency not found.'
      });
    }

    const agency = agencyCheck.rows[0];

    // Generate receipt number
    const stationCode = user.station || user.station_code || 'JUB'; // Fallback to JUB
    const receiptNumber = generateReceiptNumber(stationCode);
    
    console.log('👤 User object:', user);
    console.log('🏢 Station code:', stationCode);

    // Get current date and time in Africa/Juba timezone
    const now = new Date();
    
    // Get date/time components in Africa/Juba timezone
    const jubaDateTimeStr = now.toLocaleString('sv-SE', { 
      timeZone: 'Africa/Juba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Format: "YYYY-MM-DD HH:MM:SS"
    const [issueDate, issueTime] = jubaDateTimeStr.split(' ');

    // Set payment date if status is PAID
    const paymentDate = status === 'PAID' ? now.toISOString() : null;

    // Insert receipt
    const result = await db.query(
      `INSERT INTO receipts 
       (receipt_number, agency_id, user_id, amount, currency, payment_method, status, 
        issue_date, issue_time, payment_date, due_date, station_code, issued_by_name, remarks, is_synced) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        receiptNumber,
        agency.id,
        user.id || user.user_id,
        amount,
        currency || 'USD',
        payment_method,
        status,
        issueDate,
        issueTime,
        paymentDate,
        due_date,
        stationCode, // Use the fallback station code
        user.name || user.username || user.full_name || 'Staff', // Fallback for name
        remarks,
        true
      ]
    );

    const receipt = result.rows[0];

    // Generate QR code
    let qrCode = null;
    try {
      qrCode = await generateReceiptQR(receiptNumber);
    } catch (qrError) {
      console.error('QR generation failed:', qrError);
      // Continue without QR code
    }

    // Return success with receipt data
    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: {
        receipt: {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          agency: {
            id: agency.id,
            agency_id: agency.agency_id,
            agency_name: agency.agency_name
          },
          amount: parseFloat(receipt.amount),
          currency: receipt.currency,
          status: receipt.status,
          payment_method: receipt.payment_method,
          issue_date: receipt.issue_date,
          issue_time: receipt.issue_time,
          payment_date: receipt.payment_date,
          station: receipt.station_code,
          issued_by: receipt.issued_by_name,
          created_at: receipt.created_at,
          qr_code: qrCode
        }
      }
    });

  } catch (error) {
    console.error('Create receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create receipt.'
    });
  }
};

// GET ALL RECEIPTS
const getReceipts = async (req, res) => {
  try {
    const { status, agency_id, date_from, date_to, page = 1, pageSize = 20 } = req.query;

    // Calculate pagination
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    // Build base query for counting total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM receipts r
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.is_void = false
    `;

    // Build query for data
    let query = `
      SELECT r.*, a.agency_id as agency_code, a.agency_name 
      FROM receipts r
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.is_void = false
    `;
    
    const params = [];
    let paramCount = 1;

    // Add filters (same for both queries)
    let filterClause = '';
    
    if (status) {
      filterClause += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (agency_id) {
      filterClause += ` AND a.agency_id = $${paramCount}`;
      params.push(agency_id);
      paramCount++;
    }

    if (date_from) {
      filterClause += ` AND r.issue_date >= $${paramCount}`;
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      filterClause += ` AND r.issue_date <= $${paramCount}`;
      params.push(date_to);
      paramCount++;
    }

    // Apply filters to both queries
    countQuery += filterClause;
    query += filterClause;

    // Get total count
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add ordering and pagination to data query
    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      total: total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      data: {
        receipts: result.rows.map(r => ({
          id: r.id,
          receipt_number: r.receipt_number,
          agency: {
            agency_id: r.agency_code,
            agency_name: r.agency_name
          },
          amount: parseFloat(r.amount),
          currency: r.currency,
          status: r.status,
          payment_method: r.payment_method,
          issue_date: r.issue_date,
          issue_time: r.issue_time,
          payment_date: r.payment_date,
          station: r.station_code,
          issued_by: r.issued_by_name
        }))
      }
    });

  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipts.'
    });
  }
};

// GET SINGLE RECEIPT
const getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, a.agency_id as agency_code, a.agency_name, a.contact_phone, a.contact_email
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

    const r = result.rows[0];

    res.json({
      success: true,
      data: {
        receipt: {
          id: r.id,
          receipt_number: r.receipt_number,
          agency: {
            agency_id: r.agency_code,
            agency_name: r.agency_name,
            contact_phone: r.contact_phone,
            contact_email: r.contact_email
          },
          amount: parseFloat(r.amount),
          currency: r.currency,
          status: r.status,
          payment_method: r.payment_method,
          issue_date: r.issue_date,
          issue_time: r.issue_time,
          payment_date: r.payment_date,
          due_date: r.due_date,
          station: r.station_code,
          issued_by: r.issued_by_name,
          remarks: r.remarks,
          is_void: r.is_void,
          created_at: r.created_at
        }
      }
    });

  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt.'
    });
  }
};

// UPDATE RECEIPT STATUS (Mark as Paid)
const updateReceiptStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_date } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    // Update receipt
    const result = await db.query(
      `UPDATE receipts 
       SET status = $1, payment_date = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 
       RETURNING *`,
      [status, payment_date || new Date().toISOString(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found.'
      });
    }

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      data: {
        receipt: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update receipt.'
    });
  }
};

// VOID RECEIPT (soft delete)
const voidReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Void reason is required.'
      });
    }

    // Check if receipt exists and is not already void
    const checkResult = await db.query(
      'SELECT id, receipt_number, is_void FROM receipts WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found.'
      });
    }

    const receipt = checkResult.rows[0];

    if (receipt.is_void) {
      return res.status(400).json({
        success: false,
        message: 'Receipt is already voided.'
      });
    }

    // Void the receipt
    const result = await db.query(
      `UPDATE receipts 
       SET is_void = true, void_reason = $1, void_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [reason, id]
    );

    res.json({
      success: true,
      message: 'Receipt voided successfully',
      data: {
        receipt_number: result.rows[0].receipt_number,
        void_reason: result.rows[0].void_reason,
        void_date: result.rows[0].void_date
      }
    });

  } catch (error) {
    console.error('Void receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void receipt.'
    });
  }
};

module.exports = {
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceiptStatus,
  voidReceipt
};