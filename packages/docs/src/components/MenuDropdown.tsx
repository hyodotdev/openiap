import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export interface MenuItem {
  to: string;
  label: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export type MenuEntry = MenuItem | MenuGroup;

function isGroup(entry: MenuEntry): entry is MenuGroup {
  return (entry as MenuGroup).items !== undefined;
}

interface MenuDropdownProps {
  title: string;
  titleTo: string;
  items: MenuEntry[];
  onItemClick?: () => void;
}

interface SubMenuProps {
  group: MenuGroup;
  onItemClick?: () => void;
}

function SubMenu({ group, onItemClick }: SubMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const location = useLocation();

  const isAnyChildActive = group.items.some(
    (item) => location.pathname === item.to
  );

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded, group.items.length]);

  useEffect(() => {
    if (isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <li className="menu-dropdown menu-dropdown--nested">
      <div
        className={`menu-dropdown-header ${isAnyChildActive ? 'group-active' : ''}`}
      >
        <button
          onClick={toggleExpanded}
          className="menu-dropdown-title menu-dropdown-title--nested"
        >
          {group.label}
        </button>
        <button
          onClick={toggleExpanded}
          className="menu-dropdown-toggle"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-label={`Toggle ${group.label} submenu`}
        >
          ▶
        </button>
      </div>
      <div
        ref={contentRef}
        className="menu-dropdown-content"
        style={{
          maxHeight: `${height}px`,
        }}
      >
        <ul className="menu-dropdown-items menu-dropdown-items--nested">
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `menu-dropdown-item ${isActive ? 'active' : ''}`
                }
                onClick={onItemClick}
              >
                <span className="menu-dropdown-item-prefix">└</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
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

  const isTitleActive = location.pathname === titleTo;
  const isChildActive = items.some((entry) =>
    isGroup(entry)
      ? entry.items.some((i) => location.pathname === i.to)
      : location.pathname === entry.to
  );
  const isGroupActive = isTitleActive || isChildActive;

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded, items.length]);

  useEffect(() => {
    if (isGroupActive) {
      setIsExpanded(true);
    }
  }, [isGroupActive]);

  const handleTitleClick = () => {
    setIsExpanded(true);
    navigate(titleTo);
    onItemClick?.();
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <li className="menu-dropdown">
      <div
        className={`menu-dropdown-header ${isTitleActive ? 'active' : isChildActive ? 'group-active' : ''}`}
      >
        <button
          onClick={handleTitleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`menu-dropdown-title ${isTitleActive ? 'active' : ''}`}
          style={{
            color:
              isTitleActive || isHovered ? 'var(--primary-color)' : 'inherit',
          }}
        >
          {title}
        </button>
        <button
          onClick={toggleExpanded}
          className="menu-dropdown-toggle"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-label={`Toggle ${title} submenu`}
        >
          ▶
        </button>
      </div>
      <div
        ref={contentRef}
        className="menu-dropdown-content"
        style={{
          maxHeight: isExpanded ? 'none' : `${height}px`,
          overflow: isExpanded ? 'visible' : 'hidden',
        }}
      >
        <ul className="menu-dropdown-items">
          {items.map((entry) =>
            isGroup(entry) ? (
              <SubMenu
                key={entry.label}
                group={entry}
                onItemClick={onItemClick}
              />
            ) : (
              <li key={entry.to}>
                <NavLink
                  to={entry.to}
                  className={({ isActive }) =>
                    `menu-dropdown-item ${isActive ? 'active' : ''}`
                  }
                  onClick={onItemClick}
                >
                  <span className="menu-dropdown-item-prefix">└</span>
                  {entry.label}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </div>
    </li>
  );
}
