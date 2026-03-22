import { useNavigate } from 'react-router-dom';
import { api } from '../api/axios';
import { PostForm, type PostFormValues } from '../components/PostForm';
import styles from './CreatePostPage.module.css';

export function CreatePostPage(): JSX.Element {
  const navigate = useNavigate();

  async function handleSubmit(values: PostFormValues): Promise<void> {
    const fd = new FormData();
    fd.append('bookName', values.bookName.trim());
    if (values.bookAuthor.trim()) fd.append('bookAuthor', values.bookAuthor.trim());
    if (values.genre.trim()) fd.append('genre', values.genre.trim());
    if (values.score !== '') fd.append('score', String(values.score));
    fd.append('text', values.text.trim());
    if (values.image) fd.append('image', values.image);

    await api.post('/posts', fd);
    navigate('/feed', { replace: true });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Share a book</h1>
      <PostForm submitLabel="Publish review" onSubmit={handleSubmit} />
    </div>
  );
}
