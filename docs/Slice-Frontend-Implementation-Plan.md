# Slice — Frontend Implementation Plan
**Stack: Vite + React 18 SPA**
*For AI agent implementation. Each phase is independently executable and verifiable.*

---

## Testing Stack

All phases share the same testing setup, installed once during Phase 0.

| Layer | Tool | Purpose |
|---|---|---|
| Unit + Integration | Vitest + React Testing Library (RTL) | Component logic, render output, user interactions |
| End-to-End | Playwright | Full user flows in a real browser |
| API Mocking | MSW (Mock Service Worker) | Intercept fetch calls in tests without a live backend |
| Coverage | Vitest `--coverage` (v8) | Enforce minimum coverage thresholds per phase |

**Philosophy:** Unit tests verify components in isolation. Integration tests verify components talking to mocked APIs. E2E tests verify full user flows against a running dev server. Every phase must pass all three layers before the next phase begins.

---

## Project File Structure (Target State)

```
slice-frontend/
├── index.html
├── vite.config.js
├── playwright.config.js
├── vitest.config.js
│
├── public/
│   └── fonts/                    ← ABC Oracle WOFF2/WOFF (self-hosted)
│
├── src/
│   ├── main.jsx                  ← ReactDOM.createRoot, mounts <App />
│   ├── App.jsx                   ← React Router: all routes defined here
│   │
│   ├── styles/
│   │   └── tokens.css            ← all CSS custom properties, shared globally
│   │
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── Catalog.jsx
│   │   ├── Upload.jsx
│   │   └── Editor.jsx
│   │
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── DeleteModal.jsx
│   │   ├── DropZone.jsx
│   │   └── SliceEditor.jsx       ← existing file, moved here
│   │
│   ├── context/
│   │   └── AuthContext.jsx       ← Supabase session, shared app-wide
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useProjects.js
│   │   └── useTaskPoller.js
│   │
│   └── lib/
│       ├── supabase.js           ← Supabase client singleton
│       └── api.js                ← typed fetch wrappers for FastAPI
│
├── tests/
│   ├── unit/                     ← Vitest + RTL tests
│   └── e2e/                      ← Playwright tests
│
└── mocks/
    └── handlers.js               ← MSW request handlers (shared across unit + e2e)
```

---

## Design Token Reference

These must be extracted into `src/styles/tokens.css` before any component is written. Every component inherits from this file — never hardcode these values inline.

```css
:root {
  /* Backgrounds */
  --bg:              #725656;   /* dark page bg (login, editor, catalog) */
  --bg-light:        #F4EFDC;   /* light page bg (landing only) */
  --bg-sidebar:      #694D4D;   /* sidebar + field/input background */
  --bg-drop-hover:   #5e4545;   /* dropzone hover / focused fields */

  /* Text */
  --ink:             #F4EFDC;   /* primary text on dark */
  --ink-dark:        #725656;   /* primary text on light (landing, cards) */
  --ink-dim:         #c4a89a;   /* placeholder text, secondary labels */
  --ink-muted:       #9a7878;   /* panel headings, disabled states */

  /* Cards */
  --card-bg:         #E7F4BB;   /* project card background */
  --card-border:     #00A6F4;   /* selected card border */
  --card-w:          317px;
  --card-h:          229px;

  /* Editor */
  --slice-green:     #00C48C;   /* unselected slice border */
  --slice-blue:      #00A6F4;   /* selected slice border + handles */

  /* Dot grid (applied via background-image in body) */
  --dot-color-dark:  #9e7a7a;
  --dot-color-light: #c8bfa8;
  --dot-size:        22px;
  --dot-r:           1.5px;

  /* Layout */
  --radius:          2px;
  --sidebar-w:       71px;
}
```

---

## Phase 0 — Project Scaffolding

**Goal:** A running Vite + React project with routing, testing infrastructure, and shared tokens. No real UI yet — every route renders a named placeholder.

### Tasks

