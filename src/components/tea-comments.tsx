import { useState, type FormEvent } from "react";
import { format, formatDistanceToNowStrict, isToday } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCellar } from "@/lib/teas/use-cellar";
import type { Tea, TeaComment } from "@/lib/teas/types";

export function TeaComments({ tea }: { tea: Tea }) {
  const { meId, cellar, addComment, removeComment, commenting } = useCellar();
  const [note, setNote] = useState("");
  const comments = tea.comments ?? [];
  const canModerate = cellar?.role === "owner";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = note.trim();
    if (!body) return;
    try {
      await addComment(tea.id, body);
      setNote("");
    } catch {
      toast.error("Could not leave that note.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl font-medium">
          <MessageSquare className="size-5 text-celadon" strokeWidth={1.6} />
          Shelf notes
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {comments.length === 0
            ? "None yet"
            : `${comments.length} note${comments.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Who drank it, what they noticed — signed with your name so the household can follow.
      </p>

      {comments.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          First note on this cake.
        </p>
      ) : (
        <ol className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canRemove={c.userId === meId || canModerate}
              onRemove={async () => {
                try {
                  await removeComment(c.id);
                } catch {
                  toast.error("Could not remove that note.");
                }
              }}
            />
          ))}
        </ol>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="shelf-note" className="text-xs font-medium tracking-wide text-muted-foreground">
          Leave a note
        </label>
        <Textarea
          id="shelf-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Who poured, how it drank, what to try next…"
          rows={3}
        />
        <Button type="submit" variant="celadon" className="w-full" disabled={commenting || !note.trim()}>
          {commenting ? "Saving…" : "Add note"}
        </Button>
      </form>
    </section>
  );
}

function CommentItem({
  comment,
  canRemove,
  onRemove,
}: {
  comment: TeaComment;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{comment.authorName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{when(comment.createdAt)}</p>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Remove note"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
    </li>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "HH:mm");
  return `${formatDistanceToNowStrict(d)} ago`;
}
