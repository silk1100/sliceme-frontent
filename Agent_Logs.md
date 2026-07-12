# Agent Logs — Slice Frontend Editor Lag Fix

## Problem
Bounding box resize/drag is laggy. Suspected database calls on every mousemove, but root cause is actually `setDetections` + full canvas redraw on every mousemove event.

## Investigation
- `updateDetections` (database) only fires on **mouse up**, not during drag
- `setDetections(newDetections)` fires on **every** mousemove during drag
- `useEffect` watches `detections` and calls `drawCanvas()`
- `drawCanvas()` redraws the **entire image + all bounding boxes** from scratch
- The draw effect **created a new `Image()` object on every call**, even when the image was already loaded

## Root Cause (Mouse-up ghost drag)
The box kept moving for 1-2s after mouse-up because **`setDragState({ isDragging: false })` was called AFTER `await updateDetections(...)`** in the async `handleMouseUp`. During the network request, `handleMouseMove` still saw `isDragging: true` and continued processing drag events.

## Todo List
- [x] Investigate root cause of lag
- [x] Evaluate fix approaches (Plan A/B/C)
- [x] ~~Plan C (RAF throttling)~~ — Reverted (caused 1-2s visual lag)
- [x] Optimize canvas draw by not recreating `Image()` on every render
- [x] Moved draw effects after `drawCanvas` definition to fix hoisting lint errors
- [x] Removed unused `useAuth` import from `App.jsx` (auth disabled for testing)
- [x] **Fixed async ordering bug**: Moved `setDragState({ isDragging: false })` **before** the `await` in `handleMouseUp`

## Fix Summary
- `Editor.jsx`: `setDragState` now resets **before** the async database save (line 369-378), so `isDragging` is `false` immediately on mouse up. The backend save still happens asynchronously.
- `Editor.jsx`: Draw effect skips redundant `new Image()` when `imageRef.current` is already set (line 161).
- `App.jsx`: Auth bypassed for testing — `ProtectedRoute` renders children unconditionally.

## Revert to re-enable auth
Restore `ProtectedRoute` in `src/App.jsx`:
```jsx
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div ...>Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
```
And add back: `import { useAuth } from './hooks/useAuth';`

## Testing Guide
1. Navigate directly to `/upload`
2. Upload an image → click "SliceMe" → wait for "Done"
3. Click "View Editor"
4. **Drag/resize a box** — should follow cursor smoothly
5. **Release mouse** — box should STOP immediately, no ghost movement
6. **Check console** — `"Saved detections to backend"` should appear after release
