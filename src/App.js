import { Routes, Route } from 'react-router-dom';
import Swap from './Swap';
import Tvl from './Tvl';

function App() {
  return (
    <Routes>
      <Route path="/swap" element={<Swap />} />
      <Route path="tvl" element={<Tvl />} />
    </Routes>
  );
}

export default App;
