import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { SearchResultsPage } from './pages/SearchResultsPage';

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<div style={{ padding: '1rem' }}>BookClub</div>} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/profile/:id" element={<div style={{ padding: '1rem' }}>Profile (TODO)</div>} />
        <Route
          path="/posts/:id/comments"
          element={<div style={{ padding: '1rem' }}>Comments (TODO)</div>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
