import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

const SelectContext = React.createContext({
  value: null,
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
});

const Select = ({ children, value, onValueChange, disabled = false }) => {
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
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

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        disabled,
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
    const { open, setOpen, disabled } = React.useContext(SelectContext);

    return (
      <button
        ref={ref}
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

const SelectValue = ({ placeholder = "Select...", children }) => {
  const { value } = React.useContext(SelectContext);
  const [displayValue, setDisplayValue] = React.useState(placeholder);

  React.useEffect(() => {
    if (children) {
      return;
    }

    if (value) {
      const timer = setTimeout(() => {
        const item = document.querySelector(
          `[data-select-item-value="${value}"]`,
        );
        if (item) {
          setDisplayValue(item.textContent.trim());
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setDisplayValue(placeholder);
    }
  }, [value, placeholder, children]);

  if (children) {
    return <span>{children}</span>;
  }

  return <span>{displayValue}</span>;
};

const SelectContent = ({ children, className = "" }) => {
  const { open } = React.useContext(SelectContext);

  if (!open) return null;

  return (
    <div
      className={`absolute z-[9999] mt-1 w-full min-w-[8rem] overflow-visible rounded-xl border bg-surface dark:bg-ink-800 dark:border-ink-700 shadow-xl animate-in fade-in-0 zoom-in-95 ${className}`}
    >
      <div className="p-1 max-h-60 overflow-auto">{children}</div>
    </div>
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
