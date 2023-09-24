// MyContext.js
import React, {
  createContext, useContext, useState, useMemo,
} from 'react';
import PropTypes from 'prop-types'; // Import PropTypes

const Context = createContext(null);

// Define a default value for useWalletPolkadot
const initialState = {
  wallet: null,
  setWallet: () => {},
  apis: null,
  setApis: () => {},
};

function useWalletPolkadot() {
  return useContext(Context) || initialState;
}

function WalletPolkadotContextProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [apis, setApis] = useState([]);

  /**
     * The purpose of this wrapper is to add checks in this file before setting the wallet?.
     * @param {object} newValue wallet object
     */
  const updateWallet = (newValue) => {
    setWallet(newValue);
  };

  const updateApis = (newValue) => {
    setApis(newValue);
  };

  // Use useMemo to not recreate the value on every render to prevent performance issues.
  const memoizedContextValue = useMemo(() => ({
    wallet, setWallet: updateWallet, apis, setApis: updateApis,
  }), [wallet, setWallet, apis, setApis]);

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
