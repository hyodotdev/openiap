import { useState, useEffect, useRef } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import CodeBlock from './CodeBlock';
import { DOCS_SIDEBAR } from '../lib/config';
import { readPreference, savePreference } from '../lib/storage';
import { useDetailsTransition } from '../hooks/useDetailsTransition';

function clampSidebarWidth(width: number): number {
  return Math.min(
    DOCS_SIDEBAR.maxWidth,
    Math.max(DOCS_SIDEBAR.minWidth, Math.round(width))
  );
}

function readSavedSidebarWidth(): number | null {
  const saved = readPreference(DOCS_SIDEBAR.widthStorageKey);
  const value = saved ?? readPreference(DOCS_SIDEBAR.legacyWidth.storageKey);
  const parsed = value?.trim() ? Number(value) : Number.NaN;
  // The old version saved its default even when the reader never resized.
  if (saved === null && parsed === DOCS_SIDEBAR.legacyWidth.defaultWidth)
    return null;
  return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : null;
}

function readSavedSidebarCollapsed(): boolean {
  return readPreference(DOCS_SIDEBAR.collapsedStorageKey) === 'true';
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
  const { pathname } = useLocation();
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
  const sidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement | null>(null);
  const sidebarWasOpen = useRef(false);

  // The drawer takes focus while open and hands it back to the toggle after.
  useEffect(() => {
    if (!isSidebarOpen) {
      if (sidebarWasOpen.current) sidebarToggleRef.current?.focus();
      sidebarWasOpen.current = false;
      return;
    }

    sidebarWasOpen.current = true;
    sidebarCloseRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
      if (event.key !== 'Tab') return;
      // Keep Tab inside the open drawer.
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey ? active === first : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!sidebarRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (savedSidebarWidth !== null) {
      savePreference(DOCS_SIDEBAR.widthStorageKey, String(savedSidebarWidth));
    }
    savePreference(DOCS_SIDEBAR.legacyWidth.storageKey, null);
  }, [savedSidebarWidth]);

  useEffect(() => {
    savePreference(
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

  // Portaled above every stacking context and unmounted while the drawer is
  // open: iOS Safari let a hidden toggle absorb taps on the first menu item.
  const sidebarToggle =
    isSidebarOpen || typeof document === 'undefined'
      ? null
      : createPortal(
          <button
            ref={sidebarToggleRef}
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

      {/* Kept mounted so it fades out with the drawer. */}
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
        <button
          ref={sidebarCloseRef}
          type="button"
          className="docs-sidebar-close"
          onClick={closeSidebar}
          aria-label="Close navigation"
        >
          <X size={20} aria-hidden="true" />
        </button>
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
            savePreference(DOCS_SIDEBAR.widthStorageKey, null);
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
        <details className="docs-ai-context" key={pathname}>
          <summary>Use this page with AI</summary>
          <p>Copy this into your coding assistant and add your request.</p>
          <CodeBlock language="text">{`Read https://openiap.dev${pathname} and https://openiap.dev/llms.txt. Follow the reading instructions, detailed reference, and linked guides relevant to my task before making changes.
Inspect my existing project and reuse its framework and conventions. Ask me for missing product decisions. Implement the requested behavior and run the applicable checks.
Show the working result, the commands and actual test results, and any remaining limitations. Keep your explanation brief.

My request: [describe what customers should be able to do]`}</CodeBlock>
          <Link to="/docs/guides/ai-assistants">See an example request →</Link>
        </details>
        {children}
      </main>
    </div>
  );
}

export default DocsShell;
