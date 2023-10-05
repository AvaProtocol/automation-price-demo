import React, { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Button as AntButton, Space, message, Modal, InputNumber, Result,
} from 'antd';
import SignButton from './SignButton';

import { useWalletPolkadot } from '../context/WalletPolkadot';
import { MOMENT_FORMAT } from '../config';
import { sendExtrinsic } from '../common/utils';

const DEFAULT_INPUT_NUMBER = 80;

function PriceControl({
  priceArray, setPriceArray, currentPrice, setCurrentPrice, step,
}) {
  const {
    wallet, adapters,
  } = useWalletPolkadot();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inputNumber, setInputNumber] = useState(DEFAULT_INPUT_NUMBER);

  // useEffect(() => {
  //   // Initialize the wallet provider. This code will run once after the component has rendered for the first time
  //   async function asyncInit() {
  //   }

  //   asyncInit(); // Call the async function inside useEffect

  //   // You can perform any cleanup or additional actions here if needed
  //   // For example, removing event listeners or making API requests
  //   // Be sure to return a cleanup function if necessary
  //   return () => {
  //     // Cleanup code here (if needed)
  //   };
  // }, []);

  useEffect(() => {
    if (_.isEmpty(adapters) || _.isUndefined(adapters[0])) {
      return;
    }

    try {
      console.log('Subscribe to price updates since Turing adapter is set.', adapters[0]);
      const turingAdapter = adapters[0];

      turingAdapter?.subscribePrice((values) => {
        if (!_.isEmpty(values) && values[0]?.amount !== currentPrice) {
          console.log('Updating currentPrice to', values[0]?.amount, `since the old value ${currentPrice} is different ...`);
          const newPrice = _.toNumber(values[0]?.amount);
          setCurrentPrice(newPrice);

          const newPriceArray = priceArray || [];
          newPriceArray.push({
            timestamp: moment(),
            symbols: ['WRSTR', 'USDT'],
            price: newPrice,
          });

          setPriceArray(newPriceArray);
        }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [adapters, currentPrice, priceArray, setCurrentPrice, setPriceArray]);

  const handleCancel = () => {
    setIsModalOpen(false);
    setIsSuccess(false);
    setIsLoading(false);
  };

  const onClickInitAsset = useCallback(async () => {
    console.log('onClickInitAsset is called');

    const api = adapters[0]?.api;
    const extrinsicInitAsset = api.tx.automationPrice.initializeAsset('shibuya', 'arthswap', 'WRSTR', 'USDT', '18', [wallet?.address]);
    // sendExtrinsic(api, extrinsic, wallet?.address, wallet?.signer);
    const submittedAt = moment().unix();
    const extrinsicUpdatePrice = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [currentPrice], [submittedAt], [0]);

    const batchExtrinsics = [extrinsicInitAsset, extrinsicUpdatePrice];
    await api.tx.utility.batch(batchExtrinsics).signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer }, ({ events = [], status }) => {
      if (status.isInBlock) {
        console.log(`Transaction is in-block with hash ${status.asInBlock.toHex()}`);
      } else {
        console.log(`Transaction status: ${status.type}`);
      }

      events.forEach(({ phase, event: { data, method, section } }) => {
        console.log(`${phase.toString()} : ${section}.${method} ${data.toString()}`);
      });
    });
  }, [adapters, wallet, currentPrice]);

  const onClickDeleteAsset = useCallback(async () => {
    console.log('onClickDeleteAsset is called');

    const api = adapters[0]?.api;
    const extrinsic = api.tx.automationPrice.deleteAsset('shibuya', 'arthswap', 'WRSTR', 'USDT');

    await extrinsic.signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer }, ({ events = [], status }) => {
      if (status.isInBlock) {
        console.log(`Transaction is in-block with hash ${status.asInBlock.toHex()}`);
      } else {
        console.log(`Transaction status: ${status.type}`);
      }

      events.forEach(({ phase, event: { data, method, section } }) => {
        console.log(`${phase.toString()} : ${section}.${method} ${data.toString()}`);
      });
    });
  }, [adapters, wallet, currentPrice]);

  const updatePrice = async (value, api, { address, signer }) => {
    console.log('onClickUpdatePrice is called, value:', value);
    const submittedAt = moment().unix();
    const extrinsicUpdatePrice = api.tx.automationPrice.updateAssetPrices(['shibuya'], ['arthswap'], ['WRSTR'], ['USDT'], [value], [submittedAt], [0]);

    console.log('extrinsicUpdatePrice.method.toHex()', extrinsicUpdatePrice.method.toHex());

    return sendExtrinsic(api, extrinsicUpdatePrice, address, signer);
  };

  const onClickPriceUp = useCallback(async () => {
    setIsModalOpen(true);
  }, [adapters, currentPrice, step, wallet]);

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = async () => {
    setIsLoading(true);

    console.log('handleOk. setting price to inputNumber', inputNumber);
    const result = await updatePrice(inputNumber, adapters[0]?.api, wallet);

    console.log('update.result', result);
    setIsSuccess(true);
    setIsLoading(false);
  };

  const onChangeInputNumber = (value) => {
    console.log('onChangeInputNumber.value', value);
    setInputNumber(_.toNumber(value));
  };

  return (
    <Space size="middle">
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickInitAsset} wallet={wallet}>Initialize Asset</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickPriceUp} wallet={wallet}>Simulate Price Move</SignButton>
      <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickDeleteAsset} wallet={wallet}>Delete Asset</SignButton>
      <Modal
        title="Simulate Price Move"
        open={isModalOpen}
        okText="Confirm"
        onOk={handleOk}
        confirmLoading={isLoading}
        okButtonProps={{ disabled: isModalOpen && isSuccess }}
        cancelText="Close"
        onCancel={handleCancel}
      >
        <Space size="middle" direction="vertical">
          <div>Current price: {currentPrice || ''}</div>
          <div>Set a new value to the price of the pair</div>
          <InputNumber min={60} max={140} step={20} defaultValue={inputNumber} onChange={onChangeInputNumber} />
          {isSuccess && <Result iconFontSize={14} titleFontSize={14} status="success" title="The price update has been simulated on Turing." />}
        </Space>
      </Modal>
    </Space>
  );
}

PriceControl.propTypes = {
  priceArray: PropTypes.arrayOf(PropTypes.shape).isRequired,
  setPriceArray: PropTypes.func.isRequired,
  currentPrice: PropTypes.number,
  setCurrentPrice: PropTypes.func.isRequired,
  step: PropTypes.number.isRequired,
};

PriceControl.defaultProps = {
  currentPrice: null,
};

export default PriceControl;