**0.1 — Init project**
```bash
npm create vite@latest slice-frontend -- --template react
cd slice-frontend
npm install
```

**0.2 — Install dependencies**
```bash
# Routing
npm install react-router-dom

# Supabase
npm install @supabase/supabase-js

# Testing
npm install -D vitest @vitest/coverage-v8 jsdom
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D msw playwright @playwright/test

# Playwright browsers
npx playwright install chromium
```

**0.3 — Configure Vitest** (`vitest.config.js`)
```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80 }
    }
  }
});
```

**0.4 — Configure Playwright** (`playwright.config.js`)
```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  }
});
```

**0.5 — Test setup file** (`tests/setup.js`)
```js
import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**0.6 — MSW server** (`mocks/server.js`)
```js
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

**0.7 — Create `tokens.css`**, wire `@import` in `src/main.jsx`

**0.8 — Create `App.jsx`** with React Router. Every route renders `<div data-testid="page-{name}">PageName</div>` as a stub.

```
Routes:
  /            → Landing
  /login       → Login
  /catalog     → Catalog  (protected)
  /upload      → Upload   (protected)
  /editor/:id  → Editor   (protected)
  *            → redirect to /
```

**0.9 — Create `.env.local`**
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://uarjoanuweuhgaxgcaxl.supabase.co
VITE_SUPABASE_ANON_KEY=<key>
```

---

### Phase 0 — Test Cases

#### Unit Tests (`tests/unit/App.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P0-U1 | Root path renders landing stub | `screen.getByTestId('page-landing')` is in the DOM |
| P0-U2 | `/login` renders login stub | Navigate to `/login`, assert `page-login` |
| P0-U3 | `/catalog` redirects to `/login` when unauthenticated | No auth in context → router sends to `/login` |
| P0-U4 | `/upload` redirects to `/login` when unauthenticated | Same as P0-U3 |
| P0-U5 | `/editor/123` redirects to `/login` when unauthenticated | Same as P0-U3 |
| P0-U6 | Unknown path redirects to `/` | Navigate to `/banana` → landing stub rendered |
| P0-U7 | `tokens.css` custom properties are loaded | `getComputedStyle(document.documentElement).getPropertyValue('--bg')` equals `#725656` |

#### E2E Tests (`tests/e2e/routing.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P0-E1 | Landing page is reachable | Navigate to `/` | Page title is "Slice" |
| P0-E2 | Unauthenticated catalog access redirects | Navigate to `/catalog` | URL becomes `/login` |
| P0-E3 | Unauthenticated editor access redirects | Navigate to `/editor/1` | URL becomes `/login` |

---

## Phase 1 — Static Pages: Landing + Login

**Goal:** Landing and Login are pixel-accurate React translations of the existing HTML files. No auth logic yet — the login button is wired but calls `console.log`. The dotgrid background, typography, animations, and layout must match the HTML mockups exactly.

### What to Build

**`Landing.jsx`** — translated from `slice-landing.html`
- Dot grid background via `tokens.css`
- Centered logo wordmark ("slice")
- Headline: "Turn email designs into export ready assets"
- Footer CTA row: arrow icon, "Request Beta Access" link, divider, "Login" link
- `fadeUp` / `fadeOnly` entrance animations (CSS keyframes, match existing delays)
- "Login" link navigates to `/login` via React Router `<Link>`

**`Login.jsx`** — translated from `slice-login.html`
- Logo at top center
- Centered form: email field, password field, login button — all 678×77px
- Dark dot-grid background
- Controlled inputs (`value` + `onChange` via `useState`)
- Submit handler calls `onSubmit(email, password)` prop (auth wired in Phase 2)
- `fadeUp` entrance animation

**Concept to understand — JSX translation rules:**
- `class` → `className`
- `for` (on `<label>`) → `htmlFor`
- Inline CSS uses camelCase object syntax: `style={{ backgroundColor: 'red' }}`
- Self-closing tags must close: `<input />` not `<input>`
- Event handlers are props: `onClick={handleClick}` not `onclick="handleClick()"`

