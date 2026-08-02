// @ts-ignore: Deno HTTPS URL import resolution
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"


// Declare Deno namespace for IDE TypeScript language server
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

// ── CORS HEADERS ──
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get the auth header (the caller's JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Read the request body
    const { email, password, full_name, role } = await req.json()
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate role explicitly to match the allowed roles defined in src/lib/permissions.js
    // MUST stay in sync with src/lib/permissions.js (SINGLE SOURCE OF TRUTH)
    const validRoles = ['admin', 'manager', 'sales', 'lead generator', 'viewer']
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role specified. Must be one of: ' + validRoles.join(', ') }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Initialize Admin Client (uses service_role key to bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Verify Caller Identity
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 5. Verify Caller is an Admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only admins can create users' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 6. Create the new user (bypassing email verification)
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) {
      // Handle "email already exists" gracefully
      if (createError.message.includes('already registered') || createError.message.includes('already exists') || createError.status === 422) {
        return new Response(JSON.stringify({ error: 'EMAIL_EXISTS', message: 'This email is already in use.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const newUserId = newUserData.user.id

    // 7. Update the profile with the explicit role and full_name
    // (The handle_new_user trigger inserts 'employee' by default, so we override it here)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role, full_name })
      .eq('id', newUserId)

    if (updateError) {
      // If profile update fails, we log it, but the user is created
      console.error('Failed to update new user profile:', updateError)
      return new Response(JSON.stringify({ error: 'User created, but profile update failed.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Success!
    return new Response(JSON.stringify({ success: true, user: newUserData.user }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
