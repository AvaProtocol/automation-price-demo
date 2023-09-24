import React, { useState, useCallback, useEffect } from 'react';
import _ from 'lodash';
import {
  Button, Space, Modal, message, Radio,
} from 'antd';
import { useWalletEthereum } from '../context/WalletEthereum';
import { network } from '../config';

const ethers = require('ethers'); // eslint-disable-line import/no-extraneous-dependencies

function handleChainChanged(newChainId) {
  console.log('newChainId', newChainId);
  // We recommend reloading the page, unless you must do otherwise.
  window.location.reload();
}

window.ethereum.on('chainChanged', handleChainChanged);

function WalletConnectMetamask() {
  const {
    wallet, setWallet, setProvider, provider,
  } = useWalletEthereum();

  const [isModalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [radioValue, setRadioValue] = useState(1);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        let providerOnLoad = null;
        if (_.isNull(window.ethereum)) {
          // If MetaMask is not installed, we use the default provider,
          // which is backed by a variety of third-party services (such as INFURA).
          // They do not have private keys installed so are only have read-only access
          console.log('MetaMask is not installed; using read-only default providers');
          providerOnLoad = ethers.getDefaultProvider();
        } else {
          // Connect to the MetaMask EIP-1193 object. This is a standard protocol
          // that allows Ethers access to make all read-only requests through MetaMask.
          providerOnLoad = new ethers.BrowserProvider(window.ethereum);
          // console.log('MetaMask is installed and loaded.');
        }

        setProvider(providerOnLoad);

        const chainId = await providerOnLoad.send('eth_chainId', []);
        const chainIdDecimal = parseInt(chainId, 16);
        console.log(`network chainId: ${chainIdDecimal} (${chainIdDecimal === network.chainId ? 'Rocstar' : 'Unknown'})`);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    // You can perform any cleanup or additional actions here if needed
    // For example, removing event listeners or making API requests
    // Be sure to return a cleanup function if necessary
    return () => {
      // Cleanup code here (if needed)
    };
  }, []);

  /**
   * Modal Swap functions
   */
  const onClickDisconnectWallet = useCallback(async () => {
    console.log('onClickDisconnectWallet call back is called.');

    setAccounts([]);
    setWallet(null);
  }, []);

  /**
   * Modal Wallet Connect functions
   */
  const onClickConnectWallet = useCallback(async () => {
    console.log('onClickConnectWallet is called, provider: ', provider);

    try {
      // Request permission to connect users accounts from Metamask
      const requestedAccounts = await provider.send('eth_requestAccounts', []);
      console.log('requestedAccounts', requestedAccounts);
      setAccounts(requestedAccounts);

      // Set the first wallet as selected by default
      if (!_.isEmpty(requestedAccounts)) {
        setRadioValue(requestedAccounts[0]);
      }

      setModalOpen(true);
    } catch (ex) {
      console.log('ex', ex?.error);
      message.error(ex?.error?.message);
    }
  });

  const onRadioChange = (e) => {
    setRadioValue(e.target.value);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const onClickWalletSelectSubmitted = useCallback(async () => {
    console.log('Setting radioValue as selected account', radioValue);

    setModalLoading(true);

    console.log('Found selected radio from provider', radioValue);

    const signer = await provider.getSigner(radioValue);
    console.log('signer: ', signer);

    const signerAddress = await signer.getAddress();

    console.log('signer.address: ', signerAddress);

    const balance = await provider.getBalance(signer.address);
    const formattedBalance = ethers.formatEther(balance);

    const nonce = await provider.getTransactionCount(signer.address);

    // TODO: reset modal status
    setModalLoading(false);
    setModalOpen(false);

    setWallet({
      signer, address: signerAddress, balance: formattedBalance, nonce,
    });
  }, [radioValue, provider]);

  return (
    <>
      { _.isNil(wallet)
        ? (<Button onClick={onClickConnectWallet}>Connect Metamask</Button>)
        : (
          <div><div>Wallet:</div><div>{wallet?.address}</div>
            <div>Balance:</div><div>{wallet?.balance} {network.symbol}</div>
            <div>Nonce:</div><div>{wallet?.nonce}</div>
            <Button onClick={onClickConnectWallet}>Switch Wallet</Button>
            <Button onClick={onClickDisconnectWallet}>Disconnect Metamask</Button>
          </div>
        )}
      <Modal
        open={isModalOpen}
        title="Connect Wallet"
        onOk={onClickWalletSelectSubmitted}
        onCancel={closeModal}
        maskClosable={false}
        footer={[
          <Button key="back" onClick={closeModal}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={isModalLoading} onClick={onClickWalletSelectSubmitted}>
            Confirm
          </Button>,
        ]}
      >
        <Radio.Group onChange={onRadioChange} value={radioValue}>
          <Space direction="vertical">
            {_.map(accounts, (item, index) => (<Radio value={item} key={`${item}-${index}`}>{item}</Radio>))}
          </Space>
        </Radio.Group>
      </Modal>
    </>
  );
}

export default WalletConnectMetamask;
