import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { setItem as sessionSet, getItem as sessionGet } from '../lib/sessionStore';
import './Upload.css';

const API_URL = import.meta.env.VITE_API_URL;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Upload() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  // Track latest uploads in a ref for save-on-unmount
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  // Save uploads to session store on unmount (captures the latest state)
  useEffect(() => {
    return () => {
      if (uploadsRef.current.length > 0) {
        sessionSet('__upload_state', uploadsRef.current);
      }
    };
  }, []);

  // Restore uploads from session store on mount
  useEffect(() => {
    (async () => {
      const restored = await sessionGet('__upload_state');
      if (restored && restored.length > 0) {
        setUploads(restored);
      }
    })();
  }, []);

  // Timer update - runs every second
  useEffect(() => {
    const interval = setInterval(() => {
      setUploads(prev =>
        prev.map(upload => {
          if (upload.status === 'processing' && upload.startTime) {
            const elapsed = Math.floor((Date.now() - upload.startTime) / 1000);
            return { ...upload, elapsedSeconds: elapsed };
          }
          return upload;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling effect - runs every 1.5s while processing uploads exist
  const intervalRef = useRef(null);
  const processingCount = uploads.filter(u => u.status === 'processing' && u.taskId).length;

  useEffect(() => {
    if (authLoading) return;

    if (processingCount === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      setUploads(currentUploads => {
        const token = session?.access_token;
        if (!token) return currentUploads;

        const currentProcessing = currentUploads.filter(
          u => u.status === 'processing' && u.taskId
        );

        if (currentProcessing.length === 0) return currentUploads;

        currentProcessing.forEach(async (upload) => {
          try {
            const response = await fetch(
              `${API_URL}/task/${upload.taskId}`,
              { headers: { Authorization: `Bearer ${token}` }}
            );

            if (!response.ok) return;

            const data = await response.json();

            if (data.status === 'SUCCESS' && data.result) {
              await sessionSet(upload.taskId, {
                taskId: upload.taskId,
                imageDataUrl: upload.imageDataUrl,
                filename: upload.file?.name || 'unknown.png',
                result: data.result,
                createdAt: new Date().toISOString()
              });
              setUploads(prev => prev.map(u =>
                u.id === upload.id ? { ...u, status: 'success', result: data.result } : u
              ));
            } else if (data.status === 'FAILURE') {
              setUploads(prev => prev.map(u =>
                u.id === upload.id ? { ...u, status: 'error', error: data.error || 'Failed' } : u
              ));
            }
          } catch (e) {
            console.error('[POLL] Fetch error:', e);
          }
        });

        return currentUploads;
      });
    }, 1500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [authLoading, processingCount]);

  // Paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target.result;
      const newUpload = {
        id: generateId(),
        file: { name: file.name, type: file.type }, // Store just file info, not the file object
        previewUrl: imageDataUrl, // Use data URL directly so it survives refresh
        imageDataUrl,
        status: 'pending',
        taskId: null,
        result: null,
        error: null,
        startTime: null,
        elapsedSeconds: 0
      };
      console.log('[UPLOAD] New file added:', file.name);
      setUploads(prev => [...prev, newUpload]);
    };
    reader.readAsDataURL(file);
  };

  const handleSliceClick = async (uploadId) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (!upload || !session?.access_token) {
      console.log('[SLICE] Cannot slice. Upload:', upload, 'Token:', session?.access_token ? 'present' : 'missing');
      return;
    }

    console.log('[SLICE] Starting slice for:', uploadId);

    setUploads(prev =>
      prev.map(u =>
        u.id === uploadId
          ? { ...u, status: 'processing', startTime: Date.now(), elapsedSeconds: 0 }
          : u
      )
    );

    // Convert data URL back to blob for upload
    const response = await fetch(upload.imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], upload.file.name, { type: upload.file.type });
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiResponse = await fetch(`${API_URL}/predict-async`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await apiResponse.json();
      console.log('[SLICE] Got task_id:', data.task_id);

      setUploads(prev =>
        prev.map(u =>
          u.id === uploadId
            ? { ...u, taskId: data.task_id }
            : u
        )
      );
    } catch (err) {
      console.error('[SLICE] Error:', err.message);
      setUploads(prev =>
        prev.map(u =>
          u.id === uploadId
            ? { ...u, status: 'error', error: err.message }
            : u
        )
      );
    }
  };

  const handleRemove = (uploadId) => {
    setUploads(prev => {
      const upload = prev.find(u => u.id === uploadId);
      // REMOVED - Using memory-only storage
      // if (upload?.taskId) {
      //   localStorage.removeItem(`slice_image_${upload.taskId}`);
      // }
      return prev.filter(u => u.id !== uploadId);
    });
  };

  if (authLoading) {
    return (
      <div className="upload-page">
        <Sidebar showBack={true} onBackClick={() => navigate('/catalog')} />
        <main className="upload-main">
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <Sidebar showBack={true} onBackClick={() => navigate('/catalog')} />

      <main className="upload-main">
        {uploads.length === 0 ? (
          <label
            className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-left">
              <div className="icon-image"></div>
              <span>Drag or paste image here</span>
            </div>
            <div className="drop-right">
              <div className="icon-upload"></div>
              <span>Upload</span>
            </div>
          </label>
        ) : (
          <div className="upload-grid">
            {uploads.map((upload, idx) => (
              <div
                key={upload.id}
                className={`upload-card ${upload.status}`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="upload-preview">
                  <img src={upload.previewUrl || upload.imageDataUrl} alt={upload.file?.name} />
                  <button
                    className="remove-btn"
                    onClick={() => handleRemove(upload.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="upload-info">
                  <div className="upload-filename" title={upload.file?.name}>
                    {upload.file?.name || 'Unknown'}
                  </div>
                  <div className="upload-status-row">
                    {upload.status === 'pending' && (
                      <button
                        className="slice-btn"
                        onClick={() => handleSliceClick(upload.id)}
                      >
                        SliceMe
                      </button>
                    )}
                    {upload.status === 'processing' && (
                      <div className="status processing">
                        <span className="spinner"></span>
                        <span className="timer">{formatTime(upload.elapsedSeconds)}</span>
                      </div>
                    )}
                    {upload.status === 'success' && (
                      <div className="success-actions">
                        <div className="status success">Done</div>
                        <button
                          className="view-editor-btn"
                          onClick={() => navigate(`/editor/${upload.taskId}`, {
                            state: {
                              imageDataUrl: upload.imageDataUrl,
                              filename: upload.file?.name || 'image.png',
                              result: upload.result
                            }
                          })}
                        >
                          View Editor
                        </button>
                      </div>
                    )}
                    {upload.status === 'error' && (
                      <div className="status error" title={upload.error}>
                        Failed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <label
              className={`upload-card add-more ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="add-more-content">
                <div className="icon-upload"></div>
                <span>Add more</span>
              </div>
            </label>
          </div>
        )}

        

        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </main>
    </div>
  );
}