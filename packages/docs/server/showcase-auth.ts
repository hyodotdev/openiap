import { Auth, type AuthConfig } from '@auth/core';
import GitHub from '@auth/core/providers/github';

export interface ShowcaseAuthSettings {
  origin: string;
  secret: string;
  clientId: string;
  clientSecret: string;
  adminId: string;
}

export function showcaseAuthConfig(settings: ShowcaseAuthSettings): AuthConfig {
  return {
    basePath: '/api/auth',
    secret: settings.secret,
    trustHost: true,
    session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
    providers: [
      GitHub({
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        authorization: { params: { scope: 'read:user' } },
      }),
    ],
    callbacks: {
      signIn({ account }) {
        return (
          account?.provider === 'github' &&
          account.providerAccountId === settings.adminId
        );
      },
      jwt({ token, account }) {
        if (account) token.githubId = account.providerAccountId;
        return token;
      },
      session({ session, token }) {
        session.user.id =
          typeof token.githubId === 'string' ? token.githubId : '';
        return session;
      },
      redirect() {
        return `${settings.origin}/showcase/admin`;
      },
    },
  };
}

export async function getShowcaseAdmin(
  request: Request,
  settings: ShowcaseAuthSettings
): Promise<string | null> {
  const sessionRequest = new Request(`${settings.origin}/api/auth/session`, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  const response = await Auth(sessionRequest, showcaseAuthConfig(settings));
  const session: unknown = await response.json();
  if (typeof session !== 'object' || session === null || !('user' in session))
    return null;
  const user = session.user;
  return typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    user.id === settings.adminId
    ? settings.adminId
    : null;
}
