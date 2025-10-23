const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const client = await pool.connect();
    try {
      const userRes = await client.query('SELECT * FROM users WHERE email=$1', [email]);
      if (userRes.rowCount === 0)
        return res.status(400).json({ message: 'Invalid credentials' });

      const user = userRes.rows[0];
      
      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({ message: 'Account is inactive' });
      }
      
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid)
        return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key-change-this',
        { expiresIn: '12h' }
      );

      res.json({
        status: 'success',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            employee_id: user.employee_id,
            station_code: user.station_code,
            role: user.role,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
};

exports.logout = (req, res) => {
  res.json({ 
    status: 'success',
    message: 'Logged out successfully' 
  });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    const client = await pool.connect();
    try {
      const userRes = await client.query('SELECT * FROM users WHERE id=$1', [userId]);
      if (userRes.rowCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = userRes.rows[0];
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!valid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await client.query(
        'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
        [hashedPassword, userId]
      );

      res.json({ 
        status: 'success',
        message: 'Password changed successfully' 
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      message: 'Failed to change password',
      error: err.message 
    });
  }
};