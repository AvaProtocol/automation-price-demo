import React, { useCallback, useEffect } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Butto as AntButton, Space, message,
} from 'antd';
import SignButton from './SignButton';

import { useWalletPolkadot } from '../context/WalletPolkadot';
import { MOMENT_FORMAT } from '../config';
import { sendExtrinsic } from '../common/utils';

function PriceControl({ priceArray, setPriceArray }) {
  const {
    wallet, apis,
  } = useWalletPolkadot();

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Initializing PriceControl component.');
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

    const api = apis[0];
    console.log('api', api);
    const extrinsic = api.tx.automationPrice.initializeAsset('shibuya', 'arthswap', 'WRSTR', 'USDT', '18', [wallet?.address]);

    console.log('wallet?.signer', wallet?.signer);
    console.log('extrinsic.method.toHex()', extrinsic.method.toHex());
    return sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
  }, [apis, wallet]);

  const onClickUpdatePrice = useCallback(async () => {
    console.log('onClickUpdatePrice is called');
    const api = apis[0];
    const price = 90;
    const submittedAt = moment().unix();

    const extrinsic = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [price], [submittedAt], [0]);

    console.log('extrinsic', extrinsic.toHuman());

    await sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
  }, [apis, wallet]);

  const onClickFetchPrice = useCallback(async () => {
    console.log('onClickFetchPrice is called');

    // entries can be used to query all the entries when we want to iterate over all the pair
    // in this case, we already know the SYMBOL so we can look at this key directly use the full tuple
    // when using entries we received back an array of key/value pair which we can iterate over to parse
    // both of key and its value
    // Read more at:
    //   https://polkadot.js.org/docs/api/start/api.query/
    //   https://polkadot.js.org/docs/api/cookbook/storage#how-do-i-use-entrieskeys-on-double-maps
    // const results = await apis[0].query.automationPrice.priceRegistry.entries('shibuya', 'arthswap');

    const symbols = ['WRSTR', 'USDT'];
    const result = await apis[0].query.automationPrice.priceRegistry('shibuya', 'arthswap', ['WRSTR', 'USDT']);
    console.log('amount: ', result.unwrap().amount.toHuman());

    if (result.isNone) {
      message.error('PriceRegistry is empty; Please initialize the asset first.');
      return;
    }

    console.log('result', result.toHuman());

    const retrievedTimestamp = moment();
    const { amount } = result.unwrap();

    const priceItem = {
      timestamp: retrievedTimestamp,
      symbols,
      price: amount,
    };
    console.log('timestamp', retrievedTimestamp.format(MOMENT_FORMAT), 'symbols', symbols, 'amount', amount);

    console.log('priceArray: ', priceArray);
    const newPriceArray = [...priceArray];

    newPriceArray.push(priceItem);
    console.log(newPriceArray);
    setPriceArray(newPriceArray);
  }, [apis, priceArray]);

  return (
    <Space size="middle">
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickInitAsset} wallet={wallet}>Initialize Asset</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickUpdatePrice} wallet={wallet}>Update Price</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickFetchPrice} wallet={wallet}>Fetch Price</SignButton>
    </Space>
  );
}

PriceControl.propTypes = {
  priceArray: PropTypes.arrayOf(PropTypes.shape).isRequired,
  setPriceArray: PropTypes.func.isRequired,
};

export default PriceControl;
