import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button colours carry meaning", () => {
  it("shows a destructive row action in red, so it cannot be mistaken for Edit", () => {
    render(<Button variant="dangerSoft">Delete</Button>);
    const className = screen.getByRole("button", { name: "Delete" }).className;

    expect(className).toContain("text-danger");
    expect(className).toContain("border-danger");
  });

  it("shows an action that completes something in green", () => {
    render(<Button variant="positive">Mark paid</Button>);

    expect(screen.getByRole("button", { name: "Mark paid" }).className).toContain("text-success");
  });

  it("keeps the main action in the brand teal and everything else neutral", () => {
    render(
      <>
        <Button variant="accent">Save</Button>
        <Button variant="secondary">Cancel</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" }).className).toContain("bg-accent");
    const cancel = screen.getByRole("button", { name: "Cancel" }).className;
    expect(cancel).not.toContain("text-danger");
    expect(cancel).not.toContain("bg-accent");
  });
});
