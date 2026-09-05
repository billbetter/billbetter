import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

/**
 * A minimal Select whose menu is PORTALLED to document.body.
 *
 * -- Why the portal is the whole point -------------------------------------
 *
 * The menu used to be an absolutely-positioned sibling of the trigger, which
 * meant any ancestor with `overflow: hidden|auto|scroll` clipped it. The
 * invoice and quote tables scroll, so opening the status dropdown on a row near
 * the bottom showed two options and cut the rest off at the card's edge -- with
 * no way to reach them.
 *
 * It carried `z-[9999]`, which cannot help: z-index orders things that are
 * painted, and a clipped element is never painted outside its scroll container
 * in the first place. Escaping the container is the only fix, and a portal is
 * how you escape it.
 */

/**
 * The text of a React node, the way `textContent` would read it.
 *
 * Used to label the trigger from the item that carries the selected value.
 * Reading the elements the caller passed rather than the rendered DOM is the
 * point: the items are only mounted while the menu is open, so anything that
 * waits for them to appear is looking at a menu that has already closed.
 */
const textOf = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf(node.props?.children);
  return "";
};

/** Walks the passed elements for the SelectItem holding `value`. */
const labelForValue = (children, value) => {
  let label = null;

  const walk = (node) => {
    if (label !== null || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!React.isValidElement(node)) return;
    if (node.type === SelectItem && node.props?.value === value) {
      label = textOf(node.props.children);
      return;
    }
    walk(node.props?.children);
  };

  walk(children);
  return label;
};

const SelectContext = React.createContext({
  value: null,
  selectedLabel: null,
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
  triggerRef: { current: null },
  contentRef: { current: null },
});

const Select = ({ children, value, onValueChange, disabled = false }) => {
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      // BOTH refs, and this is not optional. Once the menu is portalled it is
      // no longer inside selectRef, so checking only that would treat every
      // click on an option as a click outside: mousedown would unmount the menu
      // and the option's own click would never land. The dropdown would open,
      // and then refuse to select anything.
      const inTrigger = selectRef.current?.contains(event.target);
      const inMenu = contentRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [open]);

  const handleValueChange = (newValue) => {
    onValueChange(newValue);
    setOpen(false);
  };

  // Resolved here, where every SelectItem the caller wrote is in reach as an
  // element, whether or not the menu happens to be mounted.
  const selectedLabel = React.useMemo(
    () =>
      value === null || value === undefined || value === ""
        ? null
        : labelForValue(children, value),
    [children, value],
  );

  return (
    <SelectContext.Provider
      value={{
        value,
        selectedLabel,
        onValueChange: handleValueChange,
        open,
        setOpen,
        disabled,
        triggerRef,
        contentRef,
      }}
    >
      <div ref={selectRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled, triggerRef } = React.useContext(SelectContext);

    // Kept in the context ref as well as any ref the caller passed, because the
    // portalled menu is positioned against this element's box and has no other
    // way to find it.
    const setRefs = (node) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <button
        ref={setRefs}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center justify-between rounded-xl border border-input bg-surface dark:bg-ink-800 dark:border-ink-700 dark:text-content-inverted px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className || ""}`}
        {...props}
      >
        {children}
        <ChevronDown
          className={`h-4 w-4 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

/*
  The trigger's label.

  This used to wait 10ms and then look for `[data-select-item-value="..."]` in
  the document. Choosing an option closes the menu in the same commit that
  changes the value, so by the time that query ran the items had been unmounted
  and it found nothing -- the trigger kept showing its placeholder, and picking
  a client read as not having picked one. It missed on mount too: a Select
  handed a value it already had showed "Select..." because the menu had never
  been opened, so the item had never been in the DOM to find.

  The label now comes from the element the caller wrote. No timing, nothing to
  miss, and correct on the first render.
*/
const SelectValue = ({ placeholder = "Select...", children }) => {
  const { selectedLabel } = React.useContext(SelectContext);

  if (children) {
    return <span>{children}</span>;
  }

  return <span>{selectedLabel || placeholder}</span>;
};

/** Gap between the trigger and the menu, and the smallest edge margin kept. */
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
/** The menu never grows past this even with room to spare. */
const MAX_MENU_HEIGHT = 240;

/**
 * Where to draw the menu, in viewport coordinates.
 *
 * Flips above the trigger when there is not enough room below -- which is the
 * common case for the last row of a table, and for almost every row on a phone.
 * Clamped horizontally so a menu wider than its trigger cannot run off the
 * right-hand edge.
 */
function menuPosition(rect) {
  const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const above = rect.top - VIEWPORT_MARGIN;

  // Only flip when below genuinely cannot hold a usable menu AND above is
  // roomier. Flipping on a near-tie makes the menu jump between renders.
  const flip = below < Math.min(MAX_MENU_HEIGHT, 160) && above > below;
  const space = Math.max(96, flip ? above : below);

  const width = Math.max(rect.width, 128);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
  );

  return {
    position: "fixed",
    left,
    width,
    maxHeight: Math.min(MAX_MENU_HEIGHT, space - MENU_GAP),
    ...(flip
      ? { bottom: window.innerHeight - rect.top + MENU_GAP }
      : { top: rect.bottom + MENU_GAP }),
  };
}

const SelectContent = ({ children, className = "" }) => {
  const { open, triggerRef, contentRef } = React.useContext(SelectContext);
  const [style, setStyle] = React.useState(null);

  // Measured in a layout effect so the menu is never painted at the wrong
  // place first, and re-measured on scroll and resize -- a fixed element does
  // not move with its trigger, so without this it would detach and float over
  // the page as soon as the table or the window scrolled. `true` captures
  // scrolls on inner containers, which is exactly what the invoice table is.
  React.useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const node = triggerRef.current;
      if (node) setStyle(menuPosition(node.getBoundingClientRect()));
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, triggerRef]);

  if (!open || !style) return null;

  const { maxHeight, ...boxStyle } = style;

  /*
    Portalled to the body, which is the entire point: an absolutely positioned
    sibling is clipped by any scrolling ancestor, and both the invoice and
    quote tables scroll.

    `pointerEvents: "auto"` is what makes the menu usable inside a modal.
    Radix's Dialog sets `document.body.style.pointerEvents = "none"` while it is
    open and re-enables events only on its own layer; this menu is a child of
    that body, so it inherited "none" and every option was painted, hoverable
    in appearance, and completely dead to the click. Restoring it here rather
    than at the call site fixes every Select that opens inside a dialog.

    Dismissal is already handled: Radix checks the React tree, not the DOM, so
    a pointerdown in this portal counts as inside the dialog and does not close
    it -- the portal is a React child of the dialog's content.
  */
  return createPortal(
    <div
      ref={contentRef}
      style={{ ...boxStyle, pointerEvents: "auto" }}
      className={`z-[9999] rounded-xl border bg-surface dark:bg-ink-800 dark:border-ink-700 shadow-xl animate-in fade-in-0 zoom-in-95 ${className}`}
    >
      <div className="p-1 overflow-auto" style={{ maxHeight }}>
        {children}
      </div>
    </div>,
    document.body,
  );
};

const SelectItem = React.forwardRef(
  ({ className = "", children, value: itemValue, ...props }, ref) => {
    const { value, onValueChange } = React.useContext(SelectContext);
    const isSelected = value === itemValue;

    return (
      <div
        ref={ref}
        data-select-item-value={itemValue}
        onClick={() => onValueChange(itemValue)}
        className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 px-2 text-sm outline-none transition-colors hover:bg-ink-100 dark:hover:bg-ink-700 focus:bg-ink-100 dark:focus:bg-ink-700 dark:text-ink-200 ${
          isSelected ? "bg-ink-100 dark:bg-ink-700 font-medium" : ""
        } ${className}`}
        {...props}
      >
        {isSelected && <Check className="w-4 h-4 mr-2 text-success-600" />}
        <span className={isSelected ? "ml-0" : "ml-6"}>{children}</span>
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectGroup = ({ children }) => <div className="py-1">{children}</div>;

const SelectLabel = ({ children, className = "" }) => (
  <div
    className={`px-2 py-1.5 text-xs font-semibold text-content-muted ${className}`}
  >
    {children}
  </div>
);

const SelectSeparator = ({ className = "" }) => (
  <div className={`-mx-1 my-1 h-px bg-ink-200 dark:bg-ink-700 ${className}`} />
);

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
