import { useId, useState, useEffect } from 'react';
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
  return 'items' in entry && Array.isArray((entry as MenuGroup).items);
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

function Chevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <path
        d="M3 1 L7 5 L3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SubMenu({ group, onItemClick }: SubMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const submenuContentId = useId();

  const isAnyChildActive = group.items.some(
    (item) => location.pathname === item.to
  );

  useEffect(() => {
    if (isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive]);

  const toggleExpanded = () => setIsExpanded((v) => !v);

  return (
    <li className="menu-dropdown menu-dropdown--nested">
      {/* Single disclosure button — both halves do the same thing, so
          collapsing into one element keeps the keyboard tab order at one
          stop per group instead of two redundant ones. */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={`menu-dropdown-header ${isAnyChildActive ? 'group-active' : ''}`}
        aria-expanded={isExpanded}
        aria-controls={submenuContentId}
        aria-label={`Toggle ${group.label} submenu`}
      >
        <span className="menu-dropdown-title menu-dropdown-title--nested">
          {group.label}
        </span>
        <span className="menu-dropdown-toggle" aria-hidden="true">
          <Chevron isExpanded={isExpanded} />
        </span>
      </button>
      <div
        id={submenuContentId}
        className="menu-dropdown-content"
        data-expanded={isExpanded}
        aria-hidden={!isExpanded}
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
  const location = useLocation();
  const navigate = useNavigate();
  const contentId = useId();

  const isTitleActive = location.pathname === titleTo;
  const isChildActive = items.some((entry) =>
    isGroup(entry)
      ? entry.items.some((i) => location.pathname === i.to)
      : location.pathname === entry.to
  );
  const isGroupActive = isTitleActive || isChildActive;

  useEffect(() => {
    if (isGroupActive) {
      setIsExpanded(true);
    }
  }, [isGroupActive]);

  // Title click: always navigate + close the mobile drawer. Collapsing
  // is handled exclusively by the dedicated chevron toggle so screen-
  // reader semantics stay clean (the title is a nav control, not a
  // disclosure control).
  const handleTitleClick = () => {
    setIsExpanded(true);
    navigate(titleTo);
    onItemClick?.();
  };

  const toggleExpanded = () => setIsExpanded((v) => !v);

  return (
    <li className="menu-dropdown">
      <div
        className={`menu-dropdown-header ${isTitleActive ? 'active' : isChildActive ? 'group-active' : ''}`}
      >
        <button
          type="button"
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
          type="button"
          onClick={toggleExpanded}
          className="menu-dropdown-toggle"
          aria-label={`Toggle ${title} submenu`}
          aria-expanded={isExpanded}
          aria-controls={contentId}
        >
          <Chevron isExpanded={isExpanded} />
        </button>
      </div>
      <div
        id={contentId}
        className="menu-dropdown-content"
        data-expanded={isExpanded}
        aria-hidden={!isExpanded}
      >
        <ul className="menu-dropdown-items">
          {items.map((entry) =>
            isGroup(entry) ? (
              <SubMenu
                key={`${titleTo}::group::${entry.label}::${entry.items[0]?.to ?? ''}`}
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
