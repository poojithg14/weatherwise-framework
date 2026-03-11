import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import SummaryPage from './pages/SummaryPage';
import SimulatePage from './pages/SimulatePage';
import ResearchPage from './pages/ResearchPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <ErrorBoundary>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip" element={<TripPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/simulate" element={<SimulatePage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
