import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Course Catalogue — Ranking Prototype',
  description:
    'A frontend-only demo that makes a course ranking algorithm visible and manipulable: five weighted factors, percentile normalisation, and promoted placements kept out of the score.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
