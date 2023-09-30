import React, { useState, useCallback, useEffect } from 'react';
import _, { chain } from 'lodash';
import BN from 'bn.js';
import {
  Button, Space, Modal, message, Radio, Row, Col,
} from 'antd';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { chains, assets } from '@oak-network/config';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import { network } from '../config';
import TuringAdapter from '../common/turingAdapter';
import shibuyaAdapter from '../common/shibuyaAdapter';

const { turingLocal } = chains;

console.log('turingLocal ', turingLocal);

const formatToken = (amount, decimals) => {
  const decimalBN = new BN(10).pow(new BN(decimals));
  return { integer: amount.div(decimalBN), decimal: amount.mod(decimalBN) };
};

const formatTokenBalanceString = (amount, decimals) => {
  console.log('formatTokenBalanceString: ', amount, decimals);

  if (_.isUndefined(amount)) {
    return '';
  }

  const { integer, decimal } = formatToken(amount, decimals);
  return `${integer.toString()}.${decimal.toString()}`;
};

function WalletConnectPolkadotjs() {
  const {
    wallet, setWallet, apis, setApis,
  } = useWalletPolkadot();

  const [isModalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [radioValue, setRadioValue] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Initialize and set up Turing and parachain APIs');
        // const parachainApi = await ApiPromise.create({ provider: new WsProvider(network.endpoint) });

        const parachainApi = await shibuyaAdapter.initialize();
        const turingAdapter = TuringAdapter.getInstance();
        const turingApi = await turingAdapter.initialize();

        setApis([turingApi, parachainApi]);

        // const result = await turingApi.query.automationPrice.priceRegistry.entries('shibuya', 'arthswap');
        // console.log('price: ', result[0][1].unwrap().amount.toString());

        // Subscribe to chain storage of Turing for price monitoring
        // let count = 0;
        // const unsubscribe = await turingApi.rpc.chain.subscribe((header) => {
        //   console.log(`Chain is at block: #${header.number}`);

        //   if (count++ === 256) {
        //     unsubscribe();
        //     process.exit(0);
        //   }
        // });
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
    await web3Enable('App Name');
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
    console.log('onClickDisconnectWallet call back is called.');

    setAccounts([]);
    setWallet(null);
  }, []);

  const onClickPolkadotkWalletSelectSubmitted = useCallback(async () => {
    const address = radioValue;

    setModalLoading(true);

    console.log('Found selected radio from provider', radioValue);

    const injector = await web3FromAddress(radioValue);
    const { signer } = injector;

    const parachainApi = apis[1];
    const { nonce, data: { free: balance } } = await parachainApi.query.system.account(address);

    setModalLoading(false);
    setModalOpen(false);

    setWallet({
      signer, address, balance, nonce,
    });
  }, [apis, radioValue]);

  return (
    <>
      { _.isNil(wallet)
        ? (<Button onClick={onClickConnect}>Connect Polkadot.js</Button>)
        : (
          <>
            <Row gutter={32}>
              <Col>Wallet: {wallet.address}</Col>
              <Col>Balance: { formatTokenBalanceString(wallet.balance, network.decimals) } {network.symbol}</Col>
            </Row>
            <Row>
              <Button onClick={onClickConnect}>Switch Wallet</Button>
              <Button onClick={onClickDisconnect}>Disconnect</Button>
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
            { _.map(accounts, (item, index) => {
              const title = `${item.meta.name} ${item.address}`;
              return <Radio value={item.address} key={`${index}-${item.address}`}>{title}</Radio>;
            })}
          </Space>
        </Radio.Group>
      </Modal>
    </>
  );
}

export default WalletConnectPolkadotjs;
