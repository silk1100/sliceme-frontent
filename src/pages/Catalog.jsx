import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DeleteModal from '../components/DeleteModal';
import { useAuth } from '../hooks/useAuth';
import { fetchPredictions } from '../lib/api';
import './Catalog.css';

export default function Catalog() {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    async function loadPredictions() {
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      // Try to fetch from API
      try {
        const data = await fetchPredictions(session.access_token);
        if (data.predictions && data.predictions.length > 0) {
          setPredictions(data.predictions);
        } else {
          // No predictions from API - show empty state
          setPredictions([]);
        }
      } catch (err) {
        console.warn('API fetch failed:', err.message);
        // Show error but don't show fallback since we're using memory-only storage
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPredictions();
  }, [session]);

  const handleCardClick = (taskId) => {
    setSelectedTaskId(selectedTaskId === taskId ? null : taskId);
  };

  const handleCardDoubleClick = (taskId) => {
    // Check if the prediction has results - if so, navigate to editor
    const prediction = predictions.find(p => p.task_id === taskId);
    if (prediction && prediction.status === 'completed') {
      // For now, show message since we're using memory-only storage
      alert('Image is in memory. Navigate to editor to view.');
      // TODO: Implement passing image data via state/navigation if needed
    } else {
      alert('Image not found. Please re-upload the image.');
    }
  };

  const handleTrashClick = () => {
    if (selectedTaskId) {
      setShowDeleteModal(true);
    }
  };

  const handleDeleteConfirm = () => {
    console.log('Delete task:', selectedTaskId);
    setPredictions(predictions.filter(p => p.task_id !== selectedTaskId));
    setSelectedTaskId(null);
    setShowDeleteModal(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const selectedPrediction = predictions.find(p => p.task_id === selectedTaskId);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Done',
      failed: 'Failed'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="catalog-page">
        <Sidebar showTrash={false} />
        <main>
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-page">
        <Sidebar showTrash={false} />
        <main>
          <div className="error-message">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <Sidebar
        showTrash={true}
        trashEnabled={selectedTaskId !== null}
        onTrashClick={handleTrashClick}
      />

      <main>
        {predictions.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet.</p>
            <button onClick={() => navigate('/upload')}>Upload an image</button>
          </div>
        ) : (
          <div className="card-grid">
            {predictions.map((prediction, idx) => (
              <div
                key={prediction.task_id}
                className={`card ${selectedTaskId === prediction.task_id ? 'selected' : ''} ${prediction.status}`}
                style={{ animationDelay: `${0.05 + idx * 0.05}s` }}
                onClick={() => handleCardClick(prediction.task_id)}
                onDoubleClick={() => handleCardDoubleClick(prediction.task_id)}
              >
                <div className="card-title">{prediction.original_filename}</div>
                <div className="card-date">{formatDate(prediction.created_at)}</div>
                <div className={`card-status ${prediction.status}`}>
                  {getStatusLabel(prediction.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <DeleteModal
        visible={showDeleteModal}
        projectName={selectedPrediction?.original_filename || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}