# Mobile header taps land on an invisible toast strip

**Where:** `src/components/ui/toast.jsx`, `ToastViewport` (mounted app-wide by `<Toaster />` in `src/App.jsx`).

**What happens:** on phones the account avatar, notification bell and back button in the top bar only respond if you tap their lower part. A tap near their centre does nothing.

**Why:** the toast viewport renders even when no toast is showing. Below the `sm` breakpoint its classes are `fixed top-0 z-[100] flex max-h-screen w-full ... p-4`: a full-width strip, 32px tall (the padding), pinned over the top of the header at z-index 100.

**Evidence** (headless Chrome at 390px, `/Dashboard`):
- `document.elementFromPoint` at the avatar's centre returns the toast viewport, not the button.
- `page.tap()` and `page.click()` on the avatar leave its menu closed; focusing it and pressing Enter opens it.

**Suggested fix:** the standard one for this component. Add `pointer-events-none` to the viewport and `pointer-events-auto` to each toast, so the empty strip is click-through and real toasts stay clickable.

**Verify:** `scripts/snapshot-pages.cjs`, scenario `account-menu`, currently opens the phone menu from the keyboard *because* a tap cannot. After the fix, switch that step back to `tap` and it should pass.
