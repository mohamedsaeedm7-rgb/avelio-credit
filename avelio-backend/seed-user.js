// Script to create a test user
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function createTestUser() {
  try {
    console.log('Creating test user...');

    // Hash the password
    const password = 'password123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users 
       (email, name, password_hash, employee_id, station_code, role, phone, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, email, name, station_code, role`,
      [
        'robert@kenyanstar.com',
        'Robert Kuol',
        hashedPassword,
        'EMP-2024-1234',
        'JUB',
        'sales_officer',
        '+211-XXX-XXXX',
        true
      ]
    );

    console.log('✅ Test user created successfully!');
    console.log('📋 User details:');
    console.log('   Email:', result.rows[0].email);
    console.log('   Name:', result.rows[0].name);
    console.log('   Station:', result.rows[0].station_code);
    console.log('   Role:', result.rows[0].role);
    console.log('');
    console.log('🔑 Login credentials:');
    console.log('   Email: robert@kenyanstar.com');
    console.log('   Password: password123');

  } catch (error) {
    if (error.code === '23505') {
      console.log('ℹ️  User already exists!');
      console.log('🔑 Login credentials:');
      console.log('   Email: robert@kenyanstar.com');
      console.log('   Password: password123');
    } else {
      console.error('❌ Error creating user:', error.message);
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createTestUser();