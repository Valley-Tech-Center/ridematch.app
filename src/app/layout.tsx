import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed font to Inter for a modern look
import './globals.css';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/context/auth-context'; // Import AuthProvider
import { MainLayout } from '@/components/layout/main-layout'; // Import MainLayout
import { Toaster } from '@/components/ui/toaster'; // Import Toaster for notifications

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'RideThere', // Updated title
  description: 'Coordinate rides for conferences', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <AuthProvider> {/* Wrap with AuthProvider */}
          <MainLayout>{children}</MainLayout> {/* Use MainLayout */}
          <Toaster /> {/* Add Toaster */}
        </AuthProvider>
      </body>
    </html>
  );
}