---

### Phase 1 — Test Cases

#### Unit Tests (`tests/unit/Landing.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P1-U1 | Landing renders the headline | `screen.getByText('Turn email designs into export ready assets')` exists |
| P1-U2 | Landing renders the logo wordmark | `screen.getByText('slice')` exists |
| P1-U3 | "Request Beta Access" is an anchor tag | `getByRole('link', { name: /request beta access/i })` has `href="/request-access"` |
| P1-U4 | "Login" link navigates to `/login` | `getByRole('link', { name: /login/i })` has `href="/login"` |

#### Unit Tests (`tests/unit/Login.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P1-U5 | Login renders email and password fields | Both `getByPlaceholderText('Email')` and `getByPlaceholderText('Password')` exist |
| P1-U6 | Login renders a submit button | `getByRole('button', { name: /login/i })` exists |
| P1-U7 | Email field is controlled | Type into email field → `input.value` updates |
| P1-U8 | Password field is controlled | Type into password field → `input.value` updates |
| P1-U9 | Submitting empty form does not call `onSubmit` | Click login with empty fields → `onSubmit` mock not called |
| P1-U10 | Submitting with values calls `onSubmit(email, password)` | Fill both fields, click login → `onSubmit` called with correct args |
| P1-U11 | Password field has `type="password"` | Input is not readable as plain text |

#### E2E Tests (`tests/e2e/landing.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P1-E1 | Landing page loads and shows headline | Navigate to `/` | Headline text visible |
| P1-E2 | Login link navigates correctly | Click "Login" | URL is `/login` |
| P1-E3 | Login page loads all form elements | Navigate to `/login` | Email, password, button all visible |
| P1-E4 | Login page shows logo | Navigate to `/login` | "slice" wordmark visible |

---

## Phase 2 — Authentication

**Goal:** Wire Login to Supabase. Persist session in React Context. Protect routes. Handle token refresh. After login, redirect to `/catalog`. After logout, redirect to `/login`.

### What to Build

**`src/lib/supabase.js`** — Supabase client singleton
```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**`src/context/AuthContext.jsx`**
- `AuthProvider` wraps the whole app in `App.jsx`
- Calls `supabase.auth.getSession()` on mount to restore existing session
- Subscribes to `supabase.auth.onAuthStateChange` to react to login/logout/token refresh
- Exposes: `{ session, user, loading, signIn, signOut }`
- `loading = true` while the initial session check is in flight (prevents flash of redirect)

**`src/hooks/useAuth.js`**
```js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
export function useAuth() { return useContext(AuthContext); }
```

**`ProtectedRoute` component** (add to `App.jsx`)
- If `loading`: render a neutral loading state (not a redirect)
- If no `session`: redirect to `/login`
- If `session`: render `<Outlet />`

**`Login.jsx` — connect to auth**
- Call `signIn(email, password)` from context on submit
- On success: navigate to `/catalog`
- On error: show inline error message below the button (same styling as the button, red text)

**Concept to understand — React Context:**
Context is React's built-in way to share state across the component tree without passing it as props through every level. Think of it as a global variable, but one that triggers re-renders when it changes. `AuthContext` holds the Supabase session so any component — Sidebar, a page, a hook — can call `useAuth()` and know whether the user is logged in.

---

### Phase 2 — Test Cases

**Note:** Supabase is mocked via MSW in unit tests. Never call the real Supabase in tests.

#### MSW Handlers to add (`mocks/handlers.js`)

```js
// POST /auth/v1/token?grant_type=password → success
// POST /auth/v1/token?grant_type=password → failure (401)
// POST /auth/v1/logout → 204
```

#### Unit Tests (`tests/unit/AuthContext.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P2-U1 | `loading` is `true` before session resolves | Render `AuthProvider` → immediately read `loading` → `true` |
| P2-U2 | `loading` becomes `false` after session resolves | Wait for async session check → `loading` is `false` |
| P2-U3 | `session` is `null` when no stored session | MSW returns no session → `session` is `null` |
| P2-U4 | `session` is populated after `signIn` success | Call `signIn` with valid creds (MSW mocked) → `session.access_token` is defined |
| P2-U5 | `signIn` throws on invalid credentials | MSW returns 401 → `signIn` throws / rejects |
| P2-U6 | `signOut` clears `session` | Call `signOut` → `session` becomes `null` |

