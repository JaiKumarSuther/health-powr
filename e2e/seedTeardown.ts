import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type SeedState = {
  runId: string;
  createdAt: string;
  emails: {
    client: string;
    orgOwner: string;
    staff: string;
    admin: string;
  };
  ids: {
    clientUserId: string;
    orgOwnerUserId: string;
    staffUserId: string;
    adminUserId: string;
    organizationId: string;
    serviceId: string;
    requestId: string;
    conversationId: string;
    messageId: string;
  };
};

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function projectRefFromUrl(url: string): string {
  const host = new URL(url).host;
  return host.split(".")[0];
}

function authStorageKey(supabaseUrl: string) {
  return `sb-${projectRefFromUrl(supabaseUrl)}-auth-token`;
}

function outDir() {
  return path.join(process.cwd(), ".playwright");
}

function seedFilePath() {
  return path.join(outDir(), "seed.json");
}

async function makeStorageState(input: {
  baseURL: string;
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
  outFile: string;
}) {
  const supabase = createClient(input.supabaseUrl, input.anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned for signInWithPassword");

  const session = data.session;
  const key = authStorageKey(input.supabaseUrl);
  const origin = new URL(input.baseURL).origin;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });

  await context.addInitScript(
    ([k, v]) => {
      window.localStorage.setItem(k, v);
    },
    [key, JSON.stringify(session)],
  );

  await context.storageState({ path: input.outFile });
  await browser.close();
}

export async function seedE2E(opts?: { baseURL?: string; log?: boolean }): Promise<SeedState> {
  const log = opts?.log !== false;
  const baseURL =
    process.env.E2E_APP_BASE_URL ??
    opts?.baseURL ??
    "http://localhost:5000";

  const supabaseUrl = mustGetEnv("E2E_SUPABASE_URL");
  const anonKey = mustGetEnv("E2E_SUPABASE_ANON_KEY");
  const serviceRoleKey = mustGetEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");
  const password = mustGetEnv("E2E_TEST_PASSWORD");

  const runId = `e2e-${Date.now()}`;

  fs.mkdirSync(outDir(), { recursive: true });

  const clientState = path.join(outDir(), "storage.client.json");
  const orgState = path.join(outDir(), "storage.org.json");
  const staffState = path.join(outDir(), "storage.staff.json");
  const adminState = path.join(outDir(), "storage.admin.json");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientEmail = `hp.e2e.client+${runId}@example.com`;
  const orgOwnerEmail = `hp.e2e.org+${runId}@example.com`;
  const staffEmail = `hp.e2e.staff+${runId}@example.com`;
  const adminEmail = `hp.e2e.admin+${runId}@example.com`;

  if (log) {
    console.log(`[e2e:seed] baseURL=${baseURL}`);
    console.log(`[e2e:seed] supabaseUrl=${supabaseUrl}`);
    console.log(`[e2e:seed] runId=${runId}`);
    console.log("[e2e:seed] Creating auth users…");
  }

  const createdClient = await admin.auth.admin.createUser({
    email: clientEmail,
    password,
    email_confirm: true,
    user_metadata: { role: "community_member", full_name: "E2E Client" },
  });
  if (createdClient.error) throw createdClient.error;
  const clientUserId = createdClient.data.user?.id;
  if (!clientUserId) throw new Error("Failed to create client user");

  const createdOrgOwner = await admin.auth.admin.createUser({
    email: orgOwnerEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: "organization",
      full_name: "E2E Org Owner",
      organization: "E2E Org",
      borough: "Brooklyn",
    },
  });
  if (createdOrgOwner.error) throw createdOrgOwner.error;
  const orgOwnerUserId = createdOrgOwner.data.user?.id;
  if (!orgOwnerUserId) throw new Error("Failed to create org owner user");

  const createdStaff = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
    user_metadata: { role: "organization", full_name: "E2E Staff" },
  });
  if (createdStaff.error) throw createdStaff.error;
  const staffUserId = createdStaff.data.user?.id;
  if (!staffUserId) throw new Error("Failed to create staff user");

  const createdAdmin = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { role: "admin", full_name: "E2E Admin" },
  });
  if (createdAdmin.error) throw createdAdmin.error;
  const adminUserId = createdAdmin.data.user?.id;
  if (!adminUserId) throw new Error("Failed to create admin user");

  if (log) console.log("[e2e:seed] Upserting profiles…");
  const { error: profErr } = await admin.from("profiles").upsert([
    {
      id: clientUserId,
      email: clientEmail,
      full_name: "E2E Client",
      role: "community_member",
      borough: "Brooklyn",
    },
    {
      id: orgOwnerUserId,
      email: orgOwnerEmail,
      full_name: "E2E Org Owner",
      role: "organization",
      borough: "Brooklyn",
    },
    {
      id: staffUserId,
      email: staffEmail,
      full_name: "E2E Staff",
      role: "organization",
      borough: "Brooklyn",
    },
    {
      id: adminUserId,
      email: adminEmail,
      full_name: "E2E Admin",
      role: "admin",
      borough: "Brooklyn",
    },
  ]);
  if (profErr) throw profErr;

  if (log) console.log("[e2e:seed] Creating organization + membership…");
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert({
      owner_id: orgOwnerUserId,
      name: `E2E Org ${runId}`,
      borough: "Brooklyn",
      status: "approved",
      is_active: true,
    })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  const organizationId = orgRow.id as string;

  const { error: memErr } = await admin.from("organization_members").insert([
    { organization_id: organizationId, profile_id: orgOwnerUserId, role: "owner" },
    { organization_id: organizationId, profile_id: staffUserId, role: "member" },
  ]);
  if (memErr) throw memErr;

  if (log) console.log("[e2e:seed] Creating service + request + conversation…");
  const { data: svcRow, error: svcErr } = await admin
    .from("services")
    .insert({
      organization_id: organizationId,
      name: `E2E Service ${runId}`,
      category: "housing",
      borough: "Brooklyn",
      is_active: true,
    })
    .select("id")
    .single();
  if (svcErr) throw svcErr;
  const serviceId = svcRow.id as string;

  const description = `E2E seeded request ${runId}`;
  const { data: reqRow, error: reqErr } = await admin
    .from("service_requests")
    .insert({
      category: "housing",
      borough: "Brooklyn",
      description,
      service_id: serviceId,
      member_id: clientUserId,
      assigned_org_id: organizationId,
      assigned_staff_id: staffUserId,
      status: "pending",
      metadata: { first_name: "E2E", last_name: "Client", urgency: "exploring" },
    })
    .select("id")
    .single();
  if (reqErr) throw reqErr;
  const requestId = reqRow.id as string;

  const { data: convRow, error: convErr } = await admin
    .from("conversations")
    .insert({
      request_id: requestId,
      member_id: clientUserId,
      organization_id: organizationId,
      assigned_staff_id: staffUserId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (convErr) throw convErr;
  const conversationId = convRow.id as string;

  const { data: msgRow, error: msgErr } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: clientUserId,
      content: `Hello from client (${runId})`,
    })
    .select("id")
    .single();
  if (msgErr) throw msgErr;
  const messageId = msgRow.id as string;

  if (log) console.log("[e2e:seed] Generating storageState files…");
  await makeStorageState({ baseURL, supabaseUrl, anonKey, email: clientEmail, password, outFile: clientState });
  await makeStorageState({ baseURL, supabaseUrl, anonKey, email: orgOwnerEmail, password, outFile: orgState });
  await makeStorageState({ baseURL, supabaseUrl, anonKey, email: staffEmail, password, outFile: staffState });
  await makeStorageState({ baseURL, supabaseUrl, anonKey, email: adminEmail, password, outFile: adminState });

  const seedState: SeedState = {
    runId,
    createdAt: new Date().toISOString(),
    emails: { client: clientEmail, orgOwner: orgOwnerEmail, staff: staffEmail, admin: adminEmail },
    ids: {
      clientUserId,
      orgOwnerUserId,
      staffUserId,
      adminUserId,
      organizationId,
      serviceId,
      requestId,
      conversationId,
      messageId,
    },
  };

  fs.writeFileSync(seedFilePath(), JSON.stringify(seedState, null, 2), "utf-8");

  if (log) {
    console.log("[e2e:seed] Done. Created:");
    console.log(`- users: client=${clientUserId}, orgOwner=${orgOwnerUserId}, staff=${staffUserId}, admin=${adminUserId}`);
    console.log(`- org=${organizationId} service=${serviceId} request=${requestId}`);
    console.log(`- conversation=${conversationId} message=${messageId}`);
    console.log(`[e2e:seed] Wrote ${seedFilePath()}`);
    console.log(`[e2e:seed] storageState: ${outDir()}`);
  }

  return seedState;
}

export async function teardownE2E(opts?: { log?: boolean }) {
  const log = opts?.log !== false;
  const supabaseUrl = mustGetEnv("E2E_SUPABASE_URL");
  const serviceRoleKey = mustGetEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");

  const seedPath = seedFilePath();
  if (!fs.existsSync(seedPath)) {
    if (log) console.log(`[e2e:teardown] No seed file found at ${seedPath}. Nothing to delete.`);
    return;
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as SeedState;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (log) {
    console.log(`[e2e:teardown] supabaseUrl=${supabaseUrl}`);
    console.log(`[e2e:teardown] runId=${seed.runId}`);
    console.log("[e2e:teardown] Deleting seeded rows…");
  }

  // Best-effort cleanup in dependency order.
  await admin.from("messages").delete().eq("id", seed.ids.messageId);
  await admin.from("conversations").delete().eq("id", seed.ids.conversationId);
  await admin.from("service_requests").delete().eq("id", seed.ids.requestId);
  await admin.from("services").delete().eq("id", seed.ids.serviceId);
  await admin.from("organization_members").delete().eq("organization_id", seed.ids.organizationId);
  await admin.from("organizations").delete().eq("id", seed.ids.organizationId);
  await admin.from("profiles").delete().in("id", [
    seed.ids.clientUserId,
    seed.ids.orgOwnerUserId,
    seed.ids.staffUserId,
    seed.ids.adminUserId,
  ]);

  if (log) console.log("[e2e:teardown] Deleting auth users…");
  await admin.auth.admin.deleteUser(seed.ids.clientUserId);
  await admin.auth.admin.deleteUser(seed.ids.orgOwnerUserId);
  await admin.auth.admin.deleteUser(seed.ids.staffUserId);
  await admin.auth.admin.deleteUser(seed.ids.adminUserId);

  try {
    fs.unlinkSync(seedPath);
  } catch {
    // ignore
  }

  if (log) {
    console.log("[e2e:teardown] Done. Deleted:");
    console.log(`- users: client=${seed.ids.clientUserId}, orgOwner=${seed.ids.orgOwnerUserId}, staff=${seed.ids.staffUserId}, admin=${seed.ids.adminUserId}`);
    console.log(`- org=${seed.ids.organizationId} service=${seed.ids.serviceId} request=${seed.ids.requestId}`);
    console.log(`- conversation=${seed.ids.conversationId} message=${seed.ids.messageId}`);
  }
}

