import React, { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Butto as AntButton, Space, message, Table, Tag,
} from 'antd';
import Item from 'antd/es/list/Item';
import BN from 'bn.js';
import SignButton from './SignButton';
import Task from '../models/task';
import { WEIGHT_REF_TIME_PER_SECOND, MOMENT_FORMAT } from '../config';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import { sendExtrinsic, trimString } from '../common/utils';

const { Column } = Table;

function TaskList() {
  const {
    wallet, adapters,
  } = useWalletPolkadot();

  const [taskMap, setTaskMap] = useState(new Map());
  const [displayArray, setDisplayArray] = useState([]);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Initializing TaskList component.   ');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    return () => {
      // Cleanup code here (if needed)
    };
  }, []);

  /**
   * Update the displayArray by the taskMap, preparing tasks for React Table
   * @param {*} map The map of TaskMap
   */
  const setDisplayArrayByTaskMap = (map) => {
    const taskItems = _.map(Array.from(map.values()), (item) => {
      const taskItem = new Task(item);
      return taskItem.toJson();
    });

    // Update Table View right away for displaytrimString
    const formattedArray = taskItems.map(({ taskId, ownerId, ...rest }) => ({
      key: `${taskId}`,
      taskId,
      ownerId: trimString(ownerId, 12),
      ...rest,
    }));

    setDisplayArray(formattedArray);
  };

  useEffect(() => {
    if (_.isEmpty(adapters) || _.isUndefined(adapters[0])) {
      return;
    }

    try {
      const turingAdapter = adapters[0];

      // One-time fetch automationPrice.tasks in the beginning for the initialization of TaskList
      turingAdapter?.fetchTasksFromStorage((newTaskArray) => {
        // Examine the new array to see if there are any new tasks
        const differences = _.difference(newTaskArray, taskMap.values());

        if (_.isEmpty(differences)) {
          return;
        }

        console.log('Updating tasks array since the new array contains more items,', newTaskArray);

        // Add new tasks to taskMap and update displayArray
        _.each(differences, (item) => {
          taskMap.set(item.taskId, item);
        });

        setTaskMap(taskMap);
        setDisplayArrayByTaskMap(taskMap);
      });

      // Subscribe to automationPrice.tasks changes based on system events
      turingAdapter?.subscribeTasks((updatedTasks) => {
        if (!_.isEmpty(updatedTasks)) {
          console.log('subscribeTasks.updatedTasks', updatedTasks);

          // Handle TaskCancelled, TaskExecuted, and TaskScheduled events,
          _.each(updatedTasks, (updatedTask) => {
            const { method, data: { taskId } } = updatedTask;
            if (method === 'TaskCancelled' && taskMap.has(taskId)) {
              taskMap.get(taskId).status = 'Cancelled';
            } else if (method === 'TaskExecuted' && taskMap.has(taskId)) {
              taskMap.get(taskId).status = 'Completed';
            } else if (method === 'TaskScheduled') {
              taskMap.set(taskId, updatedTask?.data);
            }
          });

          setTaskMap(taskMap);
          setDisplayArrayByTaskMap(taskMap);
        }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [adapters, taskMap, setTaskMap, setDisplayArray]);

  const onClickCancel = useCallback(async (record) => {
    const api = adapters[0]?.api;
    const parachainApi = adapters[1]?.api;
    const turingParaId = (await api.query.parachainInfo.parachainId()).toNumber();
    const parachainParaId = (await parachainApi.query.parachainInfo.parachainId()).toNumber();
    const storageValue = await api.query.assetRegistry.locationToAssetId({ parents: 1, interior: { X1: { Parachain: parachainParaId } } });
    const assetId = storageValue.unwrap();

    // TODO: the cancel needs to go through astar
    console.log(`Send Xcm message to Turing to cancel the task ${record.taskId} ...`);

    const cancelExtrinsic = api.tx.automationPrice.cancelTask(record.taskId);

    const encodedCallWeightRaw = (await cancelExtrinsic.paymentInfo(wallet?.address)).weight;
    const encodedCallWeight = { refTime: encodedCallWeightRaw.refTime.unwrap(), proofSize: encodedCallWeightRaw.proofSize.unwrap() };
    const instructionCount = 4;
    const instructionWeight = { refTime: new BN('1000000000'), proofSize: new BN(0) };
    const overallWeight = {
      refTime: encodedCallWeight.refTime.add(instructionWeight.refTime.muln(instructionCount)),
      proofSize: encodedCallWeight.proofSize.add(instructionWeight.proofSize.muln(instructionCount)),
    };

    const metadataStorageValue = await api.query.assetRegistry.metadata(assetId);
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
            call: { encoded: cancelExtrinsic.method.toHex() },
          },
        },
      ],
    };

    const dest = { V3: { parents: 1, interior: { X1: { Parachain: turingParaId } } } };
    const xcmExtrinsic = parachainApi.tx.polkadotXcm.send(dest, xcmMessage);

    console.log('cancelExtrinsic.method.toHex()', cancelExtrinsic.method.toHex());
    console.log('xcmExtrinsic.method.toHex()', xcmExtrinsic.method.toHex());

    await xcmExtrinsic.signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer });
  }, [adapters, wallet]);

  return (
    <Table dataSource={displayArray} pagination={false} size="middle">
      <Column title="Task Id" dataIndex="taskId" key="taskId" />
      <Column title="Owner" dataIndex="ownerId" key="ownerId" />
      <Column title="Destination" dataIndex="destination" key="destination" />
      <Column title="Asset" dataIndex="asset" key="asset" />
      <Column title="Condition" dataIndex="condition" key="condition" />
      <Column
        title="Status"
        dataIndex="status"
        key="status"
        render={(_any, record) => {
          switch (record.status) {
            case 'Pending':
              return <Tag color="processing">{record.status}</Tag>;
            case 'Cancelled':
              return <Tag color="volcano">{record.status}</Tag>;
            case 'Completed':
              return <Tag color="success">{record.status}</Tag>;
            default:
              break;
          }

          return undefined;
        }}
      />
      <Column
        title="Details"
        key="details"
        render={(_any, record) => (
          <a href={`https://turing.subscan.io/${undefined}`} target="_blank" rel="noreferrer">View</a>
        )}
      />
      <Column
        title="Action"
        key="action"
        render={(record) => (
          <Space size="middle">
            <SignButton
              onClickCallback={() => onClickCancel(record)}
              wallet={wallet}
              tooltip="Connect wallet to delete task"
            >Cancel
            </SignButton>
          </Space>
        )}
      />
    </Table>
  );
}

TaskList.propTypes = {
};

export default TaskList;
