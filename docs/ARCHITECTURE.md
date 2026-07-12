# SliceME Frontend Architecture

**Last Updated:** May 17, 2026

## 1. Overview

SliceME is a web application that transforms email designs into export-ready assets using YOLO-based object detection. Users upload email design images, the backend processes them to detect and segment UI components (buttons, images, text blocks, etc.), and the frontend allows users to review, adjust, and export the extracted assets as a ZIP file.

## 2. Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.x |
| Build Tool | Vite | 8.x |
| Routing | React Router DOM | 7.x |
| State Management | React Context + Hooks | - |
| Authentication | Supabase | 2.x |
| ZIP Generation | JSZip | 3.x |
| Styling | Custom CSS | - |

## 3. Project Structure

```
slice-frontend/
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md           # This file
│   └── ...
├── public/                       # Static assets
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── DeleteModal.jsx       # Confirmation dialog
│   │   └── Sidebar.jsx           # Navigation sidebar
│   ├── context/                  # React Context providers
│   │   └── AuthContext.jsx       # Authentication state
│   ├── hooks/                    # Custom React hooks
│   │   └── useAuth.js            # Auth context accessor
│   ├── lib/                      # External library configuration
│   │   ├── api.js                # Backend API client
│   │   └── supabase.js           # Supabase client init
│   ├── pages/                    # Page components
│   │   ├── Catalog.jsx           # Project dashboard
│   │   ├── Editor.jsx            # Bounding box editor + ZIP download
│   │   ├── Landing.jsx           # Marketing landing page
│   │   ├── Login.jsx             # User authentication
│   │   ├── Register.jsx          # User registration
│   │   └── Upload.jsx            # Image upload + processing
│   ├── App.jsx                   # Root component with routing
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Global styles
├── package.json
└── vite.config.js
```

## 4. Core Components

### 4.1 Pages

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| Landing | `/` | No | Marketing landing page |
| Login | `/login` | No | User authentication |
| Register | `/register` | No | User registration |
| Catalog | `/catalog` | Yes | Project dashboard (shows all uploaded images) |
| Upload | `/upload` | Yes | Image upload with drag/drop/paste + async processing |
| Editor | `/editor/:taskId` | Yes | Bounding box viewer/editor + ZIP download |

### 4.2 Authentication Flow

1. User registers/login via Supabase Auth
2. Supabase returns JWT session
3. `AuthContext` stores session in React state
4. Protected pages check session via `useAuth` hook
5. Token passed in `Authorization: Bearer {token}` header to backend

### 4.3 Image Processing Flow

```
User uploads image
       ↓
POST /api/v1/predict-async (returns task_id)
       ↓
Frontend polls GET /api/v1/task/{taskId} every 1.5s
       ↓
Status: pending → processing → SUCCESS/FAILURE
       ↓
On SUCCESS: Navigate to Editor with image data via React state
       ↓
User adjusts bounding boxes → PUT /predictions/{taskId}/detections
       ↓
User downloads ZIP → JSZip crops images and bundles
```

## 5. Architecture Patterns

### 5.1 Memory-Only Storage

**Decision:** All image data stored in React state, not persisted to localStorage or IndexedDB.

**Reason:** LocalStorage has a 5MB quota which is insufficient for base64-encoded images (often 2-4MB each). Attempting to store multiple images caused "quota exceeded" errors.

**Trade-off:** Data is lost on page refresh. Users must complete their workflow in a single session.

**Future Enhancement:** Could implement IndexedDB for larger persistent storage.

### 5.2 Direct Editor Navigation

**Decision:** After successful processing, navigate directly to Editor instead of Catalog.

**Reason:** With memory-only storage, Catalog would be empty on page refresh. Direct navigation provides immediate access to the processed image.

### 5.3 Polling-Based Async Processing

**Decision:** Frontend polls backend every 1.5 seconds for task status.

