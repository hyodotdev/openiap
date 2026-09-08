import { useState, useEffect, useRef } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Bookmark } from 'lucide-react';
import { DOCS_SIDEBAR } from '../lib/config';
import { useDetailsTransition } from '../hooks/useDetailsTransition';

function clampSidebarWidth(width: number): number {
  return Math.min(
    DOCS_SIDEBAR.maxWidth,
    Math.max(DOCS_SIDEBAR.minWidth, Math.round(width))
  );
}

function readSidebarPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSidebarPreference(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Resizing still works when browser storage is unavailable.
  }
}

function readSavedSidebarWidth(): number | null {
  const saved = readSidebarPreference(DOCS_SIDEBAR.widthStorageKey);
  const value =
    saved ?? readSidebarPreference(DOCS_SIDEBAR.legacyWidth.storageKey);
  const parsed = value?.trim() ? Number(value) : Number.NaN;
  // The old version saved its default even when the reader never resized.
  if (saved === null && parsed === DOCS_SIDEBAR.legacyWidth.defaultWidth)
    return null;
  return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : null;
}

function readSavedSidebarCollapsed(): boolean {
  return readSidebarPreference(DOCS_SIDEBAR.collapsedStorageKey) === 'true';
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
  const [savedSidebarWidth, setSavedSidebarWidth] = useState(
    readSavedSidebarWidth
  );
  const sidebarWidth = savedSidebarWidth ?? DOCS_SIDEBAR.defaultWidth;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    readSavedSidebarCollapsed
  );
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  useDetailsTransition(contentRef);
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
    if (savedSidebarWidth !== null) {
      saveSidebarPreference(
        DOCS_SIDEBAR.widthStorageKey,
        String(savedSidebarWidth)
      );
    }
    saveSidebarPreference(DOCS_SIDEBAR.legacyWidth.storageKey, null);
  }, [savedSidebarWidth]);

  useEffect(() => {
    saveSidebarPreference(
      DOCS_SIDEBAR.collapsedStorageKey,
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
        Math.abs(event.clientX - drag.startX) < DOCS_SIDEBAR.dragThreshold
      ) {
        return;
      }

      drag.moved = true;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      setSavedSidebarWidth(clampSidebarWidth(nextWidth));
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
    if (isSidebarCollapsed) {
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
      setSavedSidebarWidth((width) =>
        clampSidebarWidth(
          (width ?? DOCS_SIDEBAR.defaultWidth) +
            (event.key === 'ArrowRight'
              ? DOCS_SIDEBAR.keyboardStep
              : -DOCS_SIDEBAR.keyboardStep)
        )
      );
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setSavedSidebarWidth(DOCS_SIDEBAR.minWidth);
    }

    if (event.key === 'End') {
      event.preventDefault();
      setSavedSidebarWidth(DOCS_SIDEBAR.maxWidth);
    }
  };

  const sidebarStyle = {
    '--docs-sidebar-width': `${sidebarWidth}px`,
    '--docs-sidebar-mobile-width': `${DOCS_SIDEBAR.mobileWidth}px`,
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
  const sidebarToggle =
    isSidebarOpen || typeof document === 'undefined'
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
      style={sidebarStyle}
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
          aria-valuemin={DOCS_SIDEBAR.minWidth}
          aria-valuemax={DOCS_SIDEBAR.maxWidth}
          aria-valuenow={sidebarWidth}
          title="Drag to resize · Double-click to reset"
          onPointerDown={startSidebarResize}
          onDoubleClick={() => {
            setSavedSidebarWidth(null);
            saveSidebarPreference(DOCS_SIDEBAR.widthStorageKey, null);
          }}
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
      <main ref={contentRef} className="docs-content">
        {children}
      </main>
    </div>
  );
}

export default DocsShell;
