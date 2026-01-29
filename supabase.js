
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Dùng Service Role Key cho Backend để có full quyền

if (!supabaseUrl || !supabaseKey) {
    // Warn but don't crash immediately if keys are missing (useful for build steps)
    console.warn('⚠️  Supabase URL or Key is missing in .env file!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
