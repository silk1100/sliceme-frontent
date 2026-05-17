# Vite Frontend Implementation Guide

This document provides a comprehensive overview of the Slice frontend implementation, explaining how the frontend is structured, how it connects to the backend, and how the authentication and image upload modules work.

---

## Overview

This frontend is a **Vite + React 18 Single Page Application (SPA)**. Unlike a traditional server-rendered app, Vite compiles your React code into static JavaScript files that run directly in the browser.

### Tech Stack

- **Build Tool**: Vite
- **Framework**: React 18
- **Routing**: React Router v6
- **Authentication**: Supabase (via `@supabase/supabase-js`)
- **API**: FastAPI backend at `http://localhost:8000/api/v1`

---

## Project Structure

```
slice-frontend/
├── .env.local              # Environment variables (API URLs, keys)
├── index.html              # Entry HTML file
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── src/
│   ├── main.jsx            # React app entry point
│   ├── App.jsx             # Main app with routing
│   ├── styles/
│   │   └── tokens.css      # Design system (colors, fonts, spacing)
│   ├── pages/              # Page components
│   │   ├── Landing.jsx     # Home page (/)
│   │   ├── Login.jsx       # Login page (/login)
│   │   ├── Catalog.jsx     # Dashboard (/catalog)
│   │   └── Upload.jsx      # Upload page (/upload)
│   ├── components/         # Reusable UI components
│   │   ├── Sidebar.jsx     # Navigation sidebar
│   │   └── DeleteModal.jsx # Confirmation dialog
│   ├── context/
│   │   └── AuthContext.jsx # Authentication state management
│   ├── hooks/
│   │   └── useAuth.js      # Hook to access auth context
│   └── lib/
│       └── supabase.js     # Supabase client setup
```

---

## How to Run

### Development Mode (Recommended for Debugging)

```bash
cd slice-frontend
npm run dev -- --host 0.0.0.0
```

This starts a development server at `http://localhost:5173` with:
- Hot reloading (changes auto-update)
- Better error messages
- Source maps for debugging

### Production Build

```bash
cd slice-frontend
npm run build        # Creates optimized files in /dist
npx serve dist       # Serves the built files
```

---

## Environment Configuration

Create a `.env.local` file in the `slice-frontend` directory:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://uarjoanuweuhgaxgcaxl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcmpvYW51d2V1aGdheGdjYXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDcyNzksImV4cCI6MjA4NjcyMzI3OX0.fV_e7RNm9QHsSUeK0pltH0oQlthI8tKV1ono8LsU3kk
```

---

## Authentication Module

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│   │   Login.jsx  │────▶│ AuthContext   │────▶│  Supabase    │  │
│   │              │     │               │     │  (Auth API)  │  │
│   │  1. User    │     │ 2. Stores     │     │              │  │
│   │     enters  │     │    session    │     │ 3. Validates │  │
│   │     creds   │     │    state      │     │    creds     │  │
│   └──────────────┘     └──────────────┘     └──────────────┘  │
│          │                     │                     │          │
│          │                     ▼                     │          │
│          │            ┌──────────────┐              │          │
│          │            │   Catalog    │              │          │
│          │            │   (/catalog) │              │          │
│          │            │  PROTECTED   │              │          │
│          └───────────▶│   route      │◀─────────────┘          │
│                       └──────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. **User visits `/login`**
   - Login.jsx renders a form with email/password fields
   - User enters credentials and clicks "Login"

2. **Login.jsx calls `signIn(email, password)`**
   - Line 20: `await signIn(email, password)`
   - This function comes from `useAuth()` hook

3. **`useAuth()` gets it from AuthContext**
   - AuthContext wraps the entire app in App.jsx
   - It provides `signIn`, `signOut`, `session`, `user`, `loading`

4. **AuthContext calls Supabase**
   - Line 27 in AuthContext.jsx: `supabase.auth.signInWithPassword(...)`
   - Supabase validates credentials against its servers

5. **On success:**
   - Supabase returns a `session` object containing:
     - `access_token` - JWT for API requests
     - `refresh_token` - For auto-refreshing
     - `user` - User profile data
   - AuthContext stores this session
   - Login.jsx navigates to `/catalog`

6. **Protected Routes:**
   - If user tries to access `/catalog` without a session
   - ProtectedRoute component redirects to `/login`

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Creates Supabase client using env vars |
| `src/context/AuthContext.jsx` | Manages login/logout/session state |
| `src/hooks/useAuth.js` | Easy access to auth from any component |
| `src/pages/Login.jsx` | Login form UI |

### Code Examples

**Supabase Client (src/lib/supabase.js):**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**AuthContext (src/context/AuthContext.jsx):**
```javascript
import { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**useAuth Hook (src/hooks/useAuth.js):**
```javascript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Login Page (src/pages/Login.jsx):**
```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/catalog');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="logo">slice</div>
      <main>
        <form className="form-wrap" onSubmit={handleSubmit}>
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
          {error && <div className="error-message">{error}</div>}
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </main>
    </div>
  );
}
```

---

## Image Upload Module

### Current Status

The Upload page (`/upload`) currently **logs the file to console** but doesn't actually upload to the backend. This needs to be implemented.

### Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Upload.jsx  │────▶│  Backend     │────▶│   Poll for   │
│              │     │  /predict    │     │   Results    │
│  1. Select  │     │  -async      │     │              │
│     file     │     │              │     │  /task/:id   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Implementation (To Be Added)

In `src/pages/Upload.jsx`, the `handleFile` function needs to be updated:

```javascript
import { useAuth } from '../hooks/useAuth';

