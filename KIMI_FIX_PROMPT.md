# Kimi — Fix All Issues in AxisBill (DO NOT TOUCH UI)

You are tasked with fixing ALL functional, security, performance, and code quality issues in this Next.js invoicing application called **AxisBill**. 

## CRITICAL CONSTRAINT: DO NOT MODIFY ANY UI/STYLING

- **DO NOT** change any Tailwind CSS classes
- **DO NOT** change any visual appearance, colors, layouts, spacing, or design
- **DO NOT** modify anything related to how the app looks
- **DO NOT** change JSX structure that affects visual rendering
- **DO** fix bugs, security issues, performance problems, and code quality issues
- **DO** improve error handling, data validation, type safety, and architecture

If a fix would require changing UI, find an alternative approach that preserves the exact same visual output.

---

## Project Overview

- **Framework**: Next.js 16.2.3 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4.x
- **Key dependencies**: date-fns, lucide-react, jspdf, html2canvas, recharts, resend, stripe, twilio

---

## Issues to Fix (Prioritized)

### 1. CRITICAL SECURITY ISSUES

#### 1.1 Exposed API Keys in .env.local
The `.env.local` file contains live production API keys that should NEVER be committed or used in development:
- `STRIPE_SECRET_KEY=sk_live_...` (live Stripe key!)
- `SUPABASE_SERVICE_ROLE_KEY` (service role key should never be client-accessible)
- `TWILIO_AUTH_TOKEN`
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_SECRET`

**Fix**: 
- Replace all live keys with test/sandbox keys or placeholders
- Add `.env.local` to `.gitignore` if not already there
- Add `.env.example` with placeholder values documenting required env vars
- Ensure service role key is never exposed to client-side code

#### 1.2 Supabase Client-Side Security
`src/app/lib/supabase.ts` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` which is correct, but ensure Row Level Security (RLS) is properly configured. The code should also validate that sensitive operations (delete, update) are properly authorized.

**Fix**:
- Add RLS policy checks in server-side code
- Ensure the server-side Supabase client uses the service role key (from env, not exposed)
- Add authorization checks before all write operations

#### 1.3 Missing Input Validation & Sanitization
Several API endpoints and components accept user input without proper validation:
- `src/app/api/send-invoice/route.ts` - validates email but doesn't validate HTML content length or sanitize it
- `src/app/invoices/[id]/page.tsx` - `handleSendEmail` doesn't validate the generated HTML size
- No CSRF protection
- No rate limiting on API endpoints

**Fix**:
- Add comprehensive input validation for all API endpoints
- Add rate limiting middleware
- Sanitize all user-provided content before storage or display
- Add maximum length checks for email HTML content

#### 1.4 Missing Authentication Checks
Several pages and API routes don't properly verify authentication:
- `src/app/dashboard/page.tsx` - checks auth in `useEffect` but doesn't block initial render
- `src/app/invoices/page.tsx` - similar issue
- Many API routes in `src/app/api/` may lack auth checks

**Fix**:
- Add proper auth checks at the top of every protected route
- Use middleware for route protection where appropriate
- Add loading states that don't flash unauthenticated content

### 2. CRITICAL BUGS

#### 2.1 Supabase Client Instantiation in Render Body
Multiple components call `createClient()` directly in the component body:
```typescript
const supabase = createClient(); // Called on every render!
```
This creates a new Supabase client instance on every render, which is inefficient and can cause issues.

**Files affected**:
- `src/app/dashboard/page.tsx` (line 319)
- `src/app/invoices/page.tsx` (line 77)
- `src/app/invoices/[id]/page.tsx` (line 19)
- `src/app/login/page.tsx` (line 27)
- `src/components/Sidebar.tsx` (line 77)

**Fix**: Move `createClient()` calls to `useMemo` or initialize once outside the component.

#### 2.2 Missing Error Handling in Async Operations
Many async operations have no error handling or only console.error:
- `src/app/dashboard/page.tsx` - `loadData()` silently fails
- `src/app/invoices/page.tsx` - `handleDelete`, `handleStatusChange` silently fail
- `src/app/invoices/[id]/page.tsx` - `handleUpdateStatus` has no error handling