#### Unit Tests (`tests/unit/ProtectedRoute.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P2-U7 | Shows nothing (or spinner) while loading | `loading=true` → children not rendered |
| P2-U8 | Redirects to `/login` when no session | `session=null, loading=false` → URL is `/login` |
| P2-U9 | Renders children when session exists | `session=<mock>, loading=false` → children rendered |

#### Unit Tests (`tests/unit/Login.test.jsx` — additions)

| ID | Test | Assertion |
|---|---|---|
| P2-U10 | Successful login navigates to `/catalog` | Fill fields, submit → `window.location.pathname` is `/catalog` |
| P2-U11 | Failed login shows error message | MSW returns 401 → error text visible below button |
| P2-U12 | Error message disappears when user edits fields | After error shown, type in email field → error text gone |
| P2-U13 | Button is disabled during login request | Submit → button `disabled` attribute is true while request is in flight |

#### E2E Tests (`tests/e2e/auth.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P2-E1 | Valid login redirects to catalog | Fill login form with valid creds, click Login | URL is `/catalog` |
| P2-E2 | Invalid login shows error | Fill with wrong password, click Login | Error message visible on page |
| P2-E3 | Authenticated user can access catalog | Login first, navigate to `/catalog` | Page renders (not redirected to login) |
| P2-E4 | Page refresh preserves session | Login, refresh page | URL stays at `/catalog`, not redirected |
| P2-E5 | Logged-out user cannot access catalog | Log out, navigate to `/catalog` | Redirected to `/login` |

---

## Phase 3 — Catalog Page

**Goal:** Fetch and render real projects from the API. Implement card selection, delete with confirmation modal, and navigation to the editor on double-click.

### What to Build

**`src/hooks/useProjects.js`**
- `GET /api/v1/projects` on mount, passing JWT in Authorization header
- Exposes: `{ projects, loading, error, deleteProject }`
- `deleteProject(id)`: calls `DELETE /api/v1/projects/:id`, removes item from local state optimistically, rolls back on error

**`Catalog.jsx`**
- Uses `useProjects()` hook
- Renders `DeleteModal` with the selected project's name
- Single click → select card (toggle)
- Double click → navigate to `/editor/:id`
- Sidebar trash button enabled only when a card is selected

**`DeleteModal.jsx`** — extracted from the HTML mockup
- Props: `{ projectName, onConfirm, onCancel, visible }`
- Pure presentational component — no state of its own

**`Sidebar.jsx`** — shared component
- Props: `{ showTrash, trashEnabled, onTrashClick, showBack, onBackClick }`
- Renders the logo mark, upload button, and conditionally trash/back button

**Concept to understand — optimistic UI:**
Instead of waiting for the server to confirm a delete before removing the card, you remove it from local state immediately (optimistic), then confirm with the server in the background. If the server call fails, you restore the card. This makes the UI feel instant. It's the pattern modern apps like Notion and Linear use.

---

### Phase 3 — Test Cases

#### MSW Handlers to add

```js
// GET  /api/v1/projects          → [{ id, name, date, thumbnailUrl }]
// GET  /api/v1/projects (empty)  → []
// DELETE /api/v1/projects/:id    → { success: true }
// DELETE /api/v1/projects/:id    → 500 (for rollback test)
```

#### Unit Tests (`tests/unit/useProjects.test.js`)

