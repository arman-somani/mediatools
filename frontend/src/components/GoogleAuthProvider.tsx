'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

const DEFAULT_CLIENT_ID = '922405274681-tshc81918urtt7ucfr1ji5jiis8h62bk.apps.googleusercontent.com';

export default function GoogleAuthProvider({
  children,
  clientId,
}: {
  children: React.ReactNode;
  clientId?: string;
}) {
  const activeClientId = clientId?.trim() || DEFAULT_CLIENT_ID;

  if (!activeClientId) {
    return <>{children}</>;
  }

  return <GoogleOAuthProvider clientId={activeClientId}>{children}</GoogleOAuthProvider>;
}
