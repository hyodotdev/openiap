import { useState, ReactNode, Children } from 'react';
import '../styles/pagination.css';

interface PaginationProps {
  children: ReactNode;
  itemsPerPage?: number;
  showPageNumbers?: boolean;
  initialPage?: number;
}

function Pagination({
  children,
  itemsPerPage = 5,
  showPageNumbers = true,
  initialPage = 1,
}: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const childArray = Children.toArray(children);
  const totalPages = Math.ceil(childArray.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = childArray.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return <>{childArray}</>;
  }

  return (
    <div className="pagination-container">
      <div className="pagination-content">{currentItems}</div>

      <div className="pagination-controls">
        <button
          className="pagination-btn pagination-prev"
          onClick={() => void goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Previous</span>
        </button>

        {showPageNumbers && (
          <div className="pagination-numbers">
            {getPageNumbers().map((page, index) =>
              typeof page === 'number' ? (
                <button
                  key={index}
                  className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                  onClick={() => void goToPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="pagination-ellipsis">
                  {page}
                </span>
              ),
            )}
          </div>
        )}

        <button
          className="pagination-btn pagination-next"
          onClick={() => void goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <span>Next</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="pagination-info">
        Showing {startIndex + 1}-{Math.min(endIndex, childArray.length)} of{' '}
        {childArray.length} items
      </div>
    </div>
  );
}

export default Pagination;