| ID | Test | Assertion |
|---|---|---|
| P3-U1 | Returns `loading=true` initially | Hook renders → `loading` is `true` before MSW resolves |
| P3-U2 | Returns projects array on success | MSW returns 2 projects → `projects.length === 2` |
| P3-U3 | Returns `error` on API failure | MSW returns 500 → `error` is defined |
| P3-U4 | `deleteProject` removes item from state | Call `deleteProject(1)` → `projects` no longer contains id 1 |
| P3-U5 | `deleteProject` rolls back on server error | MSW returns 500 on DELETE → project reappears in `projects` |
| P3-U6 | Authorization header is sent | MSW handler asserts `req.headers.get('Authorization')` starts with `Bearer ` |

#### Unit Tests (`tests/unit/Catalog.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P3-U7 | Renders a card for each project | MSW returns 4 projects → 4 cards in DOM |
| P3-U8 | Empty state: no cards rendered | MSW returns `[]` → zero cards, no crash |
| P3-U9 | Single click selects a card | Click card → card has `selected` class or aria attribute |
| P3-U10 | Clicking selected card deselects it | Click same card twice → no card is selected |
| P3-U11 | Trash button disabled when nothing selected | Initial render → trash button `disabled` |
| P3-U12 | Trash button enabled when card selected | Select a card → trash button not `disabled` |
| P3-U13 | Trash click opens delete modal | Select card, click trash → modal visible |
| P3-U14 | Modal shows correct project name | Select "Reformation email fall", click trash → modal text contains that name |
| P3-U15 | Modal cancel closes modal | Click cancel → modal not visible |
| P3-U16 | Modal confirm calls `deleteProject` | Click confirm → `deleteProject` called with correct id |
| P3-U17 | Modal closes after confirm | Click confirm → modal not visible |

#### Unit Tests (`tests/unit/DeleteModal.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P3-U18 | Not visible when `visible=false` | `visible={false}` → modal not in DOM or `display:none` |
| P3-U19 | Visible when `visible=true` | `visible={true}` → modal content visible |
| P3-U20 | Shows the project name | `projectName="My Project"` → "My Project" appears in modal text |
| P3-U21 | Cancel calls `onCancel` | Click cancel → `onCancel` mock called once |
| P3-U22 | Confirm calls `onConfirm` | Click confirm → `onConfirm` mock called once |
| P3-U23 | Clicking overlay calls `onCancel` | Click outside modal box → `onCancel` called |

#### E2E Tests (`tests/e2e/catalog.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P3-E1 | Catalog loads and shows projects | Login, navigate to `/catalog` | At least one card visible |
| P3-E2 | Card selection is visible | Click a card | Card has visible border/highlight |
| P3-E3 | Delete flow removes card | Select card, click trash, confirm delete | Card is no longer visible |
| P3-E4 | Double-click navigates to editor | Double-click a card | URL changes to `/editor/:id` |
| P3-E5 | Upload button navigates to upload | Click upload icon in sidebar | URL changes to `/upload` |

---

## Phase 4 — Upload Page

**Goal:** Wire the dropzone (drag, paste, file picker) to the async upload API. After upload, poll for the task result, then navigate to the editor with the returned `projectId`.

### What to Build

**`DropZone.jsx`** — extracted component
- Props: `{ onFile }` — calls `onFile(File)` when a file is received
- Handles: click-to-pick, drag-over + drop, paste from clipboard
- Visual: matches the 678×77px design from `slice-upload-new.html`
- Drag-over state adds hover styling

**`Upload.jsx`**
- Two visual states driven by whether the catalog has existing projects:
  - **Empty state** (`slice-upload-new.html`): full-center dropzone, no background
  - **Overlay state** (`slice-upload-with-content.html`): blurred card grid in background, close button
- On file received:
  1. POST to `/api/v1/predict-async` with `multipart/form-data`, JWT in header
  2. Get back `{ task_id }`
  3. Start polling `/api/v1/task/:task_id` every 2s via `useTaskPoller`
  4. Show a loading indicator during polling
  5. On `SUCCESS`: extract `projectId` from result, navigate to `/editor/:projectId`
  6. On `FAILURE`: show error message, allow retry

