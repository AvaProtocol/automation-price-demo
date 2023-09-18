import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ArthSwapApp from './ArthSwap';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ArthSwapApp />} />
    </Routes>
  );
}

export default App;
