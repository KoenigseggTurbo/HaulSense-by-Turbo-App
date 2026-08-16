
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeHandler } from '@/components/layout/theme-handler';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthInitializer } from '@/components/auth/auth-initializer';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'HaulSense By Turbo | Owner Operator Load & Pay Tracker',
  description: 'Professional load management and financial tracking for independent truckers.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HaulSense',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased bg-background text-foreground min-h-screen">
        <FirebaseClientProvider>
          <ThemeHandler />
          <AuthInitializer>
            {children}
          </AuthInitializer>
        </FirebaseClientProvider>
        <PwaRegister />
        <Toaster />
      </body>
    </html>
  );
}
