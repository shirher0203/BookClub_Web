/**
 * Seed demo users, posts, and comments for local UI testing / demos.
 *
 * Usage:
 *   cd server && npm run seed
 *
 * If the database already has @bookclub.demo users, the script skips (safe).
 * To replace demo data only:
 *   npm run seed -- --force
 *
 * Scope: only touches users whose email ends in @bookclub.demo and their
 * posts/comments. Real user data is never deleted.
 *
 * Password: every demo user is seeded with bcrypt-hashed password
 *   bookclub123
 * so you can log in through the normal /login flow for demos.
 *
 * Images: the script reuses existing files in
 *   server/public/uploads/profiles/
 *   server/public/uploads/posts/
 * and round-robin assigns them. It does NOT create or download images.
 * If the directories are empty the seed still works — users just have no
 * avatars and posts no covers.
 *
 * Running twice (without --force) is a no-op.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import { Comment } from '../models/commentModel';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_EMAIL_DOMAIN = '@bookclub.demo';
const DEMO_EMAIL = /@bookclub\.demo$/;
const DEMO_PASSWORD = 'bookclub123';
const BCRYPT_ROUNDS = 10;

const UPLOADS_ROOT = path.join(__dirname, '../../public/uploads');
const PROFILE_DIR = path.join(UPLOADS_ROOT, 'profiles');
const POSTS_DIR = path.join(UPLOADS_ROOT, 'posts');

const force = process.argv.includes('--force');

interface UserSpec {
  username: string;
  email: string;
}

interface PostSpec {
  author: string;
  bookName: string;
  bookAuthor: string;
  genre: string;
  score: number;
  text: string;
  useImage: boolean;
}

interface CommentSpec {
  postIndex: number;
  author: string;
  text: string;
}

const USERS: UserSpec[] = [
  { username: 'alice_reads', email: `alice${DEMO_EMAIL_DOMAIN}` },
  { username: 'bob_bookworm', email: `bob${DEMO_EMAIL_DOMAIN}` },
  { username: 'carol_shelves', email: `carol${DEMO_EMAIL_DOMAIN}` },
  { username: 'danny_pages', email: `danny${DEMO_EMAIL_DOMAIN}` },
  { username: 'eve_highlighter', email: `eve${DEMO_EMAIL_DOMAIN}` },
  { username: 'frank_margins', email: `frank${DEMO_EMAIL_DOMAIN}` },
  { username: 'grace_ink', email: `grace${DEMO_EMAIL_DOMAIN}` },
  { username: 'henry_chapters', email: `henry${DEMO_EMAIL_DOMAIN}` },
  { username: 'iris_folio', email: `iris${DEMO_EMAIL_DOMAIN}` },
  { username: 'jack_binding', email: `jack${DEMO_EMAIL_DOMAIN}` },
  { username: 'kate_spine', email: `kate${DEMO_EMAIL_DOMAIN}` },
  { username: 'leo_verse', email: `leo${DEMO_EMAIL_DOMAIN}` },
  { username: 'maya_prose', email: `maya${DEMO_EMAIL_DOMAIN}` },
];

/**
 * 30 posts covering repeating books + clusters to exercise search:
 *   - Pride and Prejudice (3 reviewers)
 *   - The Hobbit (2 reviewers)
 *   - Educated (2 reviewers)
 *   - Tolkien cluster (Hobbit, Fellowship, Two Towers — same author, genre)
 *   - Le Guin cluster (Wizard of Earthsea, Left Hand of Darkness)
 *   - Atwood cluster (Handmaid's Tale, Oryx and Crake)
 *   - Ishiguro cluster (Klara and the Sun, Never Let Me Go)
 *   - 18 further standalone reviews across 8+ distinct genres
 */
