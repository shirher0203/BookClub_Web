import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  userId: mongoose.Types.ObjectId;
  bookName: string;
  bookAuthor?: string;
  genre?: string;
  /** 1–5 star rating, optional */
  score?: number;
  text: string;
  image?: string;
  likes: mongoose.Types.ObjectId[];
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    bookAuthor: {
      type: String,
      required: false,
      trim: true,
      maxlength: 200,
    },
    genre: {
      type: String,
      required: false,
      trim: true,
      maxlength: 60,
    },
    score: {
      type: Number,
      required: false,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    image: {
      type: String,
      required: false,
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

postSchema.index({ createdAt: -1 });

export const Post = mongoose.model<IPost>('Post', postSchema);
