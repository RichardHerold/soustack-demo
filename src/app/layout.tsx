import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Soustack — Structure any recipe',
  description: 'Paste a recipe URL or text. Get a structured, cookable recipe.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