const POSTS: PostSpec[] = [
  { author: 'alice_reads',    bookName: 'Pride and Prejudice',         bookAuthor: 'Jane Austen',          genre: 'Classic romance',     score: 5, text: "Still witty after all these years. Elizabeth and Darcy's slow burn is perfect for a rainy afternoon — I laughed out loud at the letters.", useImage: true },
  { author: 'eve_highlighter', bookName: 'Pride and Prejudice',        bookAuthor: 'Jane Austen',          genre: 'Classic romance',     score: 4, text: 'Second read and I noticed much more about Mr. Bennet this time. Austen writes parents with such precision.', useImage: false },
  { author: 'maya_prose',      bookName: 'Pride and Prejudice',        bookAuthor: 'Jane Austen',          genre: 'Classic romance',     score: 5, text: 'A comfort re-read every autumn. The proposal scene still makes me put the book down and walk around the room.', useImage: false },
  { author: 'bob_bookworm',    bookName: 'The Hobbit',                 bookAuthor: 'J.R.R. Tolkien',       genre: 'Fantasy',             score: 4, text: 'Comfort read with dragons and a very relatable hobbit. Shorter than LOTR — finished it in a weekend.', useImage: true },
  { author: 'henry_chapters',  bookName: 'The Hobbit',                 bookAuthor: 'J.R.R. Tolkien',       genre: 'Fantasy',             score: 5, text: "Read it to my niece this month. She drew a map of Middle-earth on the fridge — I'm counting that as a five-star review.", useImage: false },
  { author: 'jack_binding',    bookName: 'The Fellowship of the Ring', bookAuthor: 'J.R.R. Tolkien',       genre: 'Fantasy',             score: 5, text: 'The walking is the point. Twenty years of re-reads and Rivendell still feels like coming home.', useImage: true },
  { author: 'grace_ink',       bookName: 'The Two Towers',             bookAuthor: 'J.R.R. Tolkien',       genre: 'Fantasy',             score: 4, text: 'Middle book rarely slows me down like this one does — and that is a compliment. The Ents are unreasonably moving.', useImage: false },
  { author: 'carol_shelves',   bookName: 'Educated',                   bookAuthor: 'Tara Westover',        genre: 'Memoir',              score: 5, text: 'Heavy but hopeful. The education theme hit close to home — would love to discuss in our next club meet.', useImage: true },
  { author: 'iris_folio',      bookName: 'Educated',                   bookAuthor: 'Tara Westover',        genre: 'Memoir',              score: 5, text: 'Could not put it down. The last chapters read like a thriller even though you know how it ends.', useImage: false },
  { author: 'leo_verse',       bookName: 'A Wizard of Earthsea',       bookAuthor: 'Ursula K. Le Guin',    genre: 'Fantasy',             score: 5, text: 'Small book, huge ideas. True names, shadows, the sea — writing this tight feels like a secret.', useImage: true },
  { author: 'danny_pages',     bookName: 'The Left Hand of Darkness',  bookAuthor: 'Ursula K. Le Guin',    genre: 'Science fiction',     score: 4, text: 'Le Guin in cold-weather mode. The gender world-building still feels decades ahead of today.', useImage: false },
  { author: 'kate_spine',      bookName: "The Handmaid's Tale",        bookAuthor: 'Margaret Atwood',      genre: 'Dystopian fiction',   score: 5, text: 'Reread after the show — the prose is sharper than I remembered and the ending is somehow even bleaker.', useImage: true },
  { author: 'frank_margins',   bookName: 'Oryx and Crake',             bookAuthor: 'Margaret Atwood',      genre: 'Dystopian fiction',   score: 4, text: "Atwood's bio-thriller doing double duty as ecological warning. Jimmy is one of the saddest narrators I've read.", useImage: false },
  { author: 'alice_reads',     bookName: 'Station Eleven',             bookAuthor: 'Emily St. John Mandel', genre: 'Literary fiction',   score: 5, text: 'Post-pandemic, pre-pandemic, during-pandemic — it just keeps hitting. The Traveling Symphony is pure tenderness.', useImage: false },
  { author: 'bob_bookworm',    bookName: 'Piranesi',                   bookAuthor: 'Susanna Clarke',       genre: 'Literary fantasy',    score: 5, text: 'Read it in one sitting under a blanket. I want to live in the House (just not during high tide).', useImage: false },
  { author: 'carol_shelves',   bookName: 'Bluets',                     bookAuthor: 'Maggie Nelson',        genre: 'Essay',               score: 4, text: 'Fragments that feel like a slow blue evening. Good companion to Bachelard if you like that sort of thing.', useImage: false },
  { author: 'danny_pages',     bookName: 'The Road',                   bookAuthor: 'Cormac McCarthy',      genre: 'Dystopian fiction',   score: 5, text: 'Punishing, beautiful, essential. The father/son dynamic ruined me.', useImage: true },
  { author: 'eve_highlighter', bookName: 'Klara and the Sun',          bookAuthor: 'Kazuo Ishiguro',       genre: 'Science fiction',     score: 4, text: "Quiet and devastating in the Ishiguro way. You'll keep thinking about Klara for days.", useImage: false },
  { author: 'frank_margins',   bookName: 'Never Let Me Go',            bookAuthor: 'Kazuo Ishiguro',       genre: 'Literary fiction',    score: 5, text: 'The restraint is the horror. Nothing I have read hurts like the third act of this one.', useImage: false },
  { author: 'grace_ink',       bookName: 'The Secret History',         bookAuthor: 'Donna Tartt',          genre: 'Literary thriller',   score: 4, text: "Vermont in the autumn, dead languages, a bad decision. Let myself love the pretentiousness — it's the point.", useImage: false },
  { author: 'henry_chapters',  bookName: 'Project Hail Mary',          bookAuthor: 'Andy Weir',            genre: 'Science fiction',     score: 5, text: 'Science plus friendship. Weir doing what Weir does best; I grinned through the second half.', useImage: true },
  { author: 'iris_folio',      bookName: 'Born to Run',                bookAuthor: 'Christopher McDougall', genre: 'Non-fiction',        score: 4, text: 'Made me want to buy minimalist shoes and regret it within a week. Still, the Tarahumara sections are incredible.', useImage: false },
  { author: 'jack_binding',    bookName: 'Dune',                       bookAuthor: 'Frank Herbert',        genre: 'Science fiction',     score: 5, text: 'Spice, worms, politics. Still the high-water mark of epic SF, and the film finally feels like a worthy companion.', useImage: false },
  { author: 'kate_spine',      bookName: 'A Gentleman in Moscow',      bookAuthor: 'Amor Towles',          genre: 'Historical fiction',  score: 5, text: "A hotel as a whole universe. Count Rostov is the kind of protagonist I'll miss like a friend.", useImage: false },
  { author: 'leo_verse',       bookName: 'Exhalation',                 bookAuthor: 'Ted Chiang',           genre: 'Science fiction',     score: 5, text: "Short stories that think harder than most novels. 'The Merchant and the Alchemist's Gate' broke me.", useImage: false },
  { author: 'maya_prose',      bookName: 'The Overstory',              bookAuthor: 'Richard Powers',       genre: 'Literary fiction',    score: 4, text: 'Overwritten in places, but when it lands it lands hard. I look at trees differently now.', useImage: false },
  { author: 'alice_reads',     bookName: 'Middlemarch',                bookAuthor: 'George Eliot',         genre: 'Classic fiction',     score: 5, text: 'Slow at first, then a quietly devastating study of provincial life. Dorothea deserved better.', useImage: false },
  { author: 'carol_shelves',   bookName: 'Bel Canto',                  bookAuthor: 'Ann Patchett',         genre: 'Literary fiction',    score: 4, text: 'Music, hostages, languages. Patchett manages tenderness in a setting that should have been miserable.', useImage: false },
  { author: 'danny_pages',     bookName: 'Six of Crows',               bookAuthor: 'Leigh Bardugo',        genre: 'Young adult fantasy', score: 5, text: 'Heist book with a bench deep enough for any of them to carry a novel. Inej forever.', useImage: false },
  { author: 'iris_folio',      bookName: 'The Song of Achilles',       bookAuthor: 'Madeline Miller',      genre: 'Historical fantasy',  score: 5, text: 'You know the ending and it still wrecks you. Miller makes the Iliad feel like a love letter.', useImage: false },
];

