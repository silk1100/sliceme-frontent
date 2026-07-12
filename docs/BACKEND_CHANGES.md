# Backend Changes Documentation

**Last Updated:** May 17, 2026

## Overview

This document describes the backend changes made during frontend integration for SliceME. These changes enabled JWT authentication, database persistence, and async task processing.

---

## 1. auth_service.py - JWT Authentication Fix

**Problem:** `ImportError: cannot import name 'PyJWKClient' from 'jwt'` on Render deployment

**Root Cause:** The `jwt` package v1.4.0 does not export `PyJWKClient`. The old code used `jwt.PyJWKClient` which doesn't exist.

**Solution:** Rewrote the entire auth service to use `python-jose` library instead of the broken `jwt` package.

**File Location:** `app/services/auth_service.py`

### Key Changes

1. **Replaced JWT library:**
   - Old: `import jwt` with `jwt.PyJWKClient`
   - New: `from jose import jwk, jwt`

2. **Added synchronous JWKS fetching:**
   ```python
   def _get_jwks_sync(self) -> Optional[Dict[str, Any]]:
       """Fetch and cache JWKS from Supabase (synchronous)"""
   ```

3. **Implemented proper key extraction:**
   ```python
   from jose import jwk
   signing_key = jwk(key)  # Convert JWK to actual key
   ```

4. **Added fallback for development:**
   - Mock tokens (tokens starting with "eyJ" but < 50 chars) bypass verification
   - When JWKS unavailable, allows bypass with warning

5. **Token verification with RS256:**
   ```python
   payload = jwt.decode(
       token,
       signing_key,
       algorithms=["RS256"],
       audience=["authenticated"],
       issuer=f"{self.supabase_url}/auth/v1",
   )
   ```

### Required Package

```bash
pip install python-jose[cryptography]
```

---

## 2. predictions.py - Predictions List Endpoint

**Added:** `GET /api/v1/predictions` endpoint

**File Location:** `app/api/endpoints/predictions.py`

### Features

- **Pagination:** `limit` (default 50) and `offset` parameters
- **Status filter:** Optional `?status=completed` query parameter
- **Optional auth:** Returns empty list if not authenticated
- **User linking:** Uses `UserService` to map auth user_id to database user

### Response Schema

```python
class PredictionResponse(BaseModel):
    id: int
    task_id: str
    original_filename: str
    status: str
    results: Optional[dict] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    created_at: str
    completed_at: Optional[str] = None
    processing_time_seconds: Optional[float] = None

class PredictionsListResponse(BaseModel):
    predictions: List[PredictionResponse]
    total: int
```

### Also Added: Update Detections

**Endpoint:** `PUT /api/v1/predictions/{task_id}/detections`

Allows updating bounding boxes after user edits in the Editor.

```python
class DetectionUpdate(BaseModel):
    class_name: str
    confidence: float
    bounding_box: dict
```

---

## 3. predict_async.py - Async Processing with DB Integration

**Enhanced:** Added database integration for user and prediction tracking

**File Location:** `app/api/endpoints/predict_async.py`

### New Features

1. **User creation on first login:**
   ```python
   db_user = await user_service.get_or_create_user(
       db=db,
       auth_id=current_user.user_id,
       email=current_user.email,
   )
   db_user = await user_service.sync_user_login(db, db_user)
   ```

2. **Prediction record creation:**
   - Creates `Prediction` record for each upload
   - Links to authenticated user via `user_id`
   - Tracks status through task lifecycle

3. **Supports both authenticated and anonymous uploads:**
   - Authenticated: Creates User record + Prediction with user_id
   - Anonymous: Prediction with `user_id=None`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/predict-async` | Submit single image for async processing |
| POST | `/api/v1/predict-batch-async` | Submit multiple images for batch processing |
| GET | `/api/v1/task/{task_id}` | Poll task status |

---

## 4. dependencies.py - Auth Dependencies

**Added:** Authentication dependency injection

**File Location:** `app/dependencies.py`

### New Components

1. **CurrentUser class:**
   ```python
   class CurrentUser:
       def __init__(self, user_id: str, email: str, token: str):
           self.user_id = user_id
           self.email = email
           self.token = token
   ```

2. **Optional auth dependency:**
   ```python
   async def get_current_user(
       authorization: Optional[str] = Header(None, alias="Authorization"),
   ) -> Optional[CurrentUser]:
   ```
   - Returns `None` if no token provided
   - Used for endpoints that work with or without auth

3. **Required auth dependency:**
   ```python
   async def get_required_user(...) -> CurrentUser:
   ```
   - Raises `401 Unauthorized` if no token
   - Used for protected endpoints

### Usage in Endpoints

```python
@router.get("/predictions")
async def list_predictions(
    current_user: Optional[CurrentUser] = Depends(get_current_user),
):
    if not current_user:
        return {"predictions": [], "total": 0}
    # ... process authenticated request
```

---

## 5. user_service.py - User Management

**File Location:** `app/services/user_service.py`

### Functions Added

1. **`get_or_create_user()`:** Creates new user or retrieves existing by auth_id
2. **`sync_user_login()`:** Updates last_login timestamp on each request
3. **`get_user_by_auth_id()`:** Look up user by Supabase auth ID

---

## 6. Database Model - Prediction

**File Location:** `app/db/models.py`

### Schema

```python
class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    original_filename = Column(String)
    file_size_bytes = Column(Integer)
    status = Column(String, default="pending")
    confidence_threshold = Column(Float)
    iou_threshold = Column(Float)
    results = Column(JSON, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
```

---

## 7. Celery Task Integration

**File Location:** `app/workers/tasks.py`

### Enhanced to support:

- **User tracking:** Passes `db_user_id` to task for prediction linking
- **File metadata:** Passes filename and file_size for record creation
- **Result storage:** Results stored in Prediction.results JSON field

---

## Testing the Backend

### 1. Local Development

```bash
cd design_segmentation
uvicorn app.main:app --reload --port 8000
```

### 2. Test Auth Service

```bash
# Test with valid token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/v1/predictions

# Test without token (should return empty)
curl http://localhost:8000/api/v1/predictions
```

### 3. Test Async Prediction

```bash
# Submit image
curl -X POST http://localhost:8000/api/v1/predict-async \
  -F "file=@design.png"

# Poll status
curl http://localhost:8000/api/v1/task/{task_id}
```

---

## Required Environment Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# RunPod (optional)
RUNPOD_API_KEY=your-runpod-key
USE_RUNPODS=false
```

---

## Deployment Notes

### Render Backend

- Uses `run.py` for production server startup
- Requires `python-jose[cryptography]` in requirements.txt
- CORS configured for frontend URL
- Auto-deploys on git push

### Key Fixes Applied

1. **JWT ImportError:** Fixed by using python-jose instead of jwt package
2. **CORS on /predictions:** Backend was crashing before CORS headers set - fixed by correcting auth_service imports
3. **User ID mismatch:** Now properly maps auth user_id → database user_id via UserService

---

## Files Modified Summary

| File | Change Type | Purpose |
|------|-------------|---------|
| `app/services/auth_service.py` | Rewrite | Fix JWT verification using python-jose |
| `app/api/endpoints/predictions.py` | New | List predictions + update detections |
| `app/api/endpoints/predict_async.py` | Enhanced | DB integration for users/predictions |
| `app/dependencies.py` | Added | Auth dependency injection |
| `app/services/user_service.py` | Added | User management functions |
| `app/db/models.py` | Added | Prediction model |

---

*This document should be updated as the backend evolves.*