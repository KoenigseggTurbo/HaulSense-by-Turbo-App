'use client';

import { useEffect } from 'react';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';

/**
 * AuthInitializer ensures that the user is authenticated (at least anonymously)
 * so that they can perform Firestore operations like saving loads.
 */
export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    // If we've finished checking auth and there's no user, sign in anonymously.
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  return <>{children}</>;
}
