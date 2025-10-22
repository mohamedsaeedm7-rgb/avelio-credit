// src/routes/agencyRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAllAgencies,
  createAgency,
  createAgenciesBulk,
} = require('../controllers/agencyController');

router.get('/', getAllAgencies);
router.post('/', createAgency);
router.post('/bulk', createAgenciesBulk);

module.exports = router;