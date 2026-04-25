import { useId, useState, useRef, useEffect } from 'react';
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

function useCollapse(isExpanded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip animation on first mount — set the resting state directly so
    // pages don't flicker open/closed when the sidebar renders.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      el.style.maxHeight = isExpanded ? 'none' : '0px';
      return;
    }

    if (isExpanded) {
      // Expanding: from 0 → scrollHeight, then unlock to 'none' so nested
      // submenus can grow freely.
      el.style.maxHeight = `${el.scrollHeight}px`;
      const handleEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'max-height') {
          el.style.maxHeight = 'none';
        }
      };
      el.addEventListener('transitionend', handleEnd, { once: true });
      return () => el.removeEventListener('transitionend', handleEnd);
    }

    // Collapsing: maxHeight is currently 'none' (after a previous expand)
    // or some pixel value. Snap to a numeric pixel value, force a reflow
    // so the browser registers it as the transition's starting point,
    // then animate to 0 in the next frame.
    el.style.maxHeight = `${el.scrollHeight}px`;
    void el.offsetHeight;
    const id = requestAnimationFrame(() => {
      el.style.maxHeight = '0px';
    });
    return () => cancelAnimationFrame(id);
  }, [isExpanded]);

  return ref;
}

function SubMenu({ group, onItemClick }: SubMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const submenuContentId = useId();

  const isAnyChildActive = group.items.some(
    (item) => location.pathname === item.to
  );

  const contentRef = useCollapse(isExpanded);

  useEffect(() => {
    if (isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive]);

  const toggleExpanded = () => setIsExpanded((v) => !v);

  return (
    <li className="menu-dropdown menu-dropdown--nested">
      <div
        className={`menu-dropdown-header ${isAnyChildActive ? 'group-active' : ''}`}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          className="menu-dropdown-title menu-dropdown-title--nested"
          aria-expanded={isExpanded}
          aria-controls={submenuContentId}
        >
          {group.label}
        </button>
        <button
          type="button"
          onClick={toggleExpanded}
          className="menu-dropdown-toggle"
          aria-label={`Toggle ${group.label} submenu`}
          aria-expanded={isExpanded}
          aria-controls={submenuContentId}
        >
          <Chevron isExpanded={isExpanded} />
        </button>
      </div>
      <div
        id={submenuContentId}
        ref={contentRef}
        className="menu-dropdown-content"
        style={{ maxHeight: '0px' }}
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

  const contentRef = useCollapse(isExpanded);

  useEffect(() => {
    if (isGroupActive) {
      setIsExpanded(true);
    }
  }, [isGroupActive]);

  const handleTitleClick = () => {
    if (isExpanded && isTitleActive) {
      setIsExpanded(false);
      return;
    }
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
          aria-expanded={isExpanded}
          aria-controls={contentId}
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
        ref={contentRef}
        className="menu-dropdown-content"
        style={{ maxHeight: '0px' }}
      >
        <ul className="menu-dropdown-items">
          {items.map((entry) =>
            isGroup(entry) ? (
              <SubMenu
                key={`${titleTo}::group::${entry.label}`}
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
