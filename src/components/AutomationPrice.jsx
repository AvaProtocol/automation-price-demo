import React, { useCallback, useState } from 'react';
import _ from 'lodash';
import BN from 'bn.js';
import moment from 'moment';
import { u8aToHex } from '@polkadot/util';
import {
  Space, message, InputNumber, Result, Modal, Form, Row, Col, Input, Select, Button,
} from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
import Keyring from '@polkadot/keyring';
import { useNetwork } from '../context/Network';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import {
  sendExtrinsic, getDerivativeAccountV2, getDerivativeAccountV3, trimString, getEncodedCall,
} from '../common/utils';
import SignButton from './SignButton';

import { WEIGHT_REF_TIME_PER_SECOND } from '../config';

const DEFAULT_INPUT_NUMBER = 90;
const { Option } = Select;

function AutomationTimeComponent() {
  const { network } = useNetwork();

  const {
    wallet, adapters,
  } = useWalletPolkadot();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inputNumber, setInputNumber] = useState(DEFAULT_INPUT_NUMBER);

  /**
   * Use MetaMask to schedule a Swap transaction via XCM
   */
  async function scheduleByPrice(triggerFunction, triggerParam, cb) {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    try {
      const turingApi = adapters[0]?.api;
      const parachainApi = adapters[1]?.api;

      console.log('turingApi: ', turingApi);
      console.log('parachainApi: ', parachainApi);

      const parachainParaId = (await parachainApi.query.parachainInfo.parachainId()).toNumber();
      const parachainSs58Prifx = parachainApi.consts.system.ss58Prefix.toNumber();
      console.log('parachainParaId: ', parachainParaId, 'ss58', parachainSs58Prifx);

      const turingParaId = (await turingApi.query.parachainInfo.parachainId()).toNumber();

      const turingSs58Prifx = turingApi.consts.system.ss58Prefix.toNumber();
      console.log('turingParaId: ', turingParaId, 'ss58', turingSs58Prifx);
      const storageValue = await turingApi.query.assetRegistry.locationToAssetId({ parents: 1, interior: { X1: { Parachain: parachainParaId } } });
      const assetId = storageValue.unwrap();

      const keyring = new Keyring({ type: 'sr25519' });
      const aliceKeyringPair = keyring.addFromUri('//Alice', undefined, 'sr25519');
      aliceKeyringPair.meta.name = 'Alice';

      console.log('Transfer TUR from Alice to user account on Turing...');
      const minTuringBalance = new BN('1000000000000');
      const topUpAmounTur = minTuringBalance.mul(new BN(10));
      const { data: { free: turingBalance } } = await turingApi.query.system.account(wallet?.address);
      if (turingBalance.lt(minTuringBalance)) {
        const transferToAccountOnTuring = turingApi.tx.balances.transfer(wallet?.address, topUpAmounTur);
        await sendExtrinsic(turingApi, transferToAccountOnTuring, aliceKeyringPair, undefined);
      } else {
        console.log('TUR Balance is enough. Skip transfer.');
      }

      console.log('Transfer RSTR from Alice to user account on Parachain...');
      const minParachainBalance = new BN('100000000000000000000');
      const topUpAmountRstr = minParachainBalance.mul(new BN(10));
      const { data: { free: parachainBalance } } = await parachainApi.query.system.account(wallet?.address);
      if (parachainBalance.lt(minTuringBalance)) {
        const transferToAccountOnParachain = parachainApi.tx.balances.transfer(wallet?.address, topUpAmountRstr);
        await sendExtrinsic(parachainApi, transferToAccountOnParachain, aliceKeyringPair, undefined);
      } else {
        console.log('RSTR Balance is enough. Skip transfer.');
      }

      console.log('Add proxy on Turing for the execution of XCM from Parachain to Turing ...');
      const derivativeAccountOnTuring = getDerivativeAccountV2(turingApi, u8aToHex(keyring.decodeAddress(wallet?.address)), parachainParaId, { locationType: 'XcmV3MultiLocation', networkType: 'rococo' });
      const turingProxyType = 'Any';
      const turingProxies = (await turingApi.query.proxy.proxies(wallet?.address))[0];
      const turingProxyAddress = keyring.encodeAddress(derivativeAccountOnTuring, turingSs58Prifx);
      const matchedProxyOnTuring = _.find(turingProxies, ({ delegate, proxyType }) => delegate.toString() === turingProxyAddress && proxyType.toString() === turingProxyType);
      if (!matchedProxyOnTuring) {
        const proxyExtrinsicOnTuring = turingApi.tx.proxy.addProxy(derivativeAccountOnTuring, 'Any', 0);
        await sendExtrinsic(turingApi, proxyExtrinsicOnTuring, wallet?.address, wallet?.signer);
      } else {
        console.log('Proxy on Turing is already added. Skip adding proxy.');
      }

      const batchExtrinsics = [];

      console.log('Add proxy on Parachain for the execution of XCM from Turing to Parachain ...');
      const derivativeAccountOnParachain = getDerivativeAccountV3(u8aToHex(keyring.decodeAddress(wallet?.address)), turingParaId);
      const parachainProxyType = 'Any';
      const parachainProxies = (await parachainApi.query.proxy.proxies(wallet?.address))[0];
      const parachainProxyAddress = keyring.encodeAddress(derivativeAccountOnParachain, parachainSs58Prifx);
      const matchedProxyOnParachain = _.find(parachainProxies, ({ delegate, proxyType }) => delegate.toString() === parachainProxyAddress && proxyType.toString() === parachainProxyType);
      if (!matchedProxyOnParachain) {
        const proxyExtrinsicOnParachain = parachainApi.tx.proxy.addProxy(derivativeAccountOnParachain, 'Any', 0);
        batchExtrinsics.push(proxyExtrinsicOnParachain);
        console.log('Added extrinsic to batchExtrinsics: ', proxyExtrinsicOnParachain.method.toHex());
      } else {
        console.log('Proxy on Parachain is already added. Skip adding proxy.');
      }

      console.log('Checking if there’s enough RSTR in the proxy account of Parachain...');
      const minProxyBalanceOnParachain = new BN('10000000000000000000');
      const { data: { free: proxyBalanceOnParachain } } = await parachainApi.query.system.account(parachainProxyAddress);
      console.log('proxyBalanceOnParachain: ', proxyBalanceOnParachain.toString());
      if (proxyBalanceOnParachain.lt(minProxyBalanceOnParachain)) {
        console.log('Transfering RSTR to the proxy account of Parachain...');
        const transferToProxyOnParachain = parachainApi.tx.balances.transfer(derivativeAccountOnParachain, minProxyBalanceOnParachain);
        batchExtrinsics.push(transferToProxyOnParachain);
        console.log('Added extrinsic to batchExtrinsics, extrinsic: ', transferToProxyOnParachain.method.toHex());
      } else {
        console.log('RSTR Balance is enough. Skip transfer.');
      }

      console.log('Checking if there’s enough RSTR in the proxy account of Turing ...');
      const minProxyRstrBalanceOnTuring = new BN('10000000000000000000');
      const { free: proxyRstrBalanceOnTuring } = await turingApi.query.tokens.accounts(derivativeAccountOnTuring, assetId);
      if (proxyRstrBalanceOnTuring.lt(minProxyRstrBalanceOnTuring)) {
        console.log('Transfer RSTR to proxy account of Turing...');
        const transferToProxyOnTuring = parachainApi.tx.xtokens.transferMultiasset(
          {
            V3: {
              id: { Concrete: { parents: 0, interior: 'Here' } },
              fun: { Fungible: minProxyRstrBalanceOnTuring },
            },
          },
          {
            V3: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: turingParaId },
                  { AccountId32: { network: null, id: derivativeAccountOnTuring } },
                ],
              },
            },
          },
          'Unlimited',
        );
        batchExtrinsics.push(transferToProxyOnTuring);
        console.log('Added extrinsic to batchExtrinsics, extrinsic: ', transferToProxyOnTuring.method.toHex());
      } else {
        console.log('Balance is enough. Skip transfer.');
      }

      console.log('Send Xcm message to Turing to schedule price task...');
      const taskPayloadExtrinsic = parachainApi.tx.proxy.proxy(wallet?.address, 'Any', parachainApi.tx.ethereumChecked.transact({
        gasLimit: 201596,
        target: '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB',
        value: new BN('10000000000000000'),
        // eslint-disable-next-line max-len
        input: '0x7ff36ab5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000005446cff2194e84f79513acf6c8980d6e60747253000000000000000000000000000000000000000000000000018abef7846071c700000000000000000000000000000000000000000000000000000000000000020000000000000000000000007d5d845fd0f763cefc24a1cb1675669c3da62615000000000000000000000000e17d2c5c7761092f31c9eca49db426d5f2699bf0',
      }));

      const taskEncodedCallWeightRaw = (await taskPayloadExtrinsic.paymentInfo(wallet?.address)).weight;
      const taskEncodedCallWeight = { refTime: taskEncodedCallWeightRaw.refTime.unwrap(), proofSize: taskEncodedCallWeightRaw.proofSize.unwrap() };
      const instructionCountOnTuring = 4;
      const astarInstrcutionWeight = { refTime: new BN('1000000000'), proofSize: new BN(64 * 1024) };
      const taskOverallWeight = {
        refTime: taskEncodedCallWeight.refTime.add(astarInstrcutionWeight.refTime.muln(instructionCountOnTuring)),
        proofSize: taskEncodedCallWeight.proofSize.add(astarInstrcutionWeight.proofSize.muln(instructionCountOnTuring)),
      };
      const fee = await parachainApi.call.transactionPaymentApi.queryWeightToFee(taskOverallWeight);

      const scheduleFeeLocation = { parents: 1, interior: { X1: { Parachain: parachainParaId } } };

      const executionFee = { assetLocation: { V3: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } }, amount: fee };
      const rocstarLocation = { parents: 1, interior: { X1: { Parachain: parachainParaId } } };

      const automationPriceAsset = {
        chain: 'shibuya',
        exchange: 'arthswap',
        asset1: 'WRSTR',
        asset2: 'USDC',
      };

      const expiredAt = moment().add(7, 'days').unix();

      const taskExtrinsic = turingApi.tx.automationPrice.scheduleXcmpTaskThroughProxy(
        automationPriceAsset.chain,
        automationPriceAsset.exchange,
        automationPriceAsset.asset1,
        automationPriceAsset.asset2,
        expiredAt,
        triggerFunction,
        triggerParam,
        { V3: rocstarLocation },
        { V3: scheduleFeeLocation },
        executionFee,
        taskPayloadExtrinsic.method.toHex(),
        taskEncodedCallWeight,
        taskOverallWeight,
        wallet?.address,
      );

      console.log('Task extrinsic encoded call:', getEncodedCall(taskExtrinsic));
      const encodedCallWeightRaw = (await taskExtrinsic.paymentInfo(wallet?.address)).weight;
      const encodedCallWeight = { refTime: encodedCallWeightRaw.refTime.unwrap(), proofSize: encodedCallWeightRaw.proofSize.unwrap() };
      const instructionCount = 4;
      const instructionWeight = { refTime: new BN('1000000000'), proofSize: new BN(0) };
      const overallWeight = {
        refTime: encodedCallWeight.refTime.add(instructionWeight.refTime.muln(instructionCount)),
        proofSize: encodedCallWeight.proofSize.add(instructionWeight.proofSize.muln(instructionCount)),
      };

      const metadataStorageValue = await turingApi.query.assetRegistry.metadata(assetId);
      const { additional } = metadataStorageValue.unwrap();
      const feePerSecond = additional.feePerSecond.unwrap();
      const timePerSecond = new BN(WEIGHT_REF_TIME_PER_SECOND);
      const feeAmount = overallWeight.refTime.mul(feePerSecond).div(timePerSecond);

      const xcmMessage = {
        V3: [
          {
            WithdrawAsset: [
              {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } },
              },
            ],
          },
          {
            BuyExecution: {
              fees: {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } },
              },
              weightLimit: { Limited: overallWeight },
            },
          },
          {
            Transact: {
              originKind: 'SovereignAccount',
              requireWeightAtMost: encodedCallWeight,
              call: { encoded: taskExtrinsic.method.toHex() },
            },
          },
        ],
      };

      const dest = { V3: { parents: 1, interior: { X1: { Parachain: turingParaId } } } };
      const extrinsic = parachainApi.tx.polkadotXcm.send(dest, xcmMessage);
      batchExtrinsics.push(extrinsic);
      console.log('Added extrinsic to batchExtrinsics, extrinsic: ', extrinsic.method.toHex());

      console.log('Send batchExtrinsics to chain: ', batchExtrinsics.map((item) => item.method.toHex()));

      // TODO: we should wrap this up in send extrinsic so we can use await
      parachainApi.tx.utility.batch(batchExtrinsics).signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer }, ({ events = [], status }) => {
        console.log('current tx status', status.type);

        events.forEach(({ phase, event: { data, method, section } }) => {
          console.log(`${phase.toString()} : ${section}.${method} ${data.toString()}`);
        });

        if (status.isFinalized) {
          cb(events);
        }
      });

      // console.log('Listen automationPrice.TaskScheduled event on Turing...');
      // const listenResult = await listenEvents(turingApi, 'automationPrice', 'TaskScheduled', undefined, 60000);
      // console.log('listenResult', listenResult);
      // const { foundEvent: taskScheduledEvent } = listenResult;
      // console.log('taskScheduledEvent', taskScheduledEvent);
      // const taskId = Buffer.from(taskScheduledEvent.event.data.taskId).toString();
      // console.log('taskId:', taskId);

      // console.log(`Wait for the price to be ${triggerFunction === 'lt' ? 'less than' : 'greater than'} ${triggerParam[0]}.`);
      // console.log(`Listen xcmpQueue.XcmpMessageSent event with taskId(${taskId}) and find xcmpQueue.XcmpMessageSent event on Turing...`);
      // const { foundEvent: xcmpMessageSentEvent } = await listenEvents(turingApi, 'xcmpQueue', 'XcmpMessageSent', { taskId });
      // const { messageHash } = xcmpMessageSentEvent.event.data;
      // console.log('messageHash: ', messageHash.toString());

      // console.log(`Listen xcmpQueue.Success event with messageHash(${messageHash}) and find proxy.ProxyExecuted event on Parachain...`);
      // const { events: xcmpQueueEvents, foundEventIndex: xcmpQueuefoundEventIndex } = await listenEvents(parachainApi, 'xcmpQueue', 'Success', { messageHash });
      // const proxyExecutedEvent = _.find(_.reverse(xcmpQueueEvents), (event) => {
      //   const { section, method } = event.event;
      //   return section === 'proxy' && method === 'ProxyExecuted';
      // }, xcmpQueueEvents.length - xcmpQueuefoundEventIndex - 1);
      // console.log('ProxyExecuted event: ', JSON.stringify(proxyExecutedEvent.event.data.toHuman()));
    } catch (error) {
      console.log(error);
    }
  }

  const onClickBtnLimitOrder = useCallback(async () => {
    setIsModalOpen(true);
  }, []);

  const handleCancel = () => {
    setIsModalOpen(false);
    setIsSuccess(false);
    setIsLoading(false);
  };

  const onChangeInputNumber = (value) => {
    setInputNumber(_.toNumber(value));
  };

  const formItemLayout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 14 },
  };
  const [form] = Form.useForm();
  const orderLimitPrice = Form.useWatch('input-number-limit-price', form);
  const orderAmount = Form.useWatch('input-number-amount', form);
  const selectOption = Form.useWatch('select-buy-sell', form);

  console.log('selectOption', selectOption);

  const onFinish = async (values) => {
    console.log('Received values of form: ', values);

    const price = values['input-number-limit-price'];

    if (_.isNumber(price)) {
      setIsLoading(true);

      scheduleByPrice('gt', [price], (result) => {
        console.log('scheduleByPrice tx submission result', result);
        setIsLoading(false);
        message.success('Limit order has been placed.');
        setIsSuccess(true);
      });
    }
  };

  const onCreate = (values) => {
    console.log('Received values of form: ', values);
    setIsModalOpen(false);
  };

  const onReset = () => {
    form.resetFields();
    setIsSuccess(false);
    setIsLoading(false);
  };

  return (
    <>
      <SignButton type="primary" tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickBtnLimitOrder} wallet={wallet}>Limit Order</SignButton>
      <Modal
        title="Place Limit Order"
        open={isModalOpen}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              form.resetFields();
              onCreate(values);
            })
            .catch((info) => {
              console.log('Validate Failed:', info);
            });
        }}
        footer={null}
        onCancel={handleCancel}
        maskClosable={false}
      >
        <Space size="middle" direction="vertical">
          <div>Set a new value to the price of the pair</div>
          <Form
            form={form}
            name="place_limit_order"
            {...formItemLayout}
            initialValues={{
              'select-buy-sell': ['limit-sell'],
              'input-number-limit-price': 90,
              'input-number-amount': 36,
            }}
            onFinish={onFinish}
            onReset={onReset}
            autoComplete="off"
          >

            <Form.Item label="Destination">
              <span className="ant-form-text">Shibuya</span>
            </Form.Item>

            <Form.Item label="Exchange">
              <span className="ant-form-text">ArthSwap ({trimString('0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB', 16)})</span>
            </Form.Item>

            <Form.Item label="Method">
              <span className="ant-form-text">swapExactETHForTokens</span>
            </Form.Item>

            <Form.Item
              name="select-buy-sell"
              label="Buy/Sell"
              rules={[{ required: true, message: 'Please select between Buy or Sell' }]}
            >
              <Select placeholder="Please select between Buy or Sell">
                <Option value="limit-buy">Limit Buy</Option>
                <Option value="limit-sell">Limit Sell</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Condition">
              <Space direction="vertical">
                <span className="ant-form-text" style={{ marginLeft: 8 }}> {selectOption?.[0] === 'limit-buy' ? 'When price is below' : 'When price is over' }  </span>
                <Form.Item name="input-number-limit-price" noStyle>
                  <InputNumber min={80} max={140} step={10} onChange={onChangeInputNumber} addonAfter="WRSTR / USDC" />
                </Form.Item>
              </Space>
            </Form.Item>

            <Form.Item label="Amount">
              <Form.Item name="input-number-amount" rules={[{ required: true, message: 'Please enter an amount', type: 'number' }]}>
                <InputNumber min={1} max={100} addonAfter="USDC" />
              </Form.Item>
            </Form.Item>

            <Form.Item label="Expected Output:">
              <span className="ant-form-text">{orderLimitPrice && orderAmount ? _.floor(orderAmount / orderLimitPrice, 4) : ''}</span> WRSTR
            </Form.Item>

            <Form.Item label="Important:">
              <span>Turing will trigger the order after the price condition has met, but it cannot guarantee the price filled.</span>
            </Form.Item>

            <Form.Item wrapperCol={{ span: 12, offset: 6 }}>
              <Space size="large">
                <Button type="primary" htmlType="submit" loading={isLoading}>
                  Confirm
                </Button>
                <Button htmlType="reset">Reset</Button>
              </Space>
            </Form.Item>

            {/*
                <div>
                  <dt>Status</dt>
                  <dd>{swapStatus}</dd>
                </div>
                {receiptSwap?.blockNumber && (
                <div>
                  <dt>Mined Block Height</dt>
                  <dd>{receiptSwap?.blockNumber}</dd>
                </div>
                )}
                {receiptSwap?.hash && (
                <div>
                  <dt>Transaction Hash</dt>
                  <dd>{receiptSwap?.hash}</dd>
                </div>
                )} */}
          </Form>
          {isSuccess && (
          <Space style={{
            fontSize: 14, justifyContent: 'center', width: '100%', marginBottom: 16,
          }}
          ><CheckCircleTwoTone twoToneColor="#52c41a" /><span>The transaction has been confirmed on chain.</span>
          </Space>
          )}
        </Space>
      </Modal>
    </>
  );
}

export default AutomationTimeComponent;
