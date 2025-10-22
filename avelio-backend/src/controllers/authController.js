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
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid)
        return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.json({
        status: 'success',
        data: {
          token,
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed.' });
  }
};