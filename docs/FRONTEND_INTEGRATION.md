# Frontend Integration Guide

This document provides all the information needed to integrate a Next.js frontend with the SliceMe backend API.

---

## 1. Configuration

### Supabase Configuration

```
SUPABASE_URL: https://uarjoanuweuhgaxgcaxl.supabase.co
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcmpvYW51d2V1aGdheGdjYXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDcyNzksImV4cCI6MjA4NjcyMzI3OX0.fV_e7RNm9QHsSUeK0pltH0oQlthI8tKV1ono8LsU3kk
```

### API Base URLs

- **Local Development**: `http://localhost:8000/api/v1`
- **Production (Render)**: `https://your-render-app.onrender.com/api/v1`

### Frontend Environment Variables

Create a `.env.local` file in your Next.js project:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://uarjoanuweuhgaxgcaxl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcmpvYW51d2V1aGdheGdjYXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDcyNzksImV4cCI6MjA4NjcyMzI3OX0.fV_e7RNm9QHsSUeK0pltH0oQlthI8tKV1ono8LsU3kk
```

---

## 2. Authentication Flow

The authentication uses Supabase for user management and JWT token handling.

### Step 1: User Registers or Logs In (Supabase Client)

Use Supabase's client library to handle authentication. The frontend communicates directly with Supabase for auth.

### Step 2: Get JWT Token

After successful login/register, Supabase returns an access_token:

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { ... }
}
```

### Step 3: Send Token to Backend

Include the JWT token in the `Authorization` header for all authenticated API requests:

```
Authorization: Bearer <access_token>
```

**Important**: The backend expects the token in the header `Authorization: Bearer <token>` to:
- Verify the user's identity
- Automatically create or update the user in the database
- Link predictions to the authenticated user

---

## 3. Supabase Auth API Endpoints

Use these endpoints directly with Supabase (via their client library or REST API).

### Register New User

```
POST https://uarjoanuweuhgaxgcaxl.supabase.co/auth/v1/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200):
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "email_confirmed_at": null,
  "app_metadata": { "provider": "email" },
  "user_metadata": {},
  "aud": "authenticated",
  "confirmation_sent_at": "2024-01-15T10:30:00Z"
}
```

### Login (Get Token)

```
POST https://uarjoanuweuhgaxgcaxl.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

### Logout

```
POST https://uarjoanuweuhgaxgcaxl.supabase.co/auth/v1/logout
Authorization: Bearer <access_token>
```

---

## 4. Backend API Endpoints

All backend endpoints are prefixed with `/api/v1`.

### Base URL: `{API_URL}/api/v1`

---

### GET /health

Health check endpoint to verify the API is running.

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/health
```

**Response** (200):
```json
{
  "status": "healthy",
  "model_loaded": true,
  "timestamp": "2024-01-15T10:30:45.123456",
  "inference_method": "local"
}
```

---

### POST /predict-async (Recommended)

Submit an image for asynchronous processing. Returns immediately with a task_id. Poll `/task/{task_id}` for results.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/predict-async \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@image.png"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| confidence_threshold | float | 0.25 | Minimum confidence (0.0-1.0) |
| iou_threshold | float | 0.45 | IoU threshold for NMS (0.0-1.0) |

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | No | JWT token: `Bearer <access_token>` |
| Content-Type | Yes | `multipart/form-data` |

**Response** (200):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "PENDING",
  "message": "Task submitted successfully. Use the task_id to check status."
}
```

**Error Response** (400):
```json
{
  "detail": "Invalid file type. Allowed: image/png, image/jpeg, image/jpg"
}
```

---

### GET /task/{task_id}

Poll this endpoint to check task status and retrieve results.

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/task/abc123-def456-ghi789
```

**Response** (200):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "SUCCESS",
  "progress": 100,
  "result": {
    "success": true,
    "message": "Inference completed successfully. Found 2 objects.",
    "image_shape": {
      "width": 1920,
      "height": 1080
    },
    "detections": [
      {
        "class_id": 0,
        "class_name": "person",
        "confidence": 0.89,
        "bounding_box": {
          "x1": 100.5,
          "y1": 200.3,
          "x2": 350.7,
          "y2": 600.8
        },
        "segmentation": [
          {"x": 120.5, "y": 220.3},
          {"x": 125.2, "y": 218.9}
        ]
      }
    ],
    "detection_count": 2,
    "processing_time_ms": 145.3
  },
  "error": null
}
```

**Task Status Values:**
| Status | Description |
|--------|-------------|
| PENDING | Task is queued, waiting for worker |
| PROCESSING | Task is being processed |
| SUCCESS | Task completed (result available) |
| FAILURE | Task failed (error message available) |
| RETRY | Task failed and is being retried |

---

### POST /predict_slices

Synchronous inference - waits for result before returning. Use for small images only.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/predict_slices \
  -F "file=@image.png"
```

**Response** (200):
```json
{
  "success": true,
  "message": "Inference completed successfully. Found 2 objects.",
  "image_shape": {
    "width": 1920,
    "height": 1080
  },
  "detections": [...],
  "detection_count": 2,
  "processing_time_ms": 145.3
}
```

---

### POST /predict-batch-async

