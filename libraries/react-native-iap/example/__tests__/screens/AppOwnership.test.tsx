import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as RNIap from 'react-native-iap';
import AppOwnership from '../../screens/AppOwnership';

const verifyAppOwnership = jest.mocked(RNIap.verifyAppOwnership);

describe('AppOwnership Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks ownership without Google fields and shows the evidence', async () => {
    verifyAppOwnership.mockResolvedValue({
      status: 'licensed',
      storeId: 'apple',
      reason: null,
      signedAppTransactionIOS: 'jws',
      integrityTokenAndroid: null,
    });
    const screen = await render(<AppOwnership />);

    await fireEvent.press(screen.getByLabelText('Check app ownership'));

    await waitFor(() =>
      expect(screen.getByText(/Status: licensed/)).toBeTruthy(),
    );
    expect(verifyAppOwnership).toHaveBeenCalledWith(undefined);
    expect(screen.getByText(/Signed AppTransaction length: 3/)).toBeTruthy();
  });

  it('sends both Google fields together', async () => {
    verifyAppOwnership.mockResolvedValue({
      status: 'unknown',
      storeId: 'google',
      reason: 'backend-verification-required',
      signedAppTransactionIOS: null,
      integrityTokenAndroid: 'token',
    });
    const screen = await render(<AppOwnership />);

    await fireEvent.changeText(
      screen.getByLabelText('Google Cloud project number'),
      ' 123 ',
    );
    await fireEvent.changeText(screen.getByLabelText('Request hash'), 'hash');
    await fireEvent.press(screen.getByLabelText('Check app ownership'));

    await waitFor(() =>
      expect(screen.getByText(/Integrity token length: 5/)).toBeTruthy(),
    );
    expect(verifyAppOwnership).toHaveBeenCalledWith({
      google: {cloudProjectNumber: '123', requestHash: 'hash'},
    });
  });

  it('rejects one Google field without calling the store', async () => {
    const screen = await render(<AppOwnership />);

    await fireEvent.changeText(screen.getByLabelText('Request hash'), 'hash');
    await fireEvent.press(screen.getByLabelText('Check app ownership'));

    expect(
      screen.getByText(
        'developer-error: Enter both Google fields or leave both empty.',
      ),
    ).toBeTruthy();
    expect(verifyAppOwnership).not.toHaveBeenCalled();
  });

  it('shows the error code and message when the check fails', async () => {
    verifyAppOwnership.mockRejectedValue(
      Object.assign(new Error('Store unavailable'), {code: 'service-error'}),
    );
    const screen = await render(<AppOwnership />);

    await fireEvent.press(screen.getByLabelText('Check app ownership'));

    await waitFor(() =>
      expect(screen.getByText('service-error: Store unavailable')).toBeTruthy(),
    );
  });
});
