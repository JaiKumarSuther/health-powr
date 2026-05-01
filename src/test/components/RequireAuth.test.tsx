import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";

let mockAuth: any = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

import { RequireAuth } from "../../routes/RequireAuth";

function renderWithRoutes(ui: React.ReactNode, initial = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/client" element={<div>client</div>} />
        <Route path="/cbo" element={<div>cbo</div>} />
        <Route path="/admin" element={<div>admin</div>} />
        <Route path="/admin-passkey" element={<div>admin-passkey</div>} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    mockAuth = {
      user: { id: "u1", role: "community_member" },
      profile: { id: "u1", role: "community_member" },
      isLoading: false,
      isResolvingRole: false,
    };
    vi.restoreAllMocks();
  });

  it("shows loading state while role is resolving", () => {
    mockAuth.isLoading = true;
    renderWithRoutes(
      <RequireAuth role="community_member">
        <div>protected</div>
      </RequireAuth>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects unauthenticated user to landing", () => {
    mockAuth.user = null;
    mockAuth.profile = null;
    renderWithRoutes(
      <RequireAuth role="community_member">
        <div>protected</div>
      </RequireAuth>,
    );
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects community_member to /client when trying to access org portal", () => {
    mockAuth.user.role = "community_member";
    mockAuth.profile.role = "community_member";
    renderWithRoutes(
      <RequireAuth allowedRoles={["organization"]}>
        <div>protected</div>
      </RequireAuth>,
    );
    expect(screen.getByText("client")).toBeInTheDocument();
  });

  it("redirects organization to /cbo when trying to access client portal", () => {
    mockAuth.user.role = "organization";
    mockAuth.profile.role = "organization";
    renderWithRoutes(
      <RequireAuth allowedRoles={["community_member"]}>
        <div>protected</div>
      </RequireAuth>,
    );
    expect(screen.getByText("cbo")).toBeInTheDocument();
  });

  it("redirects admin to /admin when trying to access other portal", async () => {
    mockAuth.user.role = "admin";
    mockAuth.profile.role = "admin";
    // Not an admin route: just mismatched roleList triggers redirect
    renderWithRoutes(
      <RequireAuth allowedRoles={["community_member"]}>
        <div>protected</div>
      </RequireAuth>,
    );
    expect(await screen.findByText("admin")).toBeInTheDocument();
  });

  it("admin without valid proof token is redirected to /admin-passkey", async () => {
    mockAuth.user.role = "admin";
    mockAuth.profile.role = "admin";
    // no proof in storage
    window.sessionStorage.clear();
    renderWithRoutes(
      <RequireAuth role="admin">
        <div>protected</div>
      </RequireAuth>,
    );
    expect(await screen.findByText("admin-passkey")).toBeInTheDocument();
  });
});

