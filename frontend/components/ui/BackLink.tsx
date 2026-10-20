import Link from "next/link";

/** For a page that has no sidebar entry: the way back to the page it is reached from. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent underline-offset-2 hover:underline"
    >
      <span aria-hidden>‹</span>
      {children}
    </Link>
  );
}
