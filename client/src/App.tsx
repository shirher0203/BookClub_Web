import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { FeedPage } from './pages/FeedPage';
import { CreatePostPage } from './pages/CreatePostPage';
import { EditPostPage } from './pages/EditPostPage';
import { CommentsPage } from './pages/CommentsPage';
import { LoginPage } from './pages/LoginPage';
import './App.css';

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="appMain">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route
            path="/posts/new"
            element={
              <ProtectedRoute>
                <CreatePostPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:id/edit"
            element={
              <ProtectedRoute>
                <EditPostPage />
              </ProtectedRoute>
            }
          />
          <Route path="/posts/:id/comments" element={<CommentsPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route
            path="/profile/:id"
            element={<div className="placeholder">Profile (coming soon)</div>}
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
