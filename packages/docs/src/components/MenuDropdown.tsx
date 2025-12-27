import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface MenuItem {
  to: string;
  label: string;
}

interface MenuDropdownProps {
  title: string;
  titleTo: string;
  items: MenuItem[];
  onItemClick?: () => void;
}

export function MenuDropdown({
  title,
  titleTo,
  items,
  onItemClick,
}: MenuDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === titleTo;

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded]);

  useEffect(() => {
    // Auto-expand when navigating to the title page
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  const handleTitleClick = () => {
    if (isExpanded) {
      // If already expanded, toggle (collapse)
      setIsExpanded(false);
    } else {
      // If collapsed, expand and navigate
      setIsExpanded(true);
      navigate(titleTo);
      onItemClick?.();
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <li className="menu-dropdown">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0',
        }}
      >
        <button
          onClick={handleTitleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={isActive ? 'active' : ''}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
            font: 'inherit',
            color: isActive || isHovered ? 'var(--primary-color)' : 'inherit',
            transition: 'color 0.2s',
          }}
        >
          {title}
        </button>
        <button
          onClick={toggleExpanded}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '1.5rem',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-label={`Toggle ${title} submenu`}
        >
          ▶
        </button>
      </div>
      <div
        ref={contentRef}
        style={{
          maxHeight: `${height}px`,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        <ul style={{ paddingLeft: '0', marginTop: '0.5rem', listStyle: 'none' }}>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={onItemClick}
                style={{ fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75em' }}>└</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
