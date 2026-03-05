/**
 * Shared TypeScript types for API responses (no Mongoose).
 * All ids are strings for JSON compatibility.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  user?: User;
  text: string;
  image?: string;
  likesCount: number;
  commentsCount: number;
  likes?: string[];
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user?: User;
  text: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
