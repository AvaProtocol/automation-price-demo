import React, { useState, useCallback, useEffect } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes

import {
  Button, Space, Modal, message, Radio,
} from 'antd';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import { network, MOMENT_FORMAT } from '../config';
import { sendExtrinsic } from '../common/utils';

function PriceControl({ priceArray, setPriceArray }) {
  const {
    wallet, apis,
  } = useWalletPolkadot();

  const [isModalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [radioValue, setRadioValue] = useState(1);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Page compoents are mounted.');
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

  const onClickInitAsset = useCallback(async () => {
    console.log('onClickInitAsset is called');

    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
    }

    const api = apis[0];
    console.log('api', api);
    const extrinsic = api.tx.automationPrice.initializeAsset('shibuya', 'arthswap', 'WRSTR', 'USDT', '18', [wallet?.address]);

    console.log('wallet?.signer', wallet?.signer);
    console.log('extrinsic.method.toHex()', extrinsic.method.toHex());
    await sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
  }, [apis, wallet]);

  const onClickUpdatePrice = useCallback(async () => {
    console.log('onClickUpdatePrice is called');
    const api = apis[0];
    const price = 80;
    const submittedAt = moment().unix();

    const extrinsic = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [price], [submittedAt], [0]);

    console.log('extrinsic', extrinsic.toHuman());

    await sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
  }, [apis, wallet]);

  const onClickFetchPrice = useCallback(async () => {
    console.log('onClickFetchPrice is called');

    const results = await apis[0].query.automationPrice.priceRegistry.entries('shibuya', 'arthswap');
    console.log('results: ', results);

    console.log('results[0][0].toHuman()', results[0][0].toHuman());

    if (_.isEmpty(results)) {
      message.error('PriceRegistry is empty; Please initialize the asset first.');
    }

    console.log('results[0][0].toHuman()', results[0][0].toHuman());
    console.log('results[0][1].toHuman()', results[0][1].toHuman());

    const symbols = results[0][0].toHuman()[2];
    const data = results[0][1].toHuman();
    const retrievedTimestamp = moment();
    const { amount } = data;

    const priceItem = {
      timestamp: retrievedTimestamp,
      symbols,
      price: amount,
    };
    console.log('timestamp', retrievedTimestamp.format(MOMENT_FORMAT), 'symbols', symbols, 'amount', amount);

    const newPriceArray = _.cloneDeep(priceArray);

    newPriceArray.push(priceItem);
    console.log(newPriceArray);
    setPriceArray(newPriceArray);
  }, [apis, priceArray]);

  return (
    <Space size="middle">
      <Button onClick={onClickInitAsset}>Initialize Asset</Button>
      <Button onClick={onClickUpdatePrice}>Update Price</Button>
      <Button onClick={onClickFetchPrice}>Fetch Price</Button>
    </Space>
  );
}

PriceControl.propTypes = {
  priceArray: PropTypes.arrayOf(PropTypes.shape).isRequired,
  setPriceArray: PropTypes.func.isRequired,
};

export default PriceControl;
