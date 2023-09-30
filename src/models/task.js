import _ from 'lodash';

class Task {
  constructor(raw) {
    this.id = raw.taskId;
    this.owner = raw.ownerId;
    this.triggerFunction = raw.triggerFunction;
    this.triggerParams = raw.triggerParams;
    this.action = raw.action;
    this.assetPair = raw.assetPair;
  }

  get asset() {
    return _.join(this.assetPair, '-');
  }

  get executionFee() {
    const { action } = this;
    const fee = action.XCMP.executionFee.amount;

    return fee;
  }

  get condition() {
    const { triggerFunction, triggerParams } = this;

    const prefixStr = triggerFunction;
    const valueStr = triggerParams;
    let prefix = '';
    switch (prefixStr) {
      case 'lt':
        prefix = '<';
        break;
      case 'gt':
        prefix = '>';
        break;
      default:
        break;
    }

    return `${prefix} ${valueStr[0]}`;
  }

  get destination() {
    const { action } = this;
    const fee = action.XCMP.destination;

    // TODO: we need a map in this app to identify the destination with the below criteria:
    // 1. The chain that is defined as an object in action.XCMP.destination
    // 2. The extrinsic method, ethereumChecked.transact, that is defined in action.XCMP.encodedCall
    // 3. The smart contract address of ArthSwap
    // 4. The first few character of the input data of the smart contract call, identifying the method name, Swap.
    // for example, [{ interior: { X1: { Parachain: '2,000' } } }, 'ethereumChecked.transact', '0xa17e7ba271dc2cc12ba5ecf6d178bf818a6d76eb', '0x7ff36ab5'];

    return 'Rocstar.ArthSwap';
  }

  toJson() {
    const {
      asset, executionFee, condition, destination,
    } = this;
    const { action } = this;

    return {
      id: this.id,
      owner: this.owner,
      triggerFunction: this.triggerFunction,
      triggerParams: this.triggerParams,
      action,
      fee: executionFee,
      asset,
      condition,
      destination,
    };
  }
}

export default Task;
