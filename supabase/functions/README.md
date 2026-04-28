# Supabase Edge Functions

This project uses Supabase Edge Functions for **owner/admin staff provisioning**.

## Function: `create-staff-account`

Creates a staff auth user, links them to an organization, and emails credentials.

### Required secrets (set in Supabase dashboard for the function)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_USER`
- `SMTP_PASS`

Optional:

- `STAFF_LOGIN_URL` (defaults to `/staff-login`)

### Deploy

Use Supabase CLI:

```bash
supabase functions deploy create-staff-account
```

Then set secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SMTP_USER=... SMTP_PASS=...
```

