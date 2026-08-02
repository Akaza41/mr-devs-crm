// TypeScript ambient declarations for Deno URL imports when editing in VS Code without Deno LSP
declare module "https://esm.sh/@supabase/supabase-js@2.39.3" {
  export * from "@supabase/supabase-js";
}

declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response, options?: { port?: number }): void;
}
