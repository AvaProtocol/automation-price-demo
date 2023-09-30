import React, { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Button as AntButton, Space, message,
} from 'antd';
import SignButton from './SignButton';

import { useWalletPolkadot } from '../context/WalletPolkadot';
import { MOMENT_FORMAT } from '../config';
import { sendExtrinsic } from '../common/utils';

function PriceControl({
  priceArray, setPriceArray, currentPrice, setCurrentPrice, step,
}) {
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
    const extrinsicInitAsset = api.tx.automationPrice.initializeAsset('shibuya', 'arthswap', 'WRSTR', 'USDT', '18', [wallet?.address]);
    console.log('extrinsicInitAsset.method.toHex()', extrinsicInitAsset.method.toHex());

    // TODO: batch set up price at 80
    // sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
    const submittedAt = moment().unix();
    const extrinsicUpdatePrice = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [currentPrice], [submittedAt], [0]);
    console.log('extrinsicUpdatePrice.method.toHex()', extrinsicUpdatePrice.method.toHex());

    const batchExtrinsics = [extrinsicInitAsset, extrinsicUpdatePrice];
    await api.tx.utility.batch(batchExtrinsics).signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer });
  }, [apis, wallet, currentPrice]);

  const updatePrice = async (value, api, { address, signer }) => {
    console.log('onClickUpdatePrice is called, value:', value);
    const submittedAt = moment().unix();
    const extrinsicUpdatePrice = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [value], [submittedAt], [0]);

    console.log('extrinsicUpdatePrice.method.toHex()', extrinsicUpdatePrice.method.toHex());

    await sendExtrinsic(api, extrinsicUpdatePrice, address, signer).then((result) => {
      console.log('setCurrentPrice(value)', value);

      setCurrentPrice(value);
    });
  };

  const onClickPriceUp = useCallback(async () => {
    console.log('onClickPriceUp is called, currentPrice', currentPrice);

    updatePrice(currentPrice + step, apis[0], wallet);
  }, [apis, wallet, currentPrice]);

  const onClickPriceDown = useCallback(async () => {
    console.log('onClickPriceUp is called, currentPrice', currentPrice);

    updatePrice(currentPrice - step, apis[0], wallet);
  }, [apis, wallet, currentPrice]);

  // const onClickFetchPrice = useCallback(async () => {
  //   console.log('onClickFetchPrice is called');

  //   const symbols = ['WRSTR', 'USDT'];
  //   const result = await apis[0].query.automationPrice.priceRegistry('shibuya', 'arthswap', ['WRSTR', 'USDT']);
  //   console.log('amount: ', result.unwrap().amount.toHuman());

  //   if (result.isNone) {
  //     message.error('PriceRegistry is empty; Please initialize the asset first.');
  //     return;
  //   }

  //   console.log('result', result.toHuman());

  //   const retrievedTimestamp = moment();
  //   const { amount } = result.unwrap();

  //   const priceItem = {
  //     timestamp: retrievedTimestamp,
  //     symbols,
  //     price: amount,
  //   };
  //   console.log('timestamp', retrievedTimestamp.format(MOMENT_FORMAT), 'symbols', symbols, 'amount', amount);

  //   console.log('priceArray: ', priceArray);
  //   const newPriceArray = [...priceArray];

  //   newPriceArray.push(priceItem);
  //   console.log(newPriceArray);
  //   setPriceArray(newPriceArray);
  // }, [apis, priceArray]);

  return (
    <Space size="middle">
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickInitAsset} wallet={wallet}>Initialize Asset</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickPriceUp} wallet={wallet}>Price Up</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickPriceDown} wallet={wallet}>Price Down</SignButton>
    </Space>
  );
}

PriceControl.propTypes = {
  priceArray: PropTypes.arrayOf(PropTypes.shape).isRequired,
  setPriceArray: PropTypes.func.isRequired,
  currentPrice: PropTypes.number.isRequired,
  setCurrentPrice: PropTypes.func.isRequired,
  step: PropTypes.number.isRequired,

};

export default PriceControl;
