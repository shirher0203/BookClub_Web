declare global {
  namespace Express {
    interface User {
      id: string;
      username?: string;
      email?: string;
      /** Set for OAuth flows that still read `user._id` when issuing tokens. */
      _id?: unknown;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
