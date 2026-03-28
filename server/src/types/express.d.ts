declare global {
  namespace Express {
    /** Merged with Passport's `Express.User` so `req.user` is typed for JWT + OAuth. */
    interface User {
      /** Set by authMiddleware; Mongoose docs may expose only `_id`. */
      id?: string;
      _id?: unknown;
      username?: string;
      email?: string;
    }
  }
}

export {};
