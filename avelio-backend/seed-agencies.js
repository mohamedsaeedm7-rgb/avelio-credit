// Script to create test agencies
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const testAgencies = [
  {
    agency_id: '789456',
    agency_name: 'SKY TOURS JUBA',
    contact_phone: '+211-912-345678',
    contact_email: 'info@skytoursjuba.com',
    city: 'Juba',
    country: 'South Sudan',
    credit_limit: 50000.00
  },
  {
    agency_id: '654321',
    agency_name: 'NILE TRAVEL',
    contact_phone: '+211-923-456789',
    contact_email: 'bookings@niletravel.com',
    city: 'Juba',
    country: 'South Sudan',
    credit_limit: 30000.00
  },
  {
    agency_id: '111222',
    agency_name: 'EAST AFRICA TRAVEL',
    contact_phone: '+211-934-567890',
    contact_email: 'info@eastafricatravel.com',
    city: 'Juba',
    country: 'South Sudan',
    credit_limit: 40000.00
  }
];

async function createTestAgencies() {
  try {
    console.log('Creating test agencies...\n');

    for (const agency of testAgencies) {
      try {
        const result = await pool.query(
          `INSERT INTO agencies 
           (agency_id, agency_name, contact_phone, contact_email, city, country, credit_limit, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
           RETURNING id, agency_id, agency_name`,
          [
            agency.agency_id,
            agency.agency_name,
            agency.contact_phone,
            agency.contact_email,
            agency.city,
            agency.country,
            agency.credit_limit,
            true
          ]
        );

        console.log(`✅ Created: ${result.rows[0].agency_name} (ID: ${result.rows[0].agency_id})`);
      } catch (error) {
        if (error.code === '23505') {
          console.log(`ℹ️  Already exists: ${agency.agency_name}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ All test agencies ready!');
    console.log('\n📋 Agency IDs you can use:');
    testAgencies.forEach(a => {
      console.log(`   ${a.agency_id} - ${a.agency_name}`);
    });

  } catch (error) {
    console.error('❌ Error creating agencies:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createTestAgencies();