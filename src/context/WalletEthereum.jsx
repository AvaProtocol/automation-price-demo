// MyContext.js
import React, {
  createContext, useContext, useState, useMemo, useEffect,
} from 'react';
import PropTypes from 'prop-types'; // Import PropTypes

const Context = createContext(null);

// Define a default value for useWalletEthereum
const initialState = {
  wallet: null,
  setWallet: () => {},
  provider: null,
  setProvider: () => {},
};

function useWalletEthereum() {
  return useContext(Context) || initialState;
}

function WalletEthereumContextProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [provider, setProvider] = useState(null);

  /**
   * The purpose of this wrapper is to add checks in this file before setting the wallet?.
   * @param {object} newValue wallet object
   */
  const updateWallet = (newValue) => {
    setWallet(newValue);
  };

  const updateProvider = (newValue) => {
    setProvider(newValue);
  };

  // Use useMemo to not recreate the value on every render to prevent performance issues.
  const memoizedContextValue = useMemo(() => ({
    wallet, setWallet: updateWallet, provider, setProvider: updateProvider,
  }), [wallet, setWallet, provider, updateProvider]);

  return (
    <Context.Provider value={memoizedContextValue}>
      {children}
    </Context.Provider>
  );
}

WalletEthereumContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { WalletEthereumContextProvider, useWalletEthereum };
