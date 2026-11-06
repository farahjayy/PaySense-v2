"use client";

import { useState } from "react";

import { StylePicker } from "@/components/categories/StylePicker";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CatIcon } from "@/components/ui/CatIcon";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/fields";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import {
  useAddCategory,
  useCategories,
  useDeleteCategory,
  useRenameCategory,
  useSetCategoryStyle,
  type Category,
  type CategoryLook,
} from "@/lib/api/queries";
import { focusPageHeading } from "@/lib/focus";
import { plural } from "@/lib/format";

type Dialogue =
  | { kind: "add" }
  | { kind: "rename"; category: Category }
  | { kind: "look"; category: Category }
  | { kind: "delete"; category: Category };

const lookOf = (c: Category): CategoryLook => ({ icon: c.icon, colour: c.colour });

// Moving spending into these would change how it counts (the server refuses it too).
const MOVE_NOT_ALLOWED = new Set(["Refund", "Transfer", "BNPL"]);
const TEMPLATE_HREF = "/paysense-import-template.csv";
const LINK_BUTTON =
  "inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-surface-2";

function usage(count: number): string {
  return count === 0 ? "No transactions" : plural(count, "transaction");
}

export function CategoriesScreen() {
  const list = useCategories();
  const add = useAddCategory();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();
  const style = useSetCategoryStyle();
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);

  function close() {
    setDialogue(null);
    add.reset();
    rename.reset();
    remove.reset();
    style.reset();
  }

  // A renamed or deleted row is gone (or re-keyed), so the dialog cannot hand focus back to it.
  function closeAndFocusHeading() {
    close();
    focusPageHeading();
  }

  const categories = list.data?.categories ?? [];
  const own = categories.filter((c) => !c.builtin);
  const builtIn = categories.filter((c) => c.builtin);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/transactions">Back to transactions</BackLink>
      <PageHeader
        title="Categories"
        intro="The labels on your transactions. The built-in names are fixed, because the forecast depends on a few of them (refunds, transfers, BNPL), but every category's colour and icon is yours to change. The ones you add you can also rename or delete."
        actions={
          <>
            <a href={TEMPLATE_HREF} download className={LINK_BUTTON}>
              Download import template
            </a>
            <Button variant="accent" onClick={() => setDialogue({ kind: "add" })}>
              Add category
            </Button>
          </>
        }
      />

      {list.isPending ? (
        <Skeleton lines={6} label="Loading categories" />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : (
        <>
          <section aria-labelledby="own-heading">
            <h2 id="own-heading" className="mb-2 text-sm font-semibold text-ink">
              Yours
            </h2>
            {own.length === 0 ? (
              <p className="rounded-card border border-dashed border-line bg-surface-2 px-4 py-5 text-[13px] text-ink-secondary">
                You have no categories of your own yet. Add one, or import a file that has its own
                Category column and the new names appear here.
              </p>
            ) : (
              <ul
                aria-label="Your categories"
                className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
              >
                {own.map((c) => (
                  <li
                    key={c.name}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                  >
                    <CatIcon category={c.name} look={lookOf(c)} size={40} />
                    <div className="min-w-[10rem] flex-1">
                      <p className="break-words text-[14px] font-medium text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-secondary">{usage(c.transaction_count)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Change look of ${c.name}`}
                        onClick={() => setDialogue({ kind: "look", category: c })}
                      >
                        Look
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Rename ${c.name}`}
                        onClick={() => setDialogue({ kind: "rename", category: c })}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="dangerSoft"
                        size="sm"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setDialogue({ kind: "delete", category: c })}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="builtin-heading">
            <h2 id="builtin-heading" className="mb-2 text-sm font-semibold text-ink">
              Built in
            </h2>
            <ul
              aria-label="Built-in categories"
              className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
            >
              {builtIn.map((c) => (
                <li key={c.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <CatIcon category={c.name} look={lookOf(c)} size={40} />
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-[14px] font-medium text-ink">{c.name}</p>
                    <p className="text-[12px] text-ink-secondary">
                      {c.note ? `${c.note} ` : ""}
                      {usage(c.transaction_count)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                      Fixed
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Change look of ${c.name}`}
                      onClick={() => setDialogue({ kind: "look", category: c })}
                    >
                      Look
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Dialog
        open={dialogue?.kind === "add"}
        title="Add a category"
        onClose={close}
        dismissible={!add.isPending}
      >
        {dialogue?.kind === "add" && (
          <NameForm
            label="Name"
            submitLabel="Add category"
            reason="Type a name for the category."
            initial=""
            withLook
            pending={add.isPending}
            error={add.error?.message ?? null}
            onCancel={close}
            onSubmit={(name, look) => add.mutate({ name, ...look }, { onSuccess: close })}
          />
        )}
      </Dialog>

      <Dialog
        open={dialogue?.kind === "rename"}
        title="Rename category"
        onClose={close}
        dismissible={!rename.isPending}
      >
        {dialogue?.kind === "rename" && (
          <NameForm
            label="New name"
            submitLabel="Save name"
            reason="Type a different name."
            initial={dialogue.category.name}
            pending={rename.isPending}
            error={rename.error?.message ?? null}
            note={`Every transaction in ${dialogue.category.name} (${usage(dialogue.category.transaction_count).toLowerCase()}) moves to the new name.`}
            onCancel={close}
            onSubmit={(newName) =>
              rename.mutate(
                { name: dialogue.category.name, newName },
                { onSuccess: closeAndFocusHeading },
              )
            }
          />
        )}
      </Dialog>

      <Dialog
        open={dialogue?.kind === "look"}
        title="Change look"
        onClose={close}
        dismissible={!style.isPending}
      >
        {dialogue?.kind === "look" && (
          <LookForm
            category={dialogue.category}
            pending={style.isPending}
            error={style.error?.message ?? null}
            onCancel={close}
            onSave={(look) =>
              style.mutate({ name: dialogue.category.name, ...look }, { onSuccess: close })
            }
          />
        )}
      </Dialog>

      <Dialog
        open={dialogue?.kind === "delete"}
        title="Delete category"
        onClose={close}
        dismissible={!remove.isPending}
      >
        {dialogue?.kind === "delete" && (
          <DeleteForm
            category={dialogue.category}
            targets={categories.filter(
              (c) =>
                c.assignable && c.name !== dialogue.category.name && !MOVE_NOT_ALLOWED.has(c.name),
            )}
            pending={remove.isPending}
            error={remove.error?.message ?? null}
            onCancel={close}
            onDelete={(moveTo) =>
              remove.mutate(
                { name: dialogue.category.name, moveTo },
                { onSuccess: closeAndFocusHeading },
              )
            }
          />
        )}
      </Dialog>
    </div>
  );
}

type NameFormProps = {
  label: string;
  submitLabel: string;
  reason: string;
  initial: string;
  note?: string;
  /** Offer a colour and an icon too (when adding a category). */
  withLook?: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string, look: CategoryLook) => void;
};

function NameForm({
  label,
  submitLabel,
  reason,
  initial,
  note,
  withLook = false,
  pending,
  error,
  onCancel,
  onSubmit,
}: NameFormProps) {
  const [name, setName] = useState(initial);
  const [look, setLook] = useState<CategoryLook>({ icon: null, colour: null });
  const trimmed = name.trim();
  const valid = trimmed !== "" && trimmed !== initial;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit(trimmed, look);
      }}
    >
      <TextField
        label={label}
        maxLength={40}
        value={name}
        data-autofocus
        onChange={(event) => setName(event.target.value)}
      />
      {note && <p className="text-[12px] text-ink-secondary">{note}</p>}
      {withLook && (
        <StylePicker name={trimmed} icon={look.icon} colour={look.colour} onChange={setLook} />
      )}
      {error && (
        <Banner tone="danger" title="Not saved">
          {error}
        </Banner>
      )}
      {!valid && (
        <p id="category-reason" className="text-[12px] text-ink-secondary">
          {reason}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="accent"
          disabled={!valid || pending}
          aria-describedby={valid ? undefined : "category-reason"}
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type LookFormProps = {
  category: Category;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (look: CategoryLook) => void;
};

function LookForm({ category, pending, error, onCancel, onSave }: LookFormProps) {
  const initial = lookOf(category);
  const [look, setLook] = useState<CategoryLook>(initial);
  const changed = look.icon !== initial.icon || look.colour !== initial.colour;
  const hasChoice = initial.icon !== null || initial.colour !== null;
  return (
    <div className="space-y-4">
      <StylePicker name={category.name} icon={look.icon} colour={look.colour} onChange={setLook} />
      {category.builtin && (
        <p className="text-[12px] text-ink-secondary">
          The name {category.name} is fixed; only how it looks changes.
        </p>
      )}
      {error && (
        <Banner tone="danger" title="Not saved">
          {error}
        </Banner>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          onClick={() => onSave({ icon: null, colour: null })}
          disabled={!hasChoice || pending}
        >
          Use the default look
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => onSave(look)} disabled={!changed || pending}>
            {pending ? "Saving…" : "Save look"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type DeleteFormProps = {
  category: Category;
  targets: readonly Category[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onDelete: (moveTo: string | undefined) => void;
};

function DeleteForm({ category, targets, pending, error, onCancel, onDelete }: DeleteFormProps) {
  const [moveTo, setMoveTo] = useState("");
  const used = category.transaction_count > 0;
  const ready = !used || moveTo !== "";
  return (
    <div className="space-y-4">
      {used ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="move-to" className="text-xs font-medium text-ink-secondary">
            Move its {plural(category.transaction_count, "transaction")} to
          </label>
          <select
            id="move-to"
            value={moveTo}
            onChange={(event) => setMoveTo(event.target.value)}
            className="h-10 rounded-lg border border-field bg-surface px-3 text-[14px] text-ink"
          >
            <option value="">Choose a category…</option>
            {targets.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-ink-secondary">
            {category.name} is then deleted. Moving into another of your categories merges the two.
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-ink-secondary">
          Delete {category.name}? No transaction uses it.
        </p>
      )}
      {error && (
        <Banner tone="danger" title="Not deleted">
          {error}
        </Banner>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={!ready || pending}
          onClick={() => onDelete(used ? moveTo : undefined)}
        >
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