const COMMENTS: CommentSpec[] = [
  { postIndex: 0, author: 'bob_bookworm', text: 'Same edition with the Peacock cover? The footnotes in mine are hilarious.' },
  { postIndex: 0, author: 'carol_shelves', text: 'Adding this to my spring list — thanks for the nudge!' },
  { postIndex: 1, author: 'alice_reads', text: 'Mr. Bennet is peak dad energy and I will not be debating this.' },
  { postIndex: 2, author: 'grace_ink', text: 'Autumn Austen is a whole mood. Maybe even a book club theme.' },
  { postIndex: 3, author: 'alice_reads', text: 'Try the Alan Lee illustrated version if you can — the maps are gorgeous.' },
  { postIndex: 3, author: 'carol_shelves', text: 'Weekend goal: finally start Fellowship after this.' },
  { postIndex: 4, author: 'leo_verse', text: 'The fridge-map is exactly the right reaction to Smaug.' },
  { postIndex: 5, author: 'henry_chapters', text: 'Rivendell as emotional baseline — same.' },
  { postIndex: 6, author: 'jack_binding', text: 'Ents deserve their own spin-off. Slowly paced of course.' },
  { postIndex: 7, author: 'alice_reads', text: 'Read it last year — the ending still sits with me. Worth a re-read.' },
  { postIndex: 8, author: 'eve_highlighter', text: "Agreed on the thriller pacing. Couldn't sleep after the last chapter." },
  { postIndex: 9, author: 'danny_pages', text: 'The quiet moments in Earthsea are doing more than most epics.' },
  { postIndex: 10, author: 'leo_verse', text: 'The Hainish books have aged remarkably well.' },
  { postIndex: 11, author: 'frank_margins', text: 'Margaret is still the sharpest in the room.' },
  { postIndex: 12, author: 'kate_spine', text: "Jimmy as the saddest narrator — I'd put him alongside Stevens in The Remains of the Day." },
  { postIndex: 13, author: 'maya_prose', text: 'The Traveling Symphony makes me want to take up an instrument again.' },
  { postIndex: 14, author: 'grace_ink', text: 'The House, the tides, the Faun — such a gentle strange book.' },
  { postIndex: 16, author: 'iris_folio', text: 'McCarthy punctuation debate is tired but he earns every choice.' },
  { postIndex: 18, author: 'eve_highlighter', text: 'Ishiguro makes the smallest sentences carry an ocean.' },
  { postIndex: 20, author: 'henry_chapters', text: 'Weir + friendship + science = always a good time.' },
  { postIndex: 24, author: 'kate_spine', text: "Exhalation's premise alone earns the price of the book." },
  { postIndex: 25, author: 'leo_verse', text: 'The tree chapters took me a while but I came around.' },
  { postIndex: 27, author: 'carol_shelves', text: 'Bel Canto is quietly one of my favorites to reread.' },
  { postIndex: 29, author: 'maya_prose', text: 'Patroclus narration was a revelation.' },
];

