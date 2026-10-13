'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary. Replaces the root layout, so it must render its own
 * <html> and <body> and cannot rely on any shared component, font or stylesheet
 * — anything imported here is a liability, which is why this file inlines the
 * handful of styles it needs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('global error', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          color: '#15171b',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: '32rem', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            The app failed to start
          </h1>
          <p
            role="alert"
            style={{
              margin: '0.75rem 0 1rem',
              padding: '0.5rem 0.75rem',
              border: '1px solid #a02a21',
              background: '#f9e7e5',
              color: '#a02a21',
              fontSize: '0.8125rem',
            }}
          >
            {error.message || 'An unexpected error stopped the app from rendering.'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: '1.75rem',
              padding: '0 0.625rem',
              border: '1px solid #15171b',
              borderRadius: 2,
              background: '#15171b',
              color: '#fff',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Reload the app
          </button>
          {error.digest !== undefined && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: '#585f68' }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}