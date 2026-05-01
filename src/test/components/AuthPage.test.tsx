import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockAuth: any = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

import { AuthPage } from "../../pages/AuthPage";

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={["/auth?mode=signup"]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/client" element={<div>client</div>} />
        <Route path="/cbo" element={<div>cbo</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthPage (signup)", () => {
  beforeEach(() => {
    mockAuth = {
      signIn: vi.fn(),
      signUp: vi.fn(),
      user: null,
      profile: null,
    };
  });

  it("Staff is not an option in the signup role selector", () => {
    renderSignup();
    expect(screen.getByRole("button", { name: /client/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /provider/i })).toBeInTheDocument();
    expect(screen.queryByText(/staff/i)).not.toBeInTheDocument();
  });

  it("Org role triggers org signup path", async () => {
    const u = userEvent.setup();
    renderSignup();

    await u.click(screen.getByRole("button", { name: /provider/i }));
    await u.type(screen.getByPlaceholderText("Jane Doe"), "Jane Doe");
    await u.type(screen.getByPlaceholderText("Helping Hands NYC"), "Helping Hands NYC");
    await u.selectOptions(screen.getByRole("combobox"), "Brooklyn");
    await u.type(screen.getByPlaceholderText("your@email.com"), "org@example.com");
    await u.type(screen.getByPlaceholderText("••••••••"), "password123!");

    const createButtons = screen.getAllByRole("button", { name: /create account/i });
    await u.click(createButtons[createButtons.length - 1]);

    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "organization",
        organization: "Helping Hands NYC",
        borough: "Brooklyn",
      }),
    );
  });

  it("Community member role triggers standard signup", async () => {
    const u = userEvent.setup();
    renderSignup();

    await u.click(screen.getByRole("button", { name: /client/i }));
    await u.type(screen.getByPlaceholderText("Jane Doe"), "Jane Doe");
    await u.type(screen.getByPlaceholderText("your@email.com"), "user@example.com");
    await u.type(screen.getByPlaceholderText("••••••••"), "password123!");

    const createButtons = screen.getAllByRole("button", { name: /create account/i });
    await u.click(createButtons[createButtons.length - 1]);

    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "community_member",
        organization: undefined,
      }),
    );
  });
});