**`src/hooks/useTaskPoller.js`**
- Args: `taskId`, `onSuccess(result)`, `onError(error)`
- Polls every 2000ms while `status` is `PENDING` or `PROCESSING`
- Cleans up the interval on unmount (critical — prevents memory leaks)
- Exposes: `{ status, progress }`

**Concept to understand — cleanup in `useEffect`:**
When a component unmounts (e.g., user navigates away), any running `setInterval` keeps running unless you explicitly stop it. React's `useEffect` solves this with a cleanup function — the function you return from `useEffect` runs when the component unmounts. Every effect that starts a timer or subscription must return a cleanup.

```js
useEffect(() => {
  const interval = setInterval(poll, 2000);
  return () => clearInterval(interval); // ← cleanup
}, [taskId]);
```

---

### Phase 4 — Test Cases

#### MSW Handlers to add

```js
// POST /api/v1/predict-async     → { task_id: 'task-123', status: 'PENDING' }
// POST /api/v1/predict-async     → 400 (invalid file type)
// GET  /api/v1/task/task-123     → { status: 'PROCESSING', progress: 50 }
// GET  /api/v1/task/task-123     → { status: 'SUCCESS', result: { projectId: 'proj-1' } }
// GET  /api/v1/task/task-fail    → { status: 'FAILURE', error: 'Model error' }
```

#### Unit Tests (`tests/unit/DropZone.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P4-U1 | Renders upload prompt text | `screen.getByText(/drag or paste image here/i)` visible |
| P4-U2 | File input accepts image types only | File input has `accept="image/*"` |
| P4-U3 | Dropping a file calls `onFile` | Simulate drop event with a File object → `onFile` called with that file |
| P4-U4 | Dropping a non-image does not call `onFile` | Drop a `.pdf` file → `onFile` not called |
| P4-U5 | Drag-over adds hover class | `dragover` event → dropzone has `drag-over` class |
| P4-U6 | Drag-leave removes hover class | `dragleave` after `dragover` → `drag-over` class removed |
| P4-U7 | Paste image calls `onFile` | Simulate paste event with image item → `onFile` called |
| P4-U8 | Paste non-image does not call `onFile` | Paste text → `onFile` not called |

#### Unit Tests (`tests/unit/useTaskPoller.test.js`)

| ID | Test | Assertion |
|---|---|---|
| P4-U9 | Does not poll when `taskId` is null | No fetch calls made |
| P4-U10 | Polls the correct URL | `GET /api/v1/task/task-123` is called |
| P4-U11 | Calls `onSuccess` when status is SUCCESS | MSW returns SUCCESS → `onSuccess` called with result |
| P4-U12 | Calls `onError` when status is FAILURE | MSW returns FAILURE → `onError` called with error message |
| P4-U13 | Stops polling after SUCCESS | After `onSuccess`, no further fetch calls |
| P4-U14 | Stops polling after FAILURE | After `onError`, no further fetch calls |
| P4-U15 | Cleans up interval on unmount | Unmount hook while polling → `clearInterval` called (spy on global) |

#### Unit Tests (`tests/unit/Upload.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P4-U16 | Shows loading state after file drop | Drop file → loading indicator visible |
| P4-U17 | Hides dropzone during loading | Loading state → dropzone not interactive |
| P4-U18 | Navigates to editor on task success | Poll resolves with `projectId='proj-1'` → navigate called with `/editor/proj-1` |
| P4-U19 | Shows error message on task failure | Poll resolves with FAILURE → error text visible |
| P4-U20 | Error state allows retry | After error, dropzone visible again |
| P4-U21 | Sends Authorization header in POST | MSW handler asserts bearer token present |
| P4-U22 | Rejects non-image file with user-visible message | Drop PDF → no API call, error shown to user |

