import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import AuthCallbackPage from "../../pages/AuthCallbackPage";
import { getMockSupabase } from "../setup";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<div>home</div>} />
        <Route path="/client" element={<div>client</div>} />
        <Route path="/admin" element={<div>admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    const supabase = getMockSupabase();
    supabase.auth.getSession.mockResolvedValue({ data: { session: {} } });
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects to /client when returnTo is missing", async () => {
    renderAt("/auth/callback");
    expect(await screen.findByText("client")).toBeInTheDocument();
  });

  it("redirects to /client when returnTo is /client", async () => {
    renderAt("/auth/callback?returnTo=%2Fclient");
    expect(await screen.findByText("client")).toBeInTheDocument();
  });

  it("redirects to /admin when returnTo is /admin", async () => {
    renderAt("/auth/callback?returnTo=%2Fadmin");
    expect(await screen.findByText("admin")).toBeInTheDocument();
  });

  it("does NOT redirect to /evil when returnTo is /evil — goes to / instead", async () => {
    renderAt("/auth/callback?returnTo=%2Fevil");
    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  it("does NOT redirect to external URL", async () => {
    renderAt("/auth/callback?returnTo=https%3A%2F%2Fevil.com");
    expect(await screen.findByText("home")).toBeInTheDocument();
  });
});

