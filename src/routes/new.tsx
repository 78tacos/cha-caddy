import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { TeaForm } from "@/components/tea-form";
import { useCellar } from "@/lib/teas/use-cellar";
import { emptyDraft } from "@/lib/teas/types";

export const Route = createFileRoute("/new")({ component: NewTeaPage });

function NewTeaPage() {
  const navigate = useNavigate();
  const { addTea } = useCellar();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-widest text-celadon uppercase">Add</p>
        <h1 className="font-display text-4xl leading-none font-medium tracking-tight">
          New to the caddy
        </h1>
        <p className="text-sm text-muted-foreground">
          Type a name and pick the right listing — notes come from that page, not from thin air.
        </p>
      </header>
      <TeaForm
        initial={emptyDraft()}
        submitLabel="Add to cellar"
        onSubmit={async (draft) => {
          const id = await addTea(draft);
          toast.success(`${draft.name} is in the cellar.`);
          void navigate({ to: "/tea/$id", params: { id } });
        }}
      />
    </div>
  );
}
