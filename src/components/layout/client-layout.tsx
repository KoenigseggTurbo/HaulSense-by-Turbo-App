
'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthInitializer } from '@/components/auth/auth-initializer';
import { Toaster } from '@/components/ui/toaster';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthInitializer>
        {children}
      </AuthInitializer>
      <Toaster />
    </FirebaseClientProvider>
  );
}
