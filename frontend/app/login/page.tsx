import type { Metadata } from "next";

import { HelloFace } from "@/components/auth/LoginArt";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  // The pitch panel has nothing to tab to, so the username field is still the first stop for
  // keyboard users even though the panel comes first in the document.
  return (
    <main className="lg-shell">
      <LoginPanel />
      <div className="lg-stage">
        <section className="lg-card">
          <HelloFace />
          <h1>Welcome</h1>
          <p className="lg-lede">Sign in to see where your money is heading.</p>
          <LoginForm />
        </section>
      </div>
      {/* After the form in the document so the username stays the first stop; the CSS puts it top right. */}
      <div className="lg-theme-switch">
        <ThemeToggle />
      </div>
    </main>
  );
}
