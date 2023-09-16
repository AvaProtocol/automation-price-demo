import { Routes, Route } from 'react-router-dom';
import Swap from './Swap';
import Tvl from './Tvl';
import ArthSwapApp from './ArthSwap';

function App() {
  return (
    <Routes>
      <Route path="/swap" element={<Swap />} />
      <Route path="/tvl" element={<Tvl />} />
      <Route path="/arthswap" element={<ArthSwapApp />} />
    </Routes>
  );
}

export default App;
