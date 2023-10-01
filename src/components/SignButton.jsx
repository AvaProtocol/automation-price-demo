import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Button as AntButton, Space, Modal, message, Tooltip,
} from 'antd';

function SignButton({
  wallet, onClickCallback, tooltip, children, type,
}) {
  const onClick = async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    onClickCallback().catch((error) => {
      console.log('onClickCallback.error?.message', error?.message);
      message.error(error?.message);
    });
  };

  return (wallet
    ? <AntButton type={type} key="submit" onClick={onClick}>{children}</AntButton>
    : (
      <Tooltip title={tooltip}>
        <AntButton type={type} key="submit" disabled>{children}</AntButton>
      </Tooltip>
    )
  );
}

SignButton.propTypes = {
  wallet: PropTypes.object,
  onClickCallback: PropTypes.func.isRequired,
  tooltip: PropTypes.string.isRequired,
  children: PropTypes.string.isRequired,
  type: PropTypes.string,
};

SignButton.defaultProps = {
  wallet: null,
  type: 'default',
};

export default SignButton;
