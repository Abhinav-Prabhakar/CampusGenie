import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // The Capacitor/PWA client has its own deliberately narrow, read-only API.
  // Keep the rest of the web application's routes behind Clerk.
  "/api/mobile(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // `mjs` must be excluded alongside `js` — maplibre-gl's web worker is a
    // public .mjs asset; letting the middleware run on it redirects the
    // worker fetch to /sign-in (HTML), which kills every map render.
    "/((?!_next|[^?]*\\.(?:html?|css|mjs|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
