import { refreshAccessToken } from '@/lib/apollo/client';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Uploads one file to the admin product-image REST endpoint and returns its
 * saved URL. Used by both ProductForm's general image uploader and its
 * per-color image uploader.
 *
 * ROOT-CAUSE FIX: this is a plain `fetch()`, not an Apollo Client request,
 * so it never went through apollo/client.ts's silent-refresh-and-retry
 * error link — meaning the 15-minute access token (see that file's own
 * comment for the full backstory) could expire mid-admin-session and this
 * upload would fail with a 401 that just showed a generic "check that the
 * backend is running" alert, even though the backend was fine and the real
 * cause was an expired token. This now does the same silent
 * refresh-then-retry-once the GraphQL side already does, so an admin who's
 * been filling out a product form (or uploading photos for several colors
 * in a row) for more than 15 minutes doesn't hit a confusing dead end.
 */
export async function uploadProductImage(file: File): Promise<string> {
  async function attempt(token: string | null): Promise<Response> {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/upload/product-image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
  }

  let res = await attempt(useAuthStore.getState().accessToken);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await attempt(newToken);
    }
  }

  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json();
  return url as string;
}
