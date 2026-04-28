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