#### E2E Tests (`tests/e2e/upload.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P4-E1 | Upload page loads | Login, navigate to `/upload` | Dropzone visible |
| P4-E2 | File upload triggers loading state | Drop valid image file | Loading indicator appears |
| P4-E3 | Successful upload navigates to editor | Drop file, polling resolves SUCCESS | URL changes to `/editor/:id` |
| P4-E4 | Failed upload shows error | MSW overridden to return FAILURE | Error message visible, dropzone re-appears |
| P4-E5 | Close button returns to catalog | Click close (×) button | URL is `/catalog` |

---

## Phase 5 — Editor Integration

**Goal:** Mount `SliceEditor.jsx` in the editor page, replace all mock data with real API calls, and wire the export buttons to the backend. The component itself is pre-built — this phase is pure integration.

### What to Build

**`Editor.jsx`**
- Reads `:id` from URL params (`useParams()`)
- Fetches `GET /api/v1/projects/:id/slices` on mount, passing JWT
- Passes `imageUrl`, `imageWidth`, `imageHeight`, `slices` as props to `SliceEditor`
- Handles loading and error states before the editor mounts

**`SliceEditor.jsx` — modify the three 🔌 BACKEND stubs**

Stub 1 — Load data (`useEffect` on mount):
```js
// Replace the setInterval mock with:
fetch(`${API_URL}/projects/${projectId}/slices`, {
  headers: { Authorization: `Bearer ${session.access_token}` }
})
.then(r => r.json())
.then(data => { setImageUrl(data.imageUrl); setSlices(data.slices); setStatus('ready'); })
.catch(() => setStatus('error'));
```

Stub 2 — `exportAll`:
```js
fetch(`${API_URL}/projects/${projectId}/export`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slices })
})
.then(r => r.blob())
.then(blob => { /* trigger download */ });
```

Stub 3 — `exportSelected`: same as above but with `body: JSON.stringify({ slices: [selected] })`

**Download trigger utility** (`src/lib/api.js`):
```js
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

**`onBack` prop** — wired to `navigate('/catalog')`

---

### Phase 5 — Test Cases

#### MSW Handlers to add

```js
// GET  /api/v1/projects/:id/slices → { imageUrl, imageWidth, imageHeight, slices[] }
// GET  /api/v1/projects/:id/slices → 404 (project not found)
// POST /api/v1/projects/:id/export → Blob (zip file)
```

#### Unit Tests (`tests/unit/Editor.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P5-U1 | Shows loading state on mount | Before MSW resolves → loading indicator visible |
| P5-U2 | Renders SliceEditor after data loads | MSW returns slice data → `SliceEditor` in DOM |
| P5-U3 | Shows error state on 404 | MSW returns 404 → error message visible |
| P5-U4 | Passes correct projectId to SliceEditor | URL `/editor/proj-42` → `SliceEditor` receives `projectId="proj-42"` |
| P5-U5 | Back button navigates to catalog | Click back → `navigate('/catalog')` called |

#### Unit Tests (`tests/unit/SliceEditor.test.jsx`)

| ID | Test | Assertion |
|---|---|---|
| P5-U6 | Renders image when `imageUrl` is set | Image element with correct `src` in DOM |
| P5-U7 | Renders one slice overlay per slice | 3 slices in props → 3 slice boxes rendered |
| P5-U8 | Clicking a slice selects it | Click slice → slice gets selected border color (`--slice-blue`) |
| P5-U9 | Clicking selected slice deselects | Click same slice twice → slice reverts to idle color |
| P5-U10 | Inspector panel shows selected slice label | Select slice with label "Hero" → "Hero" visible in panel |
| P5-U11 | Inspector label input updates slice label | Change label input to "Header" → slice label updates |
| P5-U12 | Format dropdown updates slice format | Change to "JPG" → slice format is "JPG" |
| P5-U13 | Scale dropdown updates slice scale | Change to "1x" → slice scale is "1x" |
| P5-U14 | Export All button calls export API | Click "Export All" → `POST /api/v1/projects/:id/export` called with all slices |
| P5-U15 | Export Selected disabled when nothing selected | No slice selected → "Export Selected" button disabled |
| P5-U16 | Export Selected sends only selected slice | Select slice 2, click "Export Selected" → payload contains only slice 2 |
| P5-U17 | Zoom slider changes display scale | Move zoom slider → image wrapper dimensions change |
| P5-U18 | Dragging bottom handle resizes adjacent slices | Simulate mousedown/mousemove/mouseup on bottom handle → adjacent slice heights updated |

