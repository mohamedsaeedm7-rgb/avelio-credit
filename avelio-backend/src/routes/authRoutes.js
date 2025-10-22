// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Import the whole controller object to avoid destructuring undefined
const authCtrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Safety checks (helpful while stabilizing)
if (typeof authCtrl.login !== 'function') {
  throw new Error('authController.login is not a function — check exports in controllers/authController.js');
}
if (typeof authCtrl.logout !== 'function') {
  // make logout no-op if missing, to avoid crash
  authCtrl.logout = (req, res) => res.json({ status: 'success' });
}
if (typeof authCtrl.changePassword !== 'function') {
  // temporary stub so route always has a callback
  authCtrl.changePassword = (req, res) =>
    res.status(501).json({ message: 'changePassword not implemented' });
}

// Public routes
router.post('/login', authCtrl.login);
router.post('/logout', authCtrl.logout);

// Protected route
router.post('/change-password', requireAuth, authCtrl.changePassword);

module.exports = router;