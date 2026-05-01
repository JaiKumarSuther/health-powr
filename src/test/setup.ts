import "@testing-library/jest-dom";
import { vi } from "vitest";
import type { UserRole } from "../types/user";

type SupabaseUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

type MockSupabase = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  functions: { invoke: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const mockSupabase: MockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  functions: { invoke: vi.fn() },
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
};

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: mockSupabase,
}));

export function createMockUser(role: UserRole = "community_member") {
  const id = "user-1";
  const email = "user@example.com";

  const supabaseUser: SupabaseUser = {
    id,
    email,
    user_metadata: {
      role,
      full_name: "Test User",
      organization: role === "organization" ? "Test Org" : undefined,
      borough: "Brooklyn",
    },
  };

  const profile = {
    id,
    email,
    full_name: "Test User",
    role,
    avatar_url: null as string | null,
    phone: null as string | null,
    borough: "Brooklyn" as string | null,
  };

  return { supabaseUser, profile };
}

export function getMockSupabase() {
  return mockSupabase;
}