Submit multiple images for batch asynchronous processing.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/predict-batch-async \
  -H "Authorization: Bearer <access_token>" \
  -F "files=@image1.png" \
  -F "files=@image2.png"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| confidence_threshold | float | 0.25 | Minimum confidence (0.0-1.0) |
| iou_threshold | float | 0.45 | IoU threshold for NMS (0.0-1.0) |

**Note**: Maximum 10 images per batch.

**Response** (200):
```json
{
  "task_id": "batch-abc123",
  "status": "PENDING",
  "message": "Batch task submitted with 2 images."
}
```

---

## 5. Data Models

### Detection

```typescript
interface Detection {
  class_id: number;           // Class ID (e.g., 0 for person)
  class_name: string;          // Class name (e.g., "person")
  confidence: number;          // Confidence score 0.0-1.0
  bounding_box: BoundingBox;   // Bounding box coordinates
  segmentation: SegmentPoint[] | null; // Segmentation polygon
}
```

### BoundingBox

```typescript
interface BoundingBox {
  x1: number; // Top-left x coordinate
  y1: number; // Top-left y coordinate
  x2: number; // Bottom-right x coordinate
  y2: number; // Bottom-right y coordinate
}
```

### SegmentPoint

```typescript
interface SegmentPoint {
  x: number; // X coordinate
  y: number; // Y coordinate
}
```

### ImageShape

```typescript
interface ImageShape {
  width: number;  // Image width in pixels
  height: number; // Image height in pixels
}
```

### TaskSubmitResponse

```typescript
interface TaskSubmitResponse {
  task_id: string;   // Unique task identifier
  status: string;    // "PENDING"
  message: string;   // Human-readable message
}
```

### TaskStatusResponse

```typescript
interface TaskStatusResponse {
  task_id: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE" | "RETRY";
  progress: number | null;  // 0-100 (null when not processing)
  result: InferenceResponse | null;  // Available when status=SUCCESS
  error: string | null;      // Available when status=FAILURE
}
```

---

## 6. Async Polling Pattern

For `/predict-async`, use this polling pattern:

```typescript
async function submitAndPoll(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append('file', file);

  // Step 1: Submit image
  const submitResponse = await fetch(`${API_URL}/predict-async`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  const { task_id } = await submitResponse.json();

  // Step 2: Poll for results
  let status = 'PENDING';
  while (status === 'PENDING' || status === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

    const statusResponse = await fetch(`${API_URL}/task/${task_id}`);
    const result = await statusResponse.json();
    status = result.status;

    if (status === 'SUCCESS') {
      return result.result; // Full inference results
    }
    if (status === 'FAILURE') {
      throw new Error(result.error);
    }
  }
}
```

---

## 7. Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid file, missing parameters) |
| 401 | Unauthorized (invalid/missing token) |
| 413 | File too large |
| 500 | Internal Server Error |
| 503 | Service Unavailable (model not loaded) |

### Example Error Responses

**400 Bad Request:**
```json
{
  "detail": "Invalid file type. Allowed: image/png, image/jpeg, image/jpg"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Invalid or expired token. Please log in again."
}
```

**500 Internal Error:**
```json
{
  "detail": "Failed to submit task: Error message here"
}
```

---

## 8. Testing Checklist

Use this checklist to verify the integration works correctly:

### Anonymous Requests
- [ ] `/health` returns healthy status
- [ ] `/predict-async` accepts file without Authorization header
- [ ] Task completes successfully
- [ ] Poll `/task/{task_id}` returns results

### Authenticated Requests
- [ ] Register new user via Supabase
- [ ] Login and receive access_token
- [ ] Send request with `Authorization: Bearer <token>`
- [ ] Backend creates/fetches user in database
- [ ] Prediction is linked to the correct user
- [ ] Subsequent requests update last_login timestamp

### Error Handling
- [ ] Invalid file type returns 400
- [ ] Invalid token returns 401
- [ ] Large file returns 413

---

## 9. Complete Request Example

### Submit Image (Authenticated)

```javascript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('http://localhost:8000/api/v1/predict-async', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGc...'
  },
  body: formData
});

const data = await response.json();
// { task_id: "abc123...", status: "PENDING", message: "..." }
```

### Poll for Results

```javascript
const statusResponse = await fetch('http://localhost:8000/api/v1/task/abc123...');
const result = await statusResponse.json();
// {
//   "task_id": "abc123...",
//   "status": "SUCCESS",
//   "result": { "success": true, "detections": [...], ... }
// }
```

---

## 10. Notes

- The `/predict-async` endpoint is recommended for production use as it handles larger images and provides better error handling
- The backend automatically handles user creation on first authenticated request - no manual user provisioning needed
- Supabase JWT tokens expire after 1 hour (3600 seconds). The frontend should handle token refresh using the refresh_token
- For production, replace `localhost:8000` with your Render deployment URL

---

## 11. File Upload Notes

- Allowed image types: `image/png`, `image/jpeg`, `image/jpg`
- Maximum file size: Configured in backend (default ~16MB)
- Use `multipart/form-data` content type for file uploads

---

*Last Updated: 2025-01*
*For questions or issues, check the backend logs and database state*