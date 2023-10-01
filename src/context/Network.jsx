// MyContext.js
import React, {
  createContext, useContext, useState, useMemo,
} from 'react';
import PropTypes from 'prop-types';

import { chains, assets } from '@oak-network/config'; // Import PropTypes

const Context = createContext(null);

const {
  turingLocal, shibuya, turing, rocstar,
} = chains;

const networks = [{
  key: 'dev',
  name: 'Development',
  oakChain: turingLocal,
  parachain: shibuya,
}, {
  key: 'rococo',
  name: 'Rococo',
  oakChain: turing,
  parachain: rocstar,
}];

// Define a default value for useNetwork
const initialState = {
  network: networks[0],
  setNetwork: () => {},
  networks,
};

function useNetwork() {
  return useContext(Context) || initialState;
}

function NetworkContextProvider({ children }) {
  const [network, setNetwork] = useState(networks[0]);

  const updateNetwork = (newValue) => {
    console.log('updateNetwork: ', newValue);
    setNetwork(newValue);
  };

  // Use useMemo to not recreate the value on every render to prevent performance issues.
  const memoizedContextValue = useMemo(() => ({
    network, setNetwork: updateNetwork, networks,
  }), [network, updateNetwork, networks]);

  return (
    <Context.Provider value={memoizedContextValue}>
      {children}
    </Context.Provider>
  );
}

NetworkContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { NetworkContextProvider, useNetwork };
