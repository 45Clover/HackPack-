import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET and APP_BASE_URL from the environment
// on the first request, so builds work before the keys exist.
export const auth0 = new Auth0Client();

// False until the Auth0 keys are in .env.local. Lets teammates run the app (and /preview) without them.
export const authReady = Boolean(process.env.AUTH0_DOMAIN);
