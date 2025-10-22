const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { requireAuth } = require('../middleware/authMiddleware');

// All export routes require authentication
router.use(requireAuth);

// GET /api/v1/export/receipts - Export receipts to CSV
router.get('/receipts', exportController.exportToCSV);

// GET /api/v1/export/summary - Export summary by agency to CSV
router.get('/summary', exportController.exportSummaryCSV);

module.exports = router;