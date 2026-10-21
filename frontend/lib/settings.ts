import type { AccountScope, AccountSummary } from "@/lib/api/queries";
import { plural } from "@/lib/format";

export const SCOPE_LABEL: Record<AccountScope, string> = {
  transactions: "Transactions",
  plans: "BNPL plans",
  recurring: "Recurring items",
  limits: "BNPL limits",
  categories: "My own categories",
};

/** Every kind, in the order they are listed: derived from the labels, so a kind the server adds
 *  cannot be left out of the factory reset without the types failing. */
export const SCOPES = Object.keys(SCOPE_LABEL) as AccountScope[];

export const SCOPE_NOTE: Partial<Record<AccountScope, string>> = {
  plans: "with their instalments and saved risk reports",
  categories: "the ones you added, not the built-in ones",
};

/** "808 transactions", "1 BNPL limit": a count in words, for a list of what is about to go. */
export function countPhrase(scope: AccountScope, n: number): string {
  switch (scope) {
    case "transactions":
      return plural(n, "transaction");
    case "plans":
      return plural(n, "BNPL plan");
    case "recurring":
      return plural(n, "recurring item");
    case "limits":
      return plural(n, "BNPL limit");
    case "categories":
      return `${n} of your own ${n === 1 ? "category" : "categories"}`;
  }
}

/** The sentence after a reset: what was actually removed. */
export function clearedSentence(removed: AccountSummary): string {
  const parts = SCOPES.filter((s) => removed[s] > 0).map((s) => countPhrase(s, removed[s]));
  if (parts.length === 0) return "There was nothing to clear.";
  const last = parts.pop() as string;
  return `Cleared ${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last}.`;
}
