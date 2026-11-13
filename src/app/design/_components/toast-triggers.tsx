"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Buttons that fire each toast type through the one `Toaster` mounted in the
 * root layout (design system 4.9). They prove there is a single provider.
 */
export function ToastTriggers() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast("Draft saved.")}>
        Default toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Company created.")}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Could not save the change.")}
      >
        Error toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning("Session expires soon.")}
      >
        Warning toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info("New version available.")}
      >
        Info toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Item archived.", {
            action: {
              label: "Undo",
              onClick: () => toast.success("Restored."),
            },
          })
        }
      >
        Toast with action
      </Button>
    </div>
  );
}
