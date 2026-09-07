import { useState, useEffect, useRef } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Bookmark } from 'lucide-react';

const SIDEBAR_WIDTH_STORAGE_KEY = 'openiap-docs-sidebar-width-v2';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'openiap-docs-sidebar-collapsed-v1';
const SIDEBAR_DEFAULT_WIDTH = 340;
const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_KEYBOARD_STEP = 16;
// Ignore tiny pointer movement so clicking the resize rail never nudges it.
const SIDEBAR_DRAG_THRESHOLD = 4;

function clampSidebarWidth(width: number) {
  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.round(width))
  );
}

function readSavedSidebarWidth() {
  if (typeof window === 'undefined') {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  const parsed = saved ? Number(saved) : Number.NaN;

  return Number.isFinite(parsed)
    ? clampSidebarWidth(parsed)
    : SIDEBAR_DEFAULT_WIDTH;
}

function readSavedSidebarCollapsed() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
}

interface DocsShellProps {
  /** The sidebar's list. Gets a closer so each link can dismiss the drawer. */
  nav: (closeSidebar: () => void) => ReactNode;
  /** Names this sidebar in the resize and collapse controls' labels. */
  navLabel: string;
  /** Widens the content column for pages that are laid out edge to edge. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * The resizable sidebar and content column shared by the two documentation
 * sections. Each section supplies its own nav and routes; the width and
 * collapsed state are one reader preference, so they are stored once here.
 */
function DocsShell({ nav, navLabel, wide = false, children }: DocsShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readSavedSidebarWidth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    readSavedSidebarCollapsed
  );
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarScrollTimeoutRef = useRef<number | null>(null);
  const dragRef = useRef<{
    startX: number;
    moved: boolean;
  } | null>(null);

  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(sidebarWidth)
    );
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isSidebarCollapsed)
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    return () => {
      if (sidebarScrollTimeoutRef.current !== null) {
        window.clearTimeout(sidebarScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      if (
        !drag.moved &&
        Math.abs(event.clientX - drag.startX) < SIDEBAR_DRAG_THRESHOLD
      ) {
        return;
      }

      drag.moved = true;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      setSidebarWidth(clampSidebarWidth(nextWidth));
    };

    const stopResizing = () => {
      dragRef.current = null;
      setIsResizingSidebar(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isResizingSidebar]);

  const startSidebarResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (window.innerWidth <= 768 || isSidebarCollapsed) {
      return;
    }

    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      moved: false,
    };
    setIsResizingSidebar(true);
  };

  const handleSidebarScroll = () => {
    setIsSidebarScrolling(true);

    if (sidebarScrollTimeoutRef.current !== null) {
      window.clearTimeout(sidebarScrollTimeoutRef.current);
    }

    sidebarScrollTimeoutRef.current = window.setTimeout(() => {
      setIsSidebarScrolling(false);
      sidebarScrollTimeoutRef.current = null;
    }, 700);
  };

  const handleSidebarResizerKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((width) =>
        clampSidebarWidth(
          width +
            (event.key === 'ArrowRight'
              ? SIDEBAR_KEYBOARD_STEP
              : -SIDEBAR_KEYBOARD_STEP)
        )
      );
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
    }

    if (event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  const sidebarStyle = {
    '--docs-sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties;

  // Portal the sidebar toggle to document.body so it sits OUTSIDE any
  // ancestor's stacking context, AND fully unmount it while the drawer
  // is open. Earlier rounds left the toggle in the DOM with
  // `.hidden { opacity: 0; pointer-events: none }` while the drawer was
  // open, which on iOS Safari still let the toggle absorb taps that
  // landed on the drawer's first menu item ("APIs" header sits at
  // y≈88-120px, exactly where the fixed toggle at top: 70px lives).
  // Removing the element from the DOM entirely guarantees the drawer
  // items underneath get every tap they should.
  const sidebarToggle = isSidebarOpen
    ? null
    : createPortal(
        <button
          type="button"
          className={`docs-sidebar-toggle ${isScrolled ? 'scrolled' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setIsSidebarOpen(true);
          }}
          aria-label="Toggle sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>Menu</span>
        </button>,
        document.body
      );

  return (
    <div
      className={`docs-container ${
        isSidebarCollapsed ? 'is-sidebar-collapsed' : ''
      } ${wide ? 'docs-container--wide' : ''}`}
    >
      {sidebarToggle}

      {/* Kept mounted so it can fade OUT with the drawer; unmounting it on
          close made the backdrop vanish instantly while the drawer was still
          sliding. Hidden state is visibility + pointer-events, not unmount. */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'is-visible' : ''}`}
        onClick={closeSidebar}
      ></div>

      <aside
        ref={sidebarRef}
        id="docs-sidebar"
        className={`docs-sidebar ${isSidebarOpen ? 'open' : ''} ${
          isResizingSidebar ? 'is-resizing' : ''
        } ${isSidebarScrolling ? 'is-sidebar-scrolling' : ''}`}
        style={sidebarStyle}
        onScroll={handleSidebarScroll}
      >
        <nav className="docs-nav">{nav(closeSidebar)}</nav>
      </aside>
      <div
        className={`docs-sidebar-rail ${
          isResizingSidebar ? 'is-resizing' : ''
        } ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
      >
        <button
          type="button"
          role="separator"
          className="docs-sidebar-resizer"
          aria-label={`Resize ${navLabel}`}
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          title="Drag to resize · Double-click to reset"
          onPointerDown={startSidebarResize}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
          onKeyDown={handleSidebarResizerKeyDown}
        >
          <span aria-hidden="true" />
        </button>
        {isResizingSidebar && (
          <output className="docs-sidebar-width-readout">
            {sidebarWidth}px
          </output>
        )}

        <button
          type="button"
          className="docs-sidebar-handle"
          aria-expanded={!isSidebarCollapsed}
          aria-controls="docs-sidebar"
          aria-label={
            isSidebarCollapsed ? `Show ${navLabel}` : `Hide ${navLabel}`
          }
          title={isSidebarCollapsed ? 'Show navigation' : 'Hide navigation'}
          onClick={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
        >
          {/* Quarter turn so it hangs off the edge like a clipped-in bookmark.
              Filled while the nav is showing, outlined once it is put away. */}
          <Bookmark
            size={17}
            strokeWidth={2}
            fill={isSidebarCollapsed ? 'none' : 'currentColor'}
            style={{ transform: 'rotate(90deg)' }}
            aria-hidden="true"
          />
        </button>
      </div>
      <main className="docs-content">{children}</main>
    </div>
  );
}

export default DocsShell;
