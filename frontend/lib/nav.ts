/** Pages with no sidebar entry of their own, reached from a button on the section that owns them. */
const ALSO_UNDER: Readonly<Record<string, readonly string[]>> = {
  "/transactions": ["/import", "/categories"],
};

function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Is `href` the section the visitor is in? Matches on a path-segment boundary. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return under(pathname, href) || (ALSO_UNDER[href] ?? []).some((child) => under(pathname, child));
}
