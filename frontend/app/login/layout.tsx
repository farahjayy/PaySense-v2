import type { ReactNode } from "react";

import "./login.css";

// The fonts come from the root layout, shared with the rest of the app.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className="login-theme">{children}</div>;
}
