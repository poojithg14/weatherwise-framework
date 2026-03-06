import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import SummaryPage from './pages/SummaryPage';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip" element={<TripPage />} />
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </>
  );
}
