import './DeleteModal.css';

export default function DeleteModal({ visible, projectName, onConfirm, onCancel }) {
  if (!visible) return null;

  return (
    <div className="modal-overlay visible" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Delete project?</div>
        <div className="modal-body">
          This will permanently delete "{projectName}". This action cannot be undone.
        </div>
        <div className="modal-actions">
          <button className="modal-btn btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-btn btn-confirm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}