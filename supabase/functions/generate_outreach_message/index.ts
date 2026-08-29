// @ts-ignore: Deno HTTPS URL import resolution
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { lead_name, type, pain_point, current_solution, decision_maker, notes } = await req.json()

    // Craft diagnostic outreach message generator
    const prompt = `
Create a highly personalized 2-3 sentence outreach message for a prospect.
Prospect Details:
- Business/Lead Name: ${lead_name || 'Prospect'}
- Industry/Type: ${type || 'Business'}
- Decision Maker: ${decision_maker || 'Leader'}
- Pain Point / Challenge: ${pain_point || 'Operational efficiency & growth'}
- Current Solution: ${current_solution || 'Manual processes'}
- Additional Context: ${notes || 'None'}

CRITICAL GUIDELINES:
1. ALWAYS open with an incisive diagnostic question based on their pain point or industry.
2. NEVER start with a pitch, introduction of yourself, or generic sales template.
3. Keep it brief, professional, and directly actionable.
`

    // Use Gemini or fallback server-side generation
    let generatedText = ""
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('LLM_API_KEY')

    if (apiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        })
        const data = await res.json()
        generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
      } catch (err) {
        console.warn('LLM API call failed, falling back to dynamic template:', err)
      }
    }

    if (!generatedText) {
      // Dynamic diagnostic fallback template
      const dm = decision_maker ? `Hi ${decision_maker}, ` : 'Hi there, '
      const question = pain_point 
        ? `Are you currently finding that ${pain_point.toLowerCase()} is slowing down operations at ${lead_name || 'your team'}?`
        : `How is your team currently handling workflow efficiency at ${lead_name || 'your organization'}?`
      
      const solutionNote = current_solution 
        ? ` We've helped similar ${type || 'businesses'} transition away from ${current_solution.toLowerCase()} to streamline their process.`
        : ` We specialize in solving core operational bottlenecks for ${type || 'growing companies'}.`

      generatedText = `${dm}${question}${solutionNote} Would you be open to a quick 5-minute diagnostic call this week?`
    }

    return new Response(JSON.stringify({ message: generatedText.trim() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error generating AI message:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