**Reason:** Backend uses Celery + Redis for async processing. Tasks are submitted and processed in the background.

**Alternative:** Could implement WebSockets for real-time updates in the future.

### 5.4 ZIP Download Implementation

**Decision:** Use JSZip to crop images client-side and bundle into a ZIP file.

**Key Implementation Detail:** Use `new Map()` instead of `new Set()` to track detected classes - this enabled the `.get()` method needed for class name lookup.

## 6. API Integration

### Backend Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/predict-async` | Submit image for async processing |
| GET | `/api/v1/task/{taskId}` | Poll task status |
| GET | `/api/v1/predictions` | List user's predictions |
| PUT | `/api/v1/predictions/{taskId}/detections` | Update bounding boxes |

### Environment Variables

```bash
VITE_API_URL          # Backend API base URL (e.g., http://localhost:8000/api/v1)
VITE_SUPABASE_URL     # Supabase project URL
VITE_SUPABASE_ANON_KEY # Supabase anon key
```

## 7. Deployment

### 7.1 Frontend (Netlify)

| Setting | Value |
|---------|-------|
| Host | Netlify |
| Build Command | `npm run build` |
| Publish Directory | `dist` |
| Auto-deploy | On git push to main branch |
| Environment Variables | Set in Netlify dashboard |

### 7.2 Backend (Render)

| Setting | Value |
|---------|-------|
| Host | Render |
| API URL | `https://sliceme-api.onrender.com` |
| Runtime | Python/FastAPI with Celery + Redis |

## 8. Major Design Decisions

### 8.1 Memory-Only Image Storage
- **What:** Images stored in React state only
- **Why:** LocalStorage 5MB quota exceeded with base64 images
- **Trade-off:** Data lost on page refresh

### 8.2 Direct Editor Navigation
- **What:** Navigate to Editor immediately after processing
- **Why:** Catalog has no persisted data in memory-only mode
- **Previous:** Originally showed "View in Catalog" button

### 8.3 Polling-Based Async Processing
- **What:** Client polls every 1.5s for task status
- **Why:** Backend uses Celery for async processing

### 8.4 python-jose for JWT Verification
- **What:** Backend uses python-jose instead of jwt package
- **Why:** PyJWKClient not available in jwt v1.4.0
- **Location:** `app/services/auth_service.py`

### 8.5 Set → Map Fix for ZIP Download
- **What:** Changed `new Set()` to `new Map()` in Editor.jsx
- **Why:** Needed `.get()` method for class name lookup
- **Error:** "TypeError: c.get is not a function"

## 9. Known Limitations

1. **Page Refresh Loses Data** - Images and processing state lost on refresh
2. **No Persistence** - No way to resume previous sessions
3. **Catalog Empty** - API-based catalog may be empty due to user_id filtering
4. **Memory Usage** - Large images may cause browser memory issues

## 10. Future Improvements

1. **IndexedDB Storage** - Implement for persistent image storage beyond 5MB
2. **Backend Auth Fix** - Fix user_id matching in /predictions endpoint
3. **Real-time Updates** - Replace polling with WebSockets
4. **Mobile Support** - Responsive design improvements for mobile devices

## 11. Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 12. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "quota exceeded" error | Use memory-only storage instead of localStorage |
| "TypeError: c.get is not a function" | Change `new Set()` to `new Map()` in Editor.jsx |
| CORS errors on /predictions | Check if backend crashed before CORS headers set |
| ImportError: PyJWKClient | Use python-jose instead of jwt package in auth_service.py |

## 13. Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.jsx` | Root component with routing and auth providers |
| `src/context/AuthContext.jsx` | Authentication state management |
| `src/lib/api.js` | Backend API client functions |
| `src/lib/supabase.js` | Supabase client initialization |
| `src/pages/Upload.jsx` | Image upload with async processing |
| `src/pages/Editor.jsx` | Bounding box editor with ZIP download |

---

*This document should be updated as the architecture evolves.*