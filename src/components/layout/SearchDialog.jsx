import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardPlus,
  CreditCard,
  FilePlus2,
  Files,
  History,
  Palette,
  PlusCircle,
  Search,
  Wallet,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_GROUPS } from "@/components/layout/navigation";

/** Places the palette reaches that are not sidebar items. */
const ACTIONS = [
  { label: "Quick Invoice", url: createPageUrl("QuickInvoice"), icon: PlusCircle },
  { label: "Quick Quote", url: createPageUrl("QuickQuote"), icon: ClipboardPlus },
  { label: "New invoice", url: createPageUrl("CreateInvoice"), icon: FilePlus2 },
  { label: "New quote", url: createPageUrl("CreateQuote"), icon: FilePlus2 },
  { label: "Batch invoices", url: createPageUrl("BatchInvoices"), icon: Files },
  { label: "Paper Trail", url: createPageUrl("PaperTrail"), icon: History },
];
const SETTINGS = [
  { label: "Business information", tab: "business", icon: Building2 },
  { label: "Billing", tab: "billing", icon: CreditCard },
  { label: "Payments", tab: "payments", icon: Wallet },
  { label: "Appearance", tab: "appearance", icon: Palette },
].map((s) => ({ ...s, url: `${createPageUrl("Settings")}?tab=${s.tab}` }));

/**
 * The template's command palette (Cmd/Ctrl+J), searching every page the
 * sidebar lists -- so a plan-gated page is only offered when it is in the
 * sidebar too -- plus the create flows and Settings tabs.
 */
export default function SearchDialog({ navigation }) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const down = (e) => {
      if ((e.key === "j" || e.key === "k") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (url) => {
    setOpen(false);
    navigate(url);
  };

  const groups = [
    ...NAV_GROUPS.map((g) => ({
      heading: g.label || "Overview",
      items: navigation
        .filter((item) => item.group === g.id)
        .map((item) => ({ label: item.name, url: item.href, icon: item.icon })),
    })),
    { heading: "Create", items: ACTIONS },
    { heading: "Settings", items: SETTINGS },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="link"
        className="gap-2 px-0 font-normal text-muted-foreground hover:no-underline"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline-flex">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search pages, create an invoice, open settings…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group, index) => (
              <React.Fragment key={group.heading}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={group.heading}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={`${group.heading}-${item.label}`}
                      value={`${group.heading} ${item.label}`}
                      onSelect={() => go(item.url)}
                    >
                      {item.icon && <item.icon />}
                      <span className="truncate">{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
