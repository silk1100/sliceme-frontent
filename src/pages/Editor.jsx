import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import JSZip from 'jszip';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { updateDetections } from '../lib/api';
import './Editor.css';

const HANDLE_THRESHOLD = 10;
const MIN_BOX_SIZE = 10;

export default function Editor() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const { session } = useAuth();

  const [imageData, setImageData] = useState(null);
  const [detections, setDetections] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [visibleBoxes, setVisibleBoxes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    isResizing: false,
    activeBoxIndex: null,
    handle: null,
    startX: 0,
    startY: 0,
    startBox: null
  });

  // Hover state for resize handles
  const [hoverState, setHoverState] = useState({
    isHovering: false,
    handle: null,
    boxIndex: null
  });

  // Load data - now uses navigation state or shows error for memory-only storage
  const location = useLocation();
  const passedData = location.state;

  useEffect(() => {
    // First try to get data from navigation state (passed from Upload page)
    if (passedData && passedData.imageDataUrl) {
      setImageData(passedData);
      setDetections(passedData.result?.detections || []);

      const visibility = {};
      (passedData.result?.detections || []).forEach((_, idx) => {
        visibility[idx] = true;
      });
      setVisibleBoxes(visibility);
      setLoading(false);
      return;
    }

    // Fall back to localStorage (for backward compatibility)
    const stored = localStorage.getItem(`slice_image_${taskId}`);
    if (!stored) {
      setError('Image not found. Using memory-only storage - please use Editor in the same session after uploading.');
      setLoading(false);
      return;
    }

    try {
      const data = JSON.parse(stored);
      setImageData(data);
      setDetections(data.result?.detections || []);

      const visibility = {};
      (data.result?.detections || []).forEach((_, idx) => {
        visibility[idx] = true;
      });
      setVisibleBoxes(visibility);
    } catch (e) {
      setError('Failed to load image data.');
    }

    setLoading(false);
  }, [taskId, passedData]);

  // Draw canvas when data changes
  useEffect(() => {
    if (!imageData || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageData.imageDataUrl;
  }, [imageData, detections, visibleBoxes, selectedIndex, hoverState]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    detections.forEach((detection, idx) => {
      if (!visibleBoxes[idx]) return;

      const box = detection.bounding_box;
      const isSelected = selectedIndex === idx;
      const isHovered = hoverState.boxIndex === idx;
      const isActive = dragState.activeBoxIndex === idx;

      // Box appearance based on state
      let opacity = 0.3; // default: low opacity
      if (isSelected || isActive) {
        opacity = 1.0; // selected/active: full opacity
      } else if (isHovered) {
        opacity = 0.6; // hovered: medium opacity
      }

      const color = isSelected ? '#00A6F4' : '#00C48C';
      const lineWidth = isSelected ? 3 : 2;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);

      // Draw resize handles only for selected box (and show on hover)
      if (isSelected && (isHovered || isActive)) {
        const handleSize = 8;
        ctx.fillStyle = color;

        // Corners
        ctx.fillRect(box.x1 - handleSize/2, box.y1 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x2 - handleSize/2, box.y1 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x1 - handleSize/2, box.y2 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x2 - handleSize/2, box.y2 - handleSize/2, handleSize, handleSize);

        // Edge midpoints
        const midX = (box.x1 + box.x2) / 2;
        const midY = (box.y1 + box.y2) / 2;
        ctx.fillRect(midX - handleSize/2, box.y1 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(midX - handleSize/2, box.y2 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x1 - handleSize/2, midY - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x2 - handleSize/2, midY - handleSize/2, handleSize, handleSize);
      }

      ctx.restore();

      // Draw label
      ctx.fillStyle = color;
      ctx.font = '14px ABCOracle, Georgia, serif';
      ctx.fillText(detection.class_name, box.x1, box.y1 - 5);
    });
  }, [detections, visibleBoxes, selectedIndex, hoverState, dragState]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = img.width / rect.width;
    const scaleY = img.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Detect which handle is being hovered
  const detectHandle = (x, y, box) => {
    const nearLeft = Math.abs(x - box.x1) < HANDLE_THRESHOLD;
    const nearRight = Math.abs(x - box.x2) < HANDLE_THRESHOLD;
    const nearTop = Math.abs(y - box.y1) < HANDLE_THRESHOLD;
    const nearBottom = Math.abs(y - box.y2) < HANDLE_THRESHOLD;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    return null;
  };

  // Check if point is inside a box
  const isPointInBox = (x, y, box) => {
    return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
  };

  // Handle mouse move on canvas
  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { x, y } = coords;
    const img = imageRef.current;

    // Handle dragging/resizing
    if (dragState.isDragging || dragState.isResizing) {
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      const startBox = dragState.startBox;

      let newBox = { ...startBox };

      if (dragState.isResizing) {
        // Resize based on handle
        switch (dragState.handle) {
          case 'nw':
            newBox.x1 = Math.max(0, Math.min(startBox.x1 + dx, startBox.x2 - MIN_BOX_SIZE));
            newBox.y1 = Math.max(0, Math.min(startBox.y1 + dy, startBox.y2 - MIN_BOX_SIZE));
            break;
          case 'ne':
            newBox.x2 = Math.min(img.width, Math.max(startBox.x2 + dx, startBox.x1 + MIN_BOX_SIZE));
            newBox.y1 = Math.max(0, Math.min(startBox.y1 + dy, startBox.y2 - MIN_BOX_SIZE));
            break;
          case 'sw':
            newBox.x1 = Math.max(0, Math.min(startBox.x1 + dx, startBox.x2 - MIN_BOX_SIZE));
            newBox.y2 = Math.min(img.height, Math.max(startBox.y2 + dy, startBox.y1 + MIN_BOX_SIZE));
            break;
          case 'se':
            newBox.x2 = Math.min(img.width, Math.max(startBox.x2 + dx, startBox.x1 + MIN_BOX_SIZE));
            newBox.y2 = Math.min(img.height, Math.max(startBox.y2 + dy, startBox.y1 + MIN_BOX_SIZE));
            break;
          case 'n':
            newBox.y1 = Math.max(0, Math.min(startBox.y1 + dy, startBox.y2 - MIN_BOX_SIZE));
            break;
          case 's':
            newBox.y2 = Math.min(img.height, Math.max(startBox.y2 + dy, startBox.y1 + MIN_BOX_SIZE));
            break;
          case 'w':
            newBox.x1 = Math.max(0, Math.min(startBox.x1 + dx, startBox.x2 - MIN_BOX_SIZE));
            break;
          case 'e':
            newBox.x2 = Math.min(img.width, Math.max(startBox.x2 + dx, startBox.x1 + MIN_BOX_SIZE));
            break;
        }
      } else {
        // Move
        const width = startBox.x2 - startBox.x1;
        const height = startBox.y2 - startBox.y1;

        newBox.x1 = Math.max(0, Math.min(startBox.x1 + dx, img.width - width));
        newBox.y1 = Math.max(0, Math.min(startBox.y1 + dy, img.height - height));
        newBox.x2 = newBox.x1 + width;
        newBox.y2 = newBox.y1 + height;
      }

      // Update detections state
      const newDetections = [...detections];
      newDetections[dragState.activeBoxIndex] = {
        ...newDetections[dragState.activeBoxIndex],
        bounding_box: newBox
      };
      setDetections(newDetections);

      return;
    }

    // Handle hover detection (only for selected box)
    if (selectedIndex !== null) {
      const selectedBox = detections[selectedIndex].bounding_box;
      const handle = detectHandle(x, y, selectedBox);

      if (handle) {
        setHoverState({ isHovering: true, handle, boxIndex: selectedIndex });
        // Set cursor based on handle
        const cursorMap = {
          'nw': 'nwse-resize', 'se': 'nwse-resize',
          'ne': 'nesw-resize', 'sw': 'nesw-resize',
          'n': 'ns-resize', 's': 'ns-resize',
          'w': 'ew-resize', 'e': 'ew-resize'
        };
        canvasRef.current.style.cursor = cursorMap[handle];
      } else if (isPointInBox(x, y, selectedBox)) {
        setHoverState({ isHovering: true, handle: null, boxIndex: selectedIndex });
        canvasRef.current.style.cursor = 'move';
      } else {
        setHoverState({ isHovering: false, handle: null, boxIndex: null });
        canvasRef.current.style.cursor = 'default';
      }
    }
  };

  // Handle mouse down
  const handleMouseDown = (e) => {
    const coords = getCanvasCoords(e);
    if (!coords || selectedIndex === null) return;

    const { x, y } = coords;
    const selectedBox = detections[selectedIndex].bounding_box;

    // Check for resize handle first
    const handle = detectHandle(x, y, selectedBox);

    if (handle) {
      setDragState({
        isDragging: false,
        isResizing: true,
        activeBoxIndex: selectedIndex,
        handle,
        startX: x,
        startY: y,
        startBox: { ...selectedBox }
      });
    } else if (isPointInBox(x, y, selectedBox)) {
      // Start moving
      setDragState({
        isDragging: true,
        isResizing: false,
        activeBoxIndex: selectedIndex,
        handle: null,
        startX: x,
        startY: y,
        startBox: { ...selectedBox }
      });
    }
  };

  // Handle mouse up - save detections to backend
  const handleMouseUp = async () => {
    if (!dragState.isDragging && !dragState.isResizing) return;

    // REMOVED - Using memory-only storage
    // Save to localStorage
    // try {
    //   const key = `slice_image_${taskId}`;
    //   const data = JSON.parse(localStorage.getItem(key));
    //   data.result.detections = detections;
    //   localStorage.setItem(key, JSON.stringify(data));
    // } catch (e) {
    //   console.error('Failed to save to localStorage:', e);
    // }

    // Send to backend
    if (session?.access_token) {
      setSaving(true);
      try {
        await updateDetections(session.access_token, taskId, detections);
        console.log('Saved detections to backend');
      } catch (e) {
        console.error('Failed to save to backend:', e);
      } finally {
        setSaving(false);
      }
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      isResizing: false,
      activeBoxIndex: null,
      handle: null,
      startX: 0,
      startY: 0,
      startBox: null
    });
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoverState({ isHovering: false, handle: null, boxIndex: null });
    if (dragState.isDragging || dragState.isResizing) {
      handleMouseUp();
    }
  };

  // Handle canvas click (for selection)
  const handleCanvasClick = (e) => {
    // If dragging, don't change selection
    if (dragState.isDragging || dragState.isResizing) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { x, y } = coords;

    let found = null;
    detections.forEach((detection, idx) => {
      if (!visibleBoxes[idx]) return;
      const box = detection.bounding_box;
      if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
        found = idx;
      }
    });

    setSelectedIndex(found);
  };

  const toggleVisibility = (idx) => {
    setVisibleBoxes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDownloadZip = async () => {
    if (!imageData || !imageRef.current) return;

    setDownloading(true);

    try {
      const zip = new JSZip();
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const originalFilename = imageData.filename.replace(/\.[^/.]+$/, '');
      const detectedClasses = new Set();

      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i];
        if (!visibleBoxes[i]) continue;

        const box = detection.bounding_box;
        const className = detection.class_name;
        const count = detectedClasses.get(className) || 0;
        detectedClasses.set(className, count + 1);

        const cropFilename = `${originalFilename}_${className}_${count}.png`;

        canvas.width = box.x2 - box.x1;
        canvas.height = box.y2 - box.y1;
        ctx.drawImage(img, box.x1, box.y1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        zip.file(cropFilename, blob);
      }

      const manifest = {
        filename: imageData.filename,
        width: img.width,
        height: img.height,
        detections: detections.map((d, idx) => ({
          class_name: d.class_name,
          confidence: d.confidence,
          bbox: [d.bounding_box.x1, d.bounding_box.y1, d.bounding_box.x2, d.bounding_box.y2],
          crop_index: idx,
          visible: visibleBoxes[idx] || false
        }))
      };

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${originalFilename}_sliced.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to create ZIP file');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="editor-page">
        <Sidebar showBack={true} onBackClick={() => navigate('/catalog')} />
        <main className="editor-main">
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-page">
        <Sidebar showBack={true} onBackClick={() => navigate('/catalog')} />
        <main className="editor-main">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/upload')}>Upload new image</button>
        </main>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <Sidebar showBack={true} onBackClick={() => navigate('/catalog')} />

      <main className="editor-main">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ maxWidth: '100%', height: 'auto', cursor: 'default' }}
          />
        </div>

        <aside className="editor-sidebar">
          <div className="sidebar-header">
            <h3>Detections</h3>
            <span className="detection-count">{detections.length} items</span>
          </div>

          <div className="detection-list">
            {detections.map((detection, idx) => (
              <div
                key={idx}
                className={`detection-item ${selectedIndex === idx ? 'selected' : ''} ${!visibleBoxes[idx] ? 'hidden' : ''}`}
                onClick={() => setSelectedIndex(idx)}
              >
                <button
                  className={`visibility-btn ${visibleBoxes[idx] ? 'visible' : 'hidden'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(idx);
                  }}
                >
                  {visibleBoxes[idx] ? '👁' : '👁‍🗨'}
                </button>
                <div className="detection-info">
                  <div className="detection-name">{detection.class_name}</div>
                  <div className="detection-confidence">
                    {(detection.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="sidebar-actions">
            {saving && <div className="saving-indicator">Saving...</div>}
            <button
              className="download-btn"
              onClick={handleDownloadZip}
              disabled={downloading || saving || detections.length === 0}
            >
              {downloading ? 'Creating ZIP...' : 'Download ZIP'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}