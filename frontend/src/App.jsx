import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import SummaryPage from './pages/SummaryPage';
import SimulatePage from './pages/SimulatePage';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip" element={<TripPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/simulate" element={<SimulatePage />} />
      </Routes>
    </>
  );
}
