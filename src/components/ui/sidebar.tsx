"use client";

import { Menu, X } from "lucide-react";
import { Slot } from "radix-ui";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/*
 * Slimmed-down adaptation of the shadcn Sidebar (design system 5.2 and 6.1).
 * Differences from the generator output, all deliberate:
 * - permanent from `md` up, drawer below; no desktop collapse, no cookie, no
 *   Ctrl/Cmd+B shortcut (a hidden, unexplained state);
 * - no Tooltip, Separator, Input or icon-collapse mode (the shell imports none);
 * - the drawer state lives in the Radix Dialog root, so the hamburger gets
 *   aria-expanded and aria-controls and focus returns to it on close.
 */

/**
 * Owns the drawer state for the shell. The drawer can only be open below `md`:
 * crossing the breakpoint while it is open closes it instead of leaving an
 * invisible focus trap behind.
 */
export function SidebarProvider({
  children,
}: {
  children: ComponentProps<typeof Sheet>["children"];
}) {
  const [isDrawerRequested, setIsDrawerRequested] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Sheet
      open={isDrawerRequested && isMobile}
      onOpenChange={setIsDrawerRequested}
    >
      {children}
    </Sheet>
  );
}

/**
 * The navigation container: a fixed column from `md` up, the drawer content
 * below. `drawerTitle` names the dialog for assistive technology.
 */
export function Sidebar({
  drawerTitle,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { drawerTitle: string }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <SheetContent title={drawerTitle}>
        <div
          className={cn(
            "flex size-full flex-col bg-sidebar text-sidebar-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </SheetContent>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-sticky hidden w-(--sidebar-width) flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** The hamburger. Only visible below `md`. */
export function SidebarTrigger({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <SheetTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn("md:hidden", className)}
        {...props}
      >
        <Menu className="size-5" aria-hidden />
      </Button>
    </SheetTrigger>
  );
}

/** Wordmark row, plus the drawer's close button below `md`. */
export function SidebarHeader({
  closeLabel,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { closeLabel: string }) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-3 px-4",
        className,
      )}
      {...props}
    >
      {children}
      <SheetClose asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={closeLabel}
          className="md:hidden"
        >
          <X className="size-5" aria-hidden />
        </Button>
      </SheetClose>
    </div>
  );
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "px-3 pb-1 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("relative", className)} {...props} />;
}

type SidebarMenuButtonProps = ComponentProps<"a"> & {
  /** Marks the current page: `aria-current`, a surface, weight and a 2px bar. */
  isActive?: boolean;
  /** Render the child (a Next.js `Link`) instead of an anchor. */
  asChild?: boolean;
};

/**
 * One navigation entry (design system 5.2): icon + label, 44px high on touch
 * and 40px from `md`. The active item is not marked by color alone: its
 * weight and surface change and a primary bar appears on its left edge.
 * Activating it also closes the drawer, which is a no-op on desktop.
 */
export function SidebarMenuButton({
  isActive = false,
  asChild = false,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Component = asChild ? Slot.Root : "a";

  return (
    <SheetClose asChild>
      <Component
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex h-control items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground",
          "transition-colors duration-fast ease-standard focus-ring hover:bg-sidebar-accent",
          "[&_svg]:size-5 [&_svg]:shrink-0",
          isActive &&
            "bg-sidebar-accent font-semibold before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
          className,
        )}
        {...props}
      />
    </SheetClose>
  );
}

/** The content column next to the sidebar. */
export function SidebarInset({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-dvh min-w-0 flex-col md:pl-(--sidebar-width)",
        className,
      )}
      {...props}
    />
  );
}
