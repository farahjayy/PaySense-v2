/** The PaySense mark (a pie in the pond colours). Decorative: the wordname is always beside it. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="12" fill="#f7f4d5" />
      <path d="M19 9.5a10.5 10.5 0 1 0 0 21z" fill="#105666" />
      <path d="M22 9.5a10.5 10.5 0 0 1 10.5 10.5H22z" fill="#d3968c" />
      <path d="M22 23h10.3A10.5 10.5 0 0 1 22 30.5z" fill="#105666" fillOpacity=".45" />
    </svg>
  );
}
