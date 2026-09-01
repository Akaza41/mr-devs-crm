// Supabase has been migrated to Firebase.
// This mock object ensures legacy imports do not throw fatal initialization errors.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => {},
    signInWithOAuth: async () => {}
  },
  from: () => ({
    select: () => ({
      eq: () => ({ single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }) }),
      order: () => ({ limit: async () => ({ data: [], error: null }) })
    }),
    update: () => ({ eq: async () => ({ error: null }) }),
    insert: async () => ({ error: null }),
    delete: () => ({ eq: async () => ({ error: null }) })
  }),
  rpc: async () => ({ data: [], error: null })
}