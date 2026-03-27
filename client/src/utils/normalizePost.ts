import type { Comment, Post, User } from '../types';

function populateUser(userIdRaw: unknown): { userId: string; user?: User } {
  if (userIdRaw && typeof userIdRaw === 'object' && '_id' in userIdRaw) {
    const u = userIdRaw as { _id: string; username?: string; profileImage?: string; email?: string };
    return {
      userId: String(u._id),
      user: {
        id: String(u._id),
        username: u.username ?? '',
        email: u.email ?? '',
        profileImage: u.profileImage,
        createdAt: '',
      },
    };
  }
  return { userId: String(userIdRaw ?? '') };
}

/** Normalize Mongo-style JSON from API to shared `Post` type. */
export function normalizePost(raw: Record<string, unknown>): Post {
  const id = raw._id != null ? String(raw._id) : '';
  const { userId, user } = populateUser(raw.userId);
  const likesRaw = raw.likes as unknown[] | undefined;
  const likes = likesRaw?.map((x) => String(x));

  return {
    id,
    userId,
    user,
    bookName: String(raw.bookName ?? ''),
    bookAuthor: raw.bookAuthor != null ? String(raw.bookAuthor) : undefined,
    genre: raw.genre != null ? String(raw.genre) : undefined,
    score: raw.score != null ? Number(raw.score) : undefined,
    text: String(raw.text ?? ''),
    image: raw.image != null ? String(raw.image) : undefined,
    likesCount: Number(raw.likesCount ?? 0),
    commentsCount: Number(raw.commentsCount ?? 0),
    likes,
    createdAt:
      raw.createdAt != null
        ? new Date(raw.createdAt as string | number | Date).toISOString()
        : '',
  };
}

/** Normalize comment document from API. */
export function normalizeComment(raw: Record<string, unknown>): Comment {
  const id = raw._id != null ? String(raw._id) : '';
  const { userId, user } = populateUser(raw.userId);
  return {
    id,
    postId: String(raw.postId ?? ''),
    userId,
    user,
    text: String(raw.text ?? ''),
    createdAt:
      raw.createdAt != null
        ? new Date(raw.createdAt as string | number | Date).toISOString()
        : '',
  };
}
