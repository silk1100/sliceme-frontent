import { Link } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar({ showTrash = false, trashEnabled = false, onTrashClick = null, showBack = false, onBackClick = null }) {
  return (
    <aside className="sidebar">
      <div className="logo-mark">
        <span></span>
      </div>

      {showBack ? (
        <button className="sidebar-btn" onClick={onBackClick} title="Back to library">
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <path d="M6 1L1 6L6 11M1 6H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <Link to="/upload" className="sidebar-btn" title="Upload new">
          <div className="icon-upload"></div>
        </Link>
      )}

      {showTrash && (
        <button
          className={`sidebar-btn trash-btn ${trashEnabled ? 'enabled' : ''}`}
          onClick={trashEnabled ? onTrashClick : null}
          title="Delete selected"
          disabled={!trashEnabled}
        >
          <div className="icon-trash"></div>
        </button>
      )}
    </aside>
  );
}