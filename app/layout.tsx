import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Picture MultiCompare – Bilder gleichzeitig vergleichen',
  description:
    'Vergleiche bis zu zwölf Bilder gleichzeitig in einer lokalen, sternförmig geteilten Ansicht.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
