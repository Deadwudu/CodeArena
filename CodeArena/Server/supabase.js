const path = require("path")
const dotenv = require("dotenv")
const { createClient } = require("@supabase/supabase-js")

dotenv.config({ path: path.join(__dirname, "pass.env") })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in pass.env")
}

// На бэкенде предпочтительно SUPABASE_SERVICE_ROLE_KEY (обходит RLS). Не включайте его в фронт.
const supabaseKey = supabaseServiceKey || supabaseAnonKey
const supabase = createClient(supabaseUrl, supabaseKey, supabaseServiceKey ? { auth: { persistSession: false } } : undefined)

module.exports = { supabase }

