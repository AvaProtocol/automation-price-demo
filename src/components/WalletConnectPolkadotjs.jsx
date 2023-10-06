import React, { useState, useCallback, useEffect } from 'react';
import _ from 'lodash';
import BN from 'bn.js';
import {
  Button, Space, Modal, Radio, Row, Col,
} from 'antd';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import { useNetwork } from '../context/Network';
import TuringAdapter from '../common/turingAdapter';
import shibuyaAdapter from '../common/shibuyaAdapter';

const STORAGE_KEY_WALLET = 'polkadotjsSigner';

const formatToken = (amount, decimals) => {
  const decimalBN = new BN(10).pow(new BN(decimals));
  return { integer: amount.div(decimalBN), decimal: amount.mod(decimalBN) };
};

const formatTokenBalanceString = (amount, decimals) => {
  let amountBN = amount;

  if (_.isUndefined(amount)) {
    return '';
  }

  if (_.isString(amount)) {
    amountBN = new BN(_.startsWith(amount, '0x') ? _.trimStart(amount, '0x') : amount, 'hex');
  }

  const { integer, decimal } = formatToken(amountBN, decimals);
  return `${integer.toString()}.${decimal.toString().slice(0, 4)}`;
};

function WalletConnectPolkadotjs() {
  const {
    wallet, setWallet, adapters, setAdapters,
  } = useWalletPolkadot();

  const { network } = useNetwork();

  const [isModalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [radioValue, setRadioValue] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const getSignerFromAddress = async (address) => {
    const injector = await web3FromAddress(address);
    const { signer } = injector;

    return signer;
  };

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Initialize and set up Turing and parachain APIs');
        const parachainApi = await shibuyaAdapter.initialize(network.parachain);
        const turingAdapter = TuringAdapter.getInstance(network.oakChain);
        const turingApi = await turingAdapter.initialize();

        setAdapters([turingAdapter, shibuyaAdapter]);

        await web3Enable('App Name');

        const storedWalletStr = localStorage.getItem(STORAGE_KEY_WALLET);
        const storedWallet = JSON.parse(storedWalletStr);

        if (!_.isNil(storedWallet) && storedWallet !== wallet) {
          const { address, balance, nonce } = storedWallet;

          setWallet({
            signer: await getSignerFromAddress(address), address, balance, nonce,
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    return () => {
      // Cleanup code here (if needed)
    };
  }, []); // The empty dependency array [] ensures that this effect runs only once, similar to componentDidMount

  const onRadioChange = (e) => {
    setRadioValue(e.target.value);
  };

  const onClickConnect = async () => {
    const allAccounts = await web3Accounts({ accountType: 'sr25519', ss58Format: 51 });

    setAccounts(allAccounts);

    // Set the default wallet to the first account in the list
    if (_.isNull(radioValue) && !_.isEmpty(allAccounts)) {
      setRadioValue(allAccounts[0]?.address);
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const onClickDisconnect = useCallback(async () => {
    setAccounts([]);
    setWallet(null);
  }, []);

  const onClickPolkadotkWalletSelectSubmitted = useCallback(async () => {
    const address = radioValue;

    setModalLoading(true);

    const parachainApi = adapters[1]?.api;
    const { nonce, data: { free: balance } } = await parachainApi.query.system.account(address);

    setModalLoading(false);
    setModalOpen(false);

    const newWallet = {
      signer: await getSignerFromAddress(address), address, balance, nonce,
    };

    // Store the wallet in local storage and set the state
    localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify(newWallet));
    setWallet(newWallet);
  }, [adapters, radioValue]);

  return (
    <>
      { _.isNil(wallet)
        ? (<Button type="primary" onClick={onClickConnect}>Connect Polkadot.js</Button>)
        : (
          <>
            <Row>
              <Space>
                <div>Wallet: {wallet.address}</div>
                <div>Balance: { formatTokenBalanceString(wallet.balance, network?.parachain?.defaultAsset?.decimals) } {network?.parachain?.defaultAsset?.symbol}</div>
              </Space>
            </Row>
            <Row>
              <Space>
                <Button onClick={onClickConnect}>Switch Wallet</Button>
                <Button onClick={onClickDisconnect}>Disconnect</Button>
              </Space>
            </Row>
          </>
        )}
      <Modal
        open={isModalOpen}
        title="Connect Polkadot.js Wallet"
        onOk={onClickPolkadotkWalletSelectSubmitted}
        onCancel={closeModal}
        maskClosable={false}
        footer={[
          <Button key="back" onClick={closeModal}>Cancel</Button>,
          <Button key="submit" type="primary" loading={isModalLoading} onClick={onClickPolkadotkWalletSelectSubmitted}>Confirm</Button>,
        ]}
      >
        <Radio.Group onChange={onRadioChange} value={radioValue}>
          <Space direction="vertical">
            { /** Limit the amount of accounts to avoid cluttering the UI */
             _.map(_.slice(accounts, 0, 10), (item, index) => {
               const title = `${item.meta.name} ${item.address}`;
               return <Radio value={item.address} key={`${index}-${item.address}`}>{title}</Radio>;
             })
}
          </Space>
        </Radio.Group>
      </Modal>
    </>
  );
}

export default WalletConnectPolkadotjs;
