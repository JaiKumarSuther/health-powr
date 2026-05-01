import { describe, expect, it } from "vitest";
import { requireUser, AuthError } from "../../api/requireUser";
import { getMockSupabase } from "../setup";

describe("requireUser", () => {
  it("returns user when session exists", async () => {
    const supabase = getMockSupabase();
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });

    const user = await requireUser();
    expect(user.id).toBe("u1");
  });

  it("throws AuthError when no session (getUser error)", async () => {
    const supabase = getMockSupabase();
    supabase.auth.getUser.mockResolvedValueOnce({
      data: null,
      error: { message: "No auth" },
    });

    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError when user is null", async () => {
    const supabase = getMockSupabase();
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });
});

