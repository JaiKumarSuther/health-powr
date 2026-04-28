/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production public URL for auth email redirects (no trailing slash). */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ---- Type shims for Supabase Edge Function remote imports ----
// These are only to satisfy the editor/TypeScript in this repo.
// Supabase Edge Functions run in Deno and load these modules at runtime.
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export type SupabaseClient = any;
  export function createClient(...args: any[]): SupabaseClient;
}

declare module "https://deno.land/x/denomailer@1.6.0/mod.ts" {
  export type SendMailOptions = {
    from: string;
    to: string;
    subject: string;
    content?: string;
    text?: string;
    html?: string;
  };

  export class SMTPClient {
    constructor(config: unknown);
    send(options: SendMailOptions): Promise<void>;
    close(): Promise<void>;
  }
}

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
