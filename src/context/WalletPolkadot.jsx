import React, {
  createContext, useContext, useState, useMemo,
} from 'react';
import PropTypes from 'prop-types'; // Import PropTypes

const Context = createContext(null);

// Define a default value for useWalletPolkadot
const initialState = {
  wallet: null,
  setWallet: () => {},
  adapters: null,
  setAdapters: () => {},
};

function useWalletPolkadot() {
  return useContext(Context) || initialState;
}

function WalletPolkadotContextProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [adapters, setAdapters] = useState([]);

  /**
     * The purpose of this wrapper is to add checks in this file before setting the wallet?.
     * @param {object} newValue wallet object
     */
  const updateWallet = (newValue) => {
    setWallet(newValue);
  };

  const updateAdapters = (newValue) => {
    setAdapters(newValue);
  };

  // Use useMemo to not recreate the value on every render to prevent performance issues.
  const memoizedContextValue = useMemo(() => ({
    wallet, setWallet: updateWallet, adapters, setAdapters: updateAdapters,
  }), [wallet, setWallet, adapters, setAdapters]);

  return (
    <Context.Provider value={memoizedContextValue}>
      {children}
    </Context.Provider>
  );
}

WalletPolkadotContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { WalletPolkadotContextProvider, useWalletPolkadot };
