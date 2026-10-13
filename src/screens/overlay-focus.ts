import { useEffect, type RefObject } from "react";

export function rememberOverlayOpener(
  store: { current: HTMLElement | null },
): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    store.current = active;
  }
}

export function restoreOverlayOpener(
  store: { current: HTMLElement | null },
): void {
  const target = store.current;
  store.current = null;
  if (target?.isConnected) {
    target.focus();
  }
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function useOverlayKeyboard(options: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  trapFocus?: boolean;
}): void {
  const { open, containerRef, onEscape, trapFocus = true } = options;

  useEffect(() => {
    if (!open) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== "Tab" || !trapFocus) {
        return;
      }

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const focusables = getFocusableElements(container);
    const initial = focusables[0];
    if (initial) {
      initial.focus();
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, containerRef, onEscape, trapFocus]);
}
