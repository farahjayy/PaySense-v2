import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminScreen } from "@/components/screens/AdminScreen";
import { forgetForTests, markIntroSeen, markTourSeen, stageFor } from "@/lib/introTour";
import { saveSession } from "@/lib/session";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function signInAs(role?: string) {
  saveSession({
    token: "t",
    expiresAt: Date.now() + 60_000,
    user: { id: "u1", username: "admin", display_name: "Farah", persona: null, role },
  });
  forgetForTests();
  markIntroSeen("u1");
  markTourSeen("u1");
}

describe("AdminScreen (ADR D-57)", () => {
  beforeEach(() => push.mockReset());

  it("gives an admin the quick tour to launch, and says what it does", () => {
    signInAs("admin");
    render(<AdminScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Admin" })).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Quick tour" }).closest("div") as HTMLElement;
    expect(card).toHaveTextContent(/welcome slides and the tour from the start/i);
    expect(screen.getByRole("button", { name: "Launch the quick tour" })).toBeInTheDocument();
  });

  it("plays the intro from the first slide and goes to the dashboard when launched", async () => {
    signInAs("admin");
    render(<AdminScreen />);
    expect(stageFor("u1")).toBe("done");

    await userEvent.click(screen.getByRole("button", { name: "Launch the quick tour" }));

    expect(stageFor("u1")).toBe("intro");
    expect(push).toHaveBeenCalledWith("/");
  });

  it("tells an ordinary user the page is for admins and offers none of the tools", () => {
    signInAs("user");
    render(<AdminScreen />);

    expect(screen.getByText(/this page is for admins/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to the dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Launch the quick tour" })).not.toBeInTheDocument();
  });

  it("treats a session from before roles existed as an ordinary user", () => {
    signInAs(undefined);
    render(<AdminScreen />);

    expect(screen.getByText(/this page is for admins/i)).toBeInTheDocument();
  });

  it("has no accessibility violations for either", async () => {
    signInAs("admin");
    const admin = render(<AdminScreen />);
    expect((await axe.run(admin.container)).violations).toEqual([]);
    admin.unmount();

    signInAs("user");
    const user = render(<AdminScreen />);
    expect((await axe.run(user.container)).violations).toEqual([]);
  });
});