**Fix**: Add proper error handling with user-facing error messages (non-UI: use toast/notification state, not alerts where possible, but preserve existing alert patterns if they're the only mechanism).

#### 2.3 Race Conditions
- `src/app/login/page.tsx` - `handleCrewInvite` calls `supabase.auth.getUser()` immediately after signUp/signIn, but the user session may not be fully established yet
- Multiple components have `useEffect` with no cleanup, causing memory leaks and race conditions on unmount

**Fix**:
- Add proper async sequencing and error handling
- Add AbortController cleanup to useEffect hooks
- Add loading/optimistic states to prevent double-submissions

#### 2.4 Type Safety Issues
- `src/app/invoices/[id]/page.tsx` uses `any` for invoice, items, client, business
- `src/app/dashboard/page.tsx` uses `any` for settings, business, chartData
- Many components lack proper TypeScript interfaces

**Fix**: Define proper TypeScript interfaces for all data models and use them consistently.

### 3. PERFORMANCE ISSUES

#### 3.1 Missing React.memo and useCallback
Components like `StatCard`, `QuickAction`, `InvoiceRow` in dashboard are redefined on every render without memoization.

**Fix**: 
- Move component definitions outside the main component or wrap in `React.memo`
- Use `useCallback` for event handlers passed as props

#### 3.2 Inefficient Filtering and Sorting
- `src/app/invoices/page.tsx` - `filteredInvoices` is computed on every render via a function call (not memoized)
- Dashboard stats computed via `useMemo` but could be optimized further

**Fix**: Use `useMemo` for all computed values that depend on state.

#### 3.3 Unnecessary Re-renders
- Multiple `useState` calls that could be combined
- No proper dependency arrays in some `useEffect` hooks

**Fix**: Review and optimize state management and effect dependencies.

### 4. CODE QUALITY ISSUES

#### 4.1 Inconsistent Error Handling Patterns
Some places use `alert()`, some use state-based messages, some silently fail.

**Fix**: Standardize error handling approach across the app (use state-based notifications, preserve existing UI patterns).

#### 4.2 Magic Strings and Hardcoded Values
- Status values like "draft", "sent", "paid", "overdue", "cancelled" are hardcoded in multiple places
- Color classes are duplicated

**Fix**: Create constants/enums for status values and shared configurations.

#### 4.3 Missing Loading States
Some operations lack proper loading indicators, leaving users unsure if action is in progress.

**Fix**: Add consistent loading states for all async operations.

#### 4.4 Console.log in Production
Multiple files have `console.log` and `console.error` that should use a proper logging system.

**Fix**: Replace with a proper logging utility that can be configured for production vs development.

### 5. ACCESSIBILITY ISSUES

#### 5.1 Missing ARIA Labels
- Buttons with only icons lack `aria-label`
- Form inputs may lack proper labels
- Interactive elements may not be keyboard accessible

**Fix**: Add proper ARIA attributes and ensure keyboard navigation works.

### 6. MISSING FEATURES / INCOMPLETE IMPLEMENTATIONS

#### 6.1 Mock API Wrappers - USE REAL APIS
`src/app/lib/safe-apis.ts` contains mock implementations. The user wants ALL real APIs from `.env.local` to be used directly, INCLUDING Stripe. The user just doesn't want to actually test payments (no real charges), but wants the Stripe integration to be real.

**Fix**: 
- Modify `src/app/lib/safe-apis.ts` to call real APIs for ALL services including Stripe
- Remove all mock implementations
- Ensure Stripe uses the real API key from `.env.local` but in test mode (use Stripe test keys)
- Test each integration to verify it works with real APIs

#### 6.2 Incomplete API Routes
Many API routes in `src/app/api/` may be stubs or incomplete. Review and ensure they:
- Have proper authentication
- Have proper error handling
- Have proper input validation
- Return appropriate HTTP status codes

### 7. DATABASE / SUPABASE ISSUES

#### 7.1 Missing Error Handling for Database Operations
Supabase queries often don't check for errors properly:
```typescript
const { data, error } = await supabase.from("table").select("*");
// error is often not checked
```

**Fix**: Always check and handle the `error` returned from Supabase operations.

#### 7.2 Missing Null Checks
Data from Supabase is often used without null checks, which can cause runtime errors.

**Fix**: Add proper null/undefined checks before accessing properties.

### 8. ENVIRONMENT CONFIGURATION

#### 8.1 Missing Environment Variables
The app relies on many environment variables. Ensure all required variables are:
- Documented in `.env.example`
- Have proper fallback values where appropriate
- Are validated at startup

**Fix**: Create a proper environment configuration system.

---

## Files to Review and Fix

### High Priority (Security & Critical Bugs):
1. `.env.local` - Replace live keys
2. `src/app/lib/supabase.ts` - Fix client instantiation
3. `src/app/lib/supabase-server.ts` - Ensure proper auth
4. `src/app/lib/safe-apis.ts` - Remove mocks for production
5. `src/app/api/send-invoice/route.ts` - Add validation, rate limiting
6. `src/app/login/page.tsx` - Fix race conditions, auth handling
7. `src/app/invoices/[id]/page.tsx` - Fix type safety, error handling
8. `src/app/invoices/page.tsx` - Fix client instantiation, error handling
9. `src/app/dashboard/page.tsx` - Fix client instantiation, error handling
10. `src/components/Sidebar.tsx` - Fix client instantiation

### Medium Priority (Code Quality):
11. All API routes in `src/app/api/` - Review for auth, validation, error handling
12. `src/app/quotes/[id]/page.tsx` - Similar issues as invoices
13. `src/app/clients/page.tsx` - Review for security and bugs
14. `src/app/jobs/page.tsx` - Review for security and bugs
15. `src/app/crew/page.tsx` - Review for security and bugs
16. `src/app/expenses/page.tsx` - Review for security and bugs
17. `src/app/settings/page.tsx` - Review for security and bugs

### Lower Priority (Performance & Polish):
18. All pages - Add React.memo, useCallback where beneficial
19. All pages - Add proper TypeScript types
20. All pages - Add accessibility improvements

---

## Approach

1. **Start with security** - Fix all security issues first
2. **Then fix critical bugs** - Race conditions, error handling, type safety
3. **Then improve code quality** - Refactor, add types, improve patterns
4. **Then optimize performance** - Memoization, reducing re-renders
5. **Finally, polish** - Accessibility, logging, documentation

## Testing After Fixes

After making changes, verify:
1. The app builds without errors: `npm run build`
2. The linter passes: `npm run lint`
3. TypeScript compiles: `npx tsc --noEmit`
4. All auth flows work correctly
5. All CRUD operations work correctly
6. Error states are handled gracefully

---

## Important Reminders

- **DO NOT CHANGE ANY UI** - Preserve all visual appearance exactly
- Focus on functionality, security, performance, and code quality
- If unsure about a change, err on the side of caution
- Test thoroughly after each set of changes
- Document any assumptions or decisions made