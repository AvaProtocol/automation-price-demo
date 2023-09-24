import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ArthSwapApp from './ArthSwap';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ArthSwapApp />} />
    </Routes>
  );
}

export default App;
