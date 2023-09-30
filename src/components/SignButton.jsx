import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Button as AntButton, Space, Modal, message, Tooltip,
} from 'antd';

function SignButton({
  wallet, onClickCallback, tooltip, children,
}) {
  const onClick = useCallback(async () => {
    console.log('SignButton.onClick.wallet', wallet);
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    console.log('SignButton.onClick.onClickCallback', onClickCallback);
    // try {
    onClickCallback().catch((error) => {
      console.log('onClickCallback.error?.message', error?.message);
      message.error(error?.message);
    });
    // } catch (error) {
    //   console.log('error?.message', error?.message);
    //   message.error(error?.message);
    // }
  }, [wallet]);

  return (wallet
    ? <AntButton key="submit" onClick={onClick}>{children}</AntButton>
    : (
      <Tooltip title={tooltip}>
        <AntButton key="submit" disabled>{children}</AntButton>
      </Tooltip>
    )
  );
}

SignButton.propTypes = {
  wallet: PropTypes.object,
  onClickCallback: PropTypes.func.isRequired,
  tooltip: PropTypes.string.isRequired,
  children: PropTypes.string.isRequired,
};

SignButton.defaultProps = {
  wallet: null,
};

export default SignButton;
