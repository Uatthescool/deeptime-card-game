import { type ReactNode, useEffect, useRef } from "react";

type DialogProps = {
  label: string;
  className?: string;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
};

/**
 * A modal overlay that takes focus when it opens and keeps Tab inside itself,
 * so keyboard and screen-reader users land on the decision being asked.
 */
export function Dialog({ label, className = "", role = "dialog", children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    // A control marked data-autofocus takes focus first; otherwise the first focusable control does.
    const first =
      root.querySelector<HTMLElement>("[data-autofocus]") ??
      root.querySelector<HTMLElement>("button:not([disabled]), [href], input, select, [tabindex='0']");
    (first ?? root).focus();

    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [
        ...root.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, select, [tabindex='0']"),
      ];
      if (!focusable.length) return;
      const firstItem = focusable[0]!;
      const lastItem = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  return (
    <div
      className={`screen-overlay ${className}`}
      role={role}
      aria-modal="true"
      aria-label={label}
      ref={ref}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