function listUploads(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .sort();
}

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
    const existingDemo = await User.countDocuments({ email: DEMO_EMAIL });
    if (existingDemo > 0) {
      console.log(
        `Skip: database already has ${existingDemo} demo user(s). Use --force to replace demo data only.`
      );
      await mongoose.disconnect();
      return;
    }
  }

  const profileImages = listUploads(PROFILE_DIR);
  const postImages = listUploads(POSTS_DIR);
  console.log(`Profile images available: ${profileImages.length}`);
  console.log(`Post cover images available: ${postImages.length}`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const usersByUsername = new Map<string, mongoose.Types.ObjectId>();
  for (let i = 0; i < USERS.length; i++) {
    const spec = USERS[i];
    const profileImage =
      profileImages.length > 0
        ? `/uploads/profiles/${profileImages[i % profileImages.length]}`
        : '';
    const doc = await User.create({
      username: spec.username,
      email: spec.email,
      password: passwordHash,
      profileImage,
    });
    usersByUsername.set(spec.username, doc._id as mongoose.Types.ObjectId);
  }
  console.log(`Users created: ${USERS.length}`);

  const createdPosts: mongoose.Types.ObjectId[] = [];
  let postImageCursor = 0;
  for (const spec of POSTS) {
    const authorId = usersByUsername.get(spec.author);
    if (!authorId) throw new Error(`Unknown demo author: ${spec.author}`);

    const image =
      spec.useImage && postImages.length > 0
        ? `/uploads/posts/${postImages[postImageCursor++ % postImages.length]}`
        : undefined;

    const post = await Post.create({
      userId: authorId,
      bookName: spec.bookName,
      bookAuthor: spec.bookAuthor,
      genre: spec.genre,
      score: spec.score,
      text: spec.text,
      image,
      likes: [],
      likesCount: 0,
      commentsCount: 0,
    });
    createdPosts.push(post._id as mongoose.Types.ObjectId);
  }
  console.log(`Posts created: ${POSTS.length}`);

  // Likes: every post gets 2–6 likes from other users (never the author).
  // Deterministic so the seed is reproducible.
  const allUserIds = Array.from(usersByUsername.values());
  for (let i = 0; i < createdPosts.length; i++) {
    const postId = createdPosts[i];
    const authorId = usersByUsername.get(POSTS[i].author)!;
    const candidates = allUserIds.filter((id) => !id.equals(authorId));
    const likeCount = 2 + (i % 5);
    const shuffled = [...candidates].sort((a, b) => {
      const keyA = a.toString() + String(i);
      const keyB = b.toString() + String(i);
      return keyA.localeCompare(keyB);
    });
    const likes = shuffled.slice(0, likeCount);
    await Post.findByIdAndUpdate(postId, { likes, likesCount: likes.length });
  }
  console.log('Likes assigned.');

  const commentCountByPost = new Map<string, number>();
  for (const c of COMMENTS) {
    const postId = createdPosts[c.postIndex];
    const userId = usersByUsername.get(c.author);
    if (!postId || !userId) continue;
    await Comment.create({ postId, userId, text: c.text });
    const key = postId.toString();
    commentCountByPost.set(key, (commentCountByPost.get(key) ?? 0) + 1);
  }
  for (const [postIdStr, count] of commentCountByPost) {
    await Post.findByIdAndUpdate(postIdStr, { commentsCount: count });
  }
  console.log(`Comments created: ${COMMENTS.length}`);

  console.log('');
  console.log('Demo data created:');
  console.log(`  Users:    ${USERS.length} (scope: ${DEMO_EMAIL_DOMAIN})`);
  console.log(`  Posts:    ${POSTS.length}`);
  console.log(`  Comments: ${COMMENTS.length}`);
  console.log(`  Password: ${DEMO_PASSWORD} (for every demo user)`);
  console.log('');
  console.log('Log in with any demo email, e.g.:');
  console.log(`  email:    alice${DEMO_EMAIL_DOMAIN}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
