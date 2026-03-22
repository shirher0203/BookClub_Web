/**
 * Seed demo users, posts, and comments for local UI testing.
 *
 * Usage:
 *   cd server && npm run seed
 *
 * If the database already has posts, the script skips (safe for non-empty DB).
 * To replace demo data only:
 *   npm run seed -- --force
 *
 * Demo users use emails ending in @bookclub.demo (removed on --force before re-seed).
 */
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import { Comment } from '../models/commentModel';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_EMAIL = /@bookclub\.demo$/;

const force = process.argv.includes('--force');

async function removeDemoData(): Promise<void> {
  const demoUsers = await User.find({ email: DEMO_EMAIL }).lean();
  const userIds = demoUsers.map((u) => u._id);
  if (userIds.length === 0) return;

  const posts = await Post.find({ userId: { $in: userIds } }).lean();
  const postIds = posts.map((p) => p._id);

  await Comment.deleteMany({
    $or: [{ postId: { $in: postIds } }, { userId: { $in: userIds } }],
  });
  await Post.deleteMany({ _id: { $in: postIds } });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log('Removed previous @bookclub.demo users and their posts/comments.');
}

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookclub';
  await mongoose.connect(uri);
  console.log('Connected:', uri.replace(/:[^:@]+@/, ':****@'));

  if (force) {
    await removeDemoData();
  } else {
    const n = await Post.countDocuments();
    if (n > 0) {
      console.log(
        `Skip: database already has ${n} post(s). Use --force to replace demo data only.`
      );
      await mongoose.disconnect();
      return;
    }
  }

  const alice = await User.create({
    username: 'alice_reads',
    email: 'alice@bookclub.demo',
    profileImage: '',
  });
  const bob = await User.create({
    username: 'bob_bookworm',
    email: 'bob@bookclub.demo',
    profileImage: '',
  });
  const carol = await User.create({
    username: 'carol_shelves',
    email: 'carol@bookclub.demo',
    profileImage: '',
  });

  const p1 = await Post.create({
    userId: alice._id,
    bookName: 'Pride and Prejudice',
    bookAuthor: 'Jane Austen',
    genre: 'Classic romance',
    score: 5,
    text:
      'Still witty after all these years. Elizabeth and Darcy’s slow burn is perfect for a rainy afternoon — I laughed out loud at the letters.',
    likes: [bob._id],
    likesCount: 1,
    commentsCount: 0,
  });

  const p2 = await Post.create({
    userId: bob._id,
    bookName: 'The Hobbit',
    bookAuthor: 'J.R.R. Tolkien',
    genre: 'Fantasy',
    score: 4,
    text:
      'Comfort read with dragons and a very relatable hobbit. Shorter than LOTR — finished it in a weekend.',
    likes: [alice._id, carol._id],
    likesCount: 2,
    commentsCount: 0,
  });

  const p3 = await Post.create({
    userId: carol._id,
    bookName: 'Educated',
    bookAuthor: 'Tara Westover',
    genre: 'Memoir',
    score: 5,
    text:
      'Heavy but hopeful. The education theme hit close to home — would love to discuss in our next club meet.',
    likes: [],
    likesCount: 0,
    commentsCount: 0,
  });

  const commentsSpec: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    text: string;
  }[] = [
    {
      postId: p1._id,
      userId: bob._id,
      text: 'Same edition with the Peacock cover? The footnotes in mine are hilarious.',
    },
    {
      postId: p1._id,
      userId: carol._id,
      text: 'Adding this to my spring list — thanks for the nudge!',
    },
    {
      postId: p2._id,
      userId: alice._id,
      text: 'Try the Alan Lee illustrated version if you can — the maps are gorgeous.',
    },
    {
      postId: p2._id,
      userId: carol._id,
      text: 'Weekend goal: finally start Fellowship after this.',
    },
    {
      postId: p3._id,
      userId: alice._id,
      text: 'Read it last year — the ending still sits with me. Worth a re-read.',
    },
  ];

  for (const c of commentsSpec) {
    await Comment.create(c);
  }

  await Post.findByIdAndUpdate(p1._id, { commentsCount: 2 });
  await Post.findByIdAndUpdate(p2._id, { commentsCount: 2 });
  await Post.findByIdAndUpdate(p3._id, { commentsCount: 1 });

  console.log('');
  console.log('Demo data created:');
  console.log(`  Users: ${alice.username}, ${bob.username}, ${carol.username} (@bookclub.demo)`);
  console.log('  Posts: 3 | Comments: 5');
  console.log('');
  console.log('Open the app feed at http://localhost:5173/feed');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
