// STUB. Owner: Platform + auth (@fabf28). Replace with the real Auth0Client from the tutorial (T6),
// and add proxy.ts. The UI only calls auth0.getSession(), which keeps the same shape.
export const auth0 = {
  async getSession(): Promise<{ user: { sub: string; name?: string; picture?: string } } | null> {
    return null;
  },
};