export default function Upload() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleFile = async (file) => {
    if (!session?.access_token) {
      console.error('Not authenticated');
      return;
    }

    // 1. Create FormData and append the file
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 2. Submit to backend
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/predict-async`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // 3. Get task_id from response
      const { task_id } = await response.json();

      // 4. Poll for results
      await pollTask(task_id);

    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const pollTask = async (taskId) => {
    let status = 'PENDING';

    while (status === 'PENDING' || status === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/task/${taskId}`
      );
      const result = await response.json();
      status = result.status;

      if (status === 'SUCCESS') {
        // Navigate to editor with project ID
        const projectId = result.result.projectId;
        navigate(`/editor/${projectId}`);
        return;
      }

      if (status === 'FAILURE') {
        console.error('Task failed:', result.error);
        return;
      }
    }
  };

  // ... rest of component
};
```

### File Input Methods Supported

1. **Click** - Click the dropzone to open file picker
2. **Drag & Drop** - Drag an image file onto the dropzone
3. **Paste** - Paste an image from clipboard (Ctrl+V)

---

## Routing

### Route Map

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/` | Landing.jsx | No | Marketing landing page |
| `/login` | Login.jsx | No | User login form |
| `/catalog` | Catalog.jsx | **Yes** | Project dashboard |
| `/upload` | Upload.jsx | **Yes** | Upload new image |
| `/*` | Redirect | - | Catch-all redirects to `/` |

### Protected Routes Implementation (src/App.jsx)

```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Catalog from './pages/Catalog';
import Upload from './pages/Upload';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ background: '#725656', height: '100vh' }}>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <Catalog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <Upload />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## Debugging Tips

### Common Issues

1. **"Cannot connect to server"**
   - Make sure you're running `npm run dev` in the `slice-frontend` directory
   - Check the terminal for the URL (usually `http://localhost:5173`)

2. **"useAuth must be used within AuthProvider"**
   - This means you're using the `useAuth()` hook outside of the `<AuthProvider>` wrapper
   - Check that your component is a child of `AuthProvider` in App.jsx

3. **"Invalid login credentials"**
   - Make sure the user exists in Supabase
   - Check Supabase dashboard to see registered users

### Viewing Console Logs

1. Open browser (Firefox/Chrome)
2. Press **F12** to open Developer Tools
3. Click the **Console** tab
4. Look for logged messages (Upload page logs file info here)

### Viewing Network Requests

1. Open Developer Tools (F12)
2. Click the **Network** tab
3. Perform actions (login, navigate)
4. See all HTTP requests and responses

---

## Quick Reference

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build |

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/pages/` | Page components (Landing, Login, Catalog, Upload) |
| `src/components/` | Reusable UI components (Sidebar, DeleteModal) |
| `src/context/` | React Context providers (AuthContext) |
| `src/hooks/` | Custom React hooks (useAuth) |
| `src/lib/` | External library configuration (supabase.js) |
| `src/styles/` | Global styles and design tokens |

---

## Next Steps

1. **Implement image upload** - Add the API call to upload images to the backend
2. **Implement editor page** - Connect the existing `SliceEditor.jsx` component
3. **Add API integration** - Fetch real project data instead of using mock data in Catalog

---

*Last Updated: 2026-05-16*