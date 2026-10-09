import { handleShowcaseApi } from '../showcase-runtime';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path =
      url.searchParams.get('authPath') ??
      url.pathname.slice('/api/auth/'.length);
    if (
      !/^(csrf|session|providers|signin(?:\/github)?|signout|callback\/github|error|verify-request)$/.test(
        path
      )
    )
      return new Response('Not found', { status: 404 });
    url.searchParams.delete('authPath');
    url.pathname = `/api/auth/${path}`;
    return handleShowcaseApi(new Request(url, request));
  },
};
