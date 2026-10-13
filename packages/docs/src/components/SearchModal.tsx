import { useEffect, useRef, useState, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiData, type ApiItem } from '../lib/searchData';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Rendered only while open, so every search starts empty.
function SearchPanel({ onClose }: Pick<SearchModalProps, 'onClose'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const filteredApis = useMemo(() => {
    if (!searchQuery) return [];

    const query = searchQuery.toLowerCase();
    return apiData.filter(
      (api) =>
        api.title.toLowerCase().includes(query) ||
        api.description?.toLowerCase().includes(query) ||
        api.parameters?.toLowerCase().includes(query) ||
        api.returns?.toLowerCase().includes(query) ||
        api.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleApiSelect = (api: ApiItem) => {
    void navigate(api.path);
    onClose();
  };

  // Focused results handle Enter themselves as buttons.
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredApis.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      const selectedApi = filteredApis[selectedIndex];
      if (selectedApi) {
        e.preventDefault();
        handleApiSelect(selectedApi);
      }
    }
  };

  return (
    <>
      <div className="search-modal-header">
        <Search className="search-modal-icon" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search APIs..."
          aria-label="Search APIs"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          className="search-modal-input"
        />
        <button
          type="button"
          onClick={onClose}
          className="search-modal-close"
          aria-label="Close search"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {searchQuery && (
        <div className="search-modal-results">
          {filteredApis.length > 0 ? (
            <>
              <div className="search-result-count">
                {filteredApis.length} result
                {filteredApis.length !== 1 ? 's' : ''}
              </div>
              <div className="search-result-list">
                {filteredApis.map((api, index) => (
                  <button
                    key={api.id}
                    type="button"
                    onClick={() => handleApiSelect(api)}
                    className={`search-result-item ${
                      index === selectedIndex ? 'selected' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onFocus={() => setSelectedIndex(index)}
                  >
                    <div className="search-result-content">
                      <div className="search-result-header">
                        <span className="search-result-title">
                          {highlightMatch(api.title, searchQuery)}
                        </span>
                        <span className="search-result-category">
                          {api.category}
                        </span>
                      </div>
                      {api.description && (
                        <p className="search-result-description">
                          {highlightMatch(api.description, searchQuery)}
                        </p>
                      )}
                      <div className="search-result-meta">
                        {api.parameters && (
                          <span className="search-result-params">
                            {highlightMatch(api.parameters, searchQuery)}
                          </span>
                        )}
                        {api.returns && (
                          <span className="search-result-returns">
                            → {highlightMatch(api.returns, searchQuery)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="search-no-results">
              No results found for "{searchQuery}"
            </div>
          )}
        </div>
      )}

      <div className="search-modal-footer">
        <div className="search-shortcuts">
          <span className="search-shortcut">
            <kbd>↑↓</kbd> Navigate
          </span>
          <span className="search-shortcut">
            <kbd>Enter</kbd> Select
          </span>
          <span className="search-shortcut">
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </>
  );
}

function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const overflow = document.body.style.overflow;
    dialog.showModal();
    // showModal() focuses the dialog itself; React's autoFocus never sets the attribute it looks for.
    dialog.querySelector<HTMLInputElement>('.search-modal-input')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="search-modal"
      aria-label="API search"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPointerDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPointerDown.current && event.target === event.currentTarget)
          onClose();
      }}
    >
      {isOpen && <SearchPanel onClose={onClose} />}
    </dialog>
  );
}

export default SearchModal;
