# Two dialogs have no title, so a screen reader announces nothing

**Where:** `src/components/onboarding/FeatureTour.jsx` and `src/components/onboarding/OnboardingModal.jsx` — the only two `DialogContent`s in the app with no `DialogTitle` inside them.

**What happens:** Radix logs this on every open, visible in the feature-tour snapshots:

    `DialogContent` requires a `DialogTitle` for the component to be accessible
    for screen reader users. If you want to hide the `DialogTitle`, you can wrap
    it with our VisuallyHidden component.

A dialog with no accessible name is announced as just "dialog". Both of these are the *first* thing a new user meets — the onboarding modal on signup, and the feature tour from Settings — so the two screens with the least context are the two that say the least.

Both draw a heading of their own (the tour renders the slide title in `TourSlideHeader`), so this is about the accessible name, not about visible design: nothing needs to look different.

**Suggested fix:** add a `DialogTitle` to each, wrapped in Radix's `VisuallyHidden` if it shouldn't be seen — or, better, mark up the heading each already renders as the `DialogTitle` so the name matches what is on screen. Same for `DialogDescription` if the subtitle suits it.

**Found:** 2026-09-11, as a console error in the new feature-tour snapshots, while splitting FeatureTour.jsx. Not fixed there: it changes the rendered DOM, and which element becomes the title is a judgement call worth making deliberately.
