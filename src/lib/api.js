const API_URL = import.meta.env.VITE_API_URL;

export async function fetchPredictions(token, limit = 50, offset = 0, status = null) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  });
  if (status) {
    params.append('status', status);
  }

  const response = await fetch(`${API_URL}/predictions?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch predictions');
  }

  return response.json();
}

export async function getPredictionByTaskId(token, taskId) {
  const response = await fetch(`${API_URL}/predictions`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch predictions');
  }

  const data = await response.json();
  return data.predictions.find(p => p.task_id === taskId);
}

export async function updateDetections(token, taskId, detections) {
  const response = await fetch(`${API_URL}/predictions/${taskId}/detections`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ detections })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update detections');
  }

  return response.json();
}