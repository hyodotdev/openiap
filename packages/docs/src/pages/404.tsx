import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import SEO from '../components/SEO';

export default function NotFound() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you're looking for doesn't exist. Return to OpenIAP documentation for in-app purchase guides and API references."
        path="/404"
      />
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%',
        }}
      >
        {/* 404 Number */}
        <h1
          style={{
            fontSize: 'clamp(5rem, 12vw, 8rem)',
            fontWeight: '700',
            color: isDark ? '#6b7280' : '#9ca3af',
            margin: '0',
            lineHeight: '1',
            letterSpacing: '-0.05em',
          }}
        >
          404
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: '1.25rem',
            color: 'var(--text-secondary, #6b7280)',
            marginTop: '1.5rem',
            marginBottom: '3rem',
          }}
        >
          Page not found
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}
        >
          <button
            onClick={() => window.history.back()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              color: isDark ? '#e5e7eb' : '#374151',
              backgroundColor: 'transparent',
              border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              lineHeight: '1.5',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark
                ? 'rgba(75, 85, 99, 0.3)'
                : '#f9fafb';
              e.currentTarget.style.borderColor = isDark
                ? '#6b7280'
                : '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = isDark
                ? '#4b5563'
                : '#e5e7eb';
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              color: 'white',
              backgroundColor: 'var(--primary-color, #a47465)',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              border: '1px solid transparent',
              lineHeight: '1.5',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 8px 20px rgba(164, 116, 101, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Home
            <Home size={18} />
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
