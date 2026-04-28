// Type shim for editors/TS that don't include Deno globals.
// Supabase Edge Functions run in Deno, where `Deno` exists at runtime.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
};

