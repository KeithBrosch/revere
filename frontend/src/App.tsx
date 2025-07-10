import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Teams from './pages/Teams';
import About from './pages/About';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Home from './pages/Home';

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/about" element={<About />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 