#### E2E Tests (`tests/e2e/editor.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P5-E1 | Editor loads from catalog | Login, double-click card | Editor page renders with image visible |
| P5-E2 | Slices render on image | Editor loaded | Colored overlay boxes visible on image |
| P5-E3 | Selecting slice highlights it | Click a slice | Slice border changes to blue |
| P5-E4 | Inspector panel populates | Select a slice | Right panel shows slice label and controls |
| P5-E5 | Export All triggers download | Click "Export All" | File download initiated (no crash, no 4xx/5xx) |
| P5-E6 | Back button returns to catalog | Click back arrow | URL is `/catalog` |

---

## Phase 6 — Polish and Production Readiness

**Goal:** Performance, accessibility, error boundaries, and deployment configuration. No new features — hardening only.

### Tasks

**6.1 — Error Boundary** (wraps the whole app): catches JS exceptions in the editor and shows a fallback UI instead of a blank screen.

**6.2 — Token refresh**: Supabase refresh_token expires after 1 hour. The `AuthContext` must listen for `TOKEN_REFRESHED` events from `onAuthStateChange` and update the session silently. No user action required.

**6.3 — API error handling in `api.js`**: Every fetch wrapper must check `response.ok`. On 401, call `signOut()` and redirect to `/login`. On 5xx, throw with the error message from `response.json().detail`.

**6.4 — Accessibility audit**: All interactive elements must have accessible labels (`aria-label` or visible text). Focus ring must be visible on all buttons and inputs. Keyboard navigation must work on the catalog grid (arrow keys to move selection).

**6.5 — `vite.config.js` production settings**: set `base` to match your CDN/hosting path. Enable `build.sourcemap` for production debugging.

**6.6 — Deploy**: `npm run build` outputs `dist/`. Upload to Linode object storage or Netlify. Point your domain to the dist folder.

---

### Phase 6 — Test Cases

#### Unit Tests

| ID | Test | Assertion |
|---|---|---|
| P6-U1 | Error Boundary catches render error | Render a component that throws → fallback UI visible, app not blank |
| P6-U2 | 401 response triggers `signOut` | MSW returns 401 on any API call → `signOut` called, redirect to `/login` |
| P6-U3 | Token refresh updates session | Simulate `TOKEN_REFRESHED` event → `session.access_token` updated in context |
| P6-U4 | All buttons have accessible names | RTL `getByRole('button')` → each button has text or `aria-label` |

#### E2E Tests (`tests/e2e/polish.spec.js`)

| ID | Test | Steps | Assertion |
|---|---|---|---|
| P6-E1 | App does not crash on full user flow | Login → catalog → upload → editor → export → back → delete | No console errors, no uncaught exceptions |
| P6-E2 | Session persists across hard refresh | Login, press F5 on catalog | Still on catalog, not redirected |
| P6-E3 | Keyboard navigation on catalog | Tab to first card, press Enter | Card selected |
| P6-E4 | Focus visible on all interactive elements | Tab through entire app | Focus ring visible at every stop |

---

## Agent Handoff Checklist

Before moving from one phase to the next, the agent must verify:

```
[ ] All unit tests in this phase pass: npx vitest run --reporter=verbose
[ ] All E2E tests in this phase pass: npx playwright test
[ ] Coverage threshold met: npx vitest run --coverage (≥ 80% lines)
[ ] No TypeScript/ESLint errors (if configured)
[ ] The dev server starts without warnings: npm run dev
[ ] The production build succeeds: npm run build
```

No phase begins until the previous phase's checklist is fully green.
