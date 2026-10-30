import * as Iap from '../index';
import * as VegaIap from '../index.kepler';
import {isRecoverableError} from '../utils/errorMapping';

test.each([
  {entry: 'default', api: Iap},
  {entry: 'Vega', api: VegaIap},
])('$entry exports the existing recoverable error classifier', ({api}) => {
  expect(Reflect.get(api, 'isRecoverableError')).toBe(isRecoverableError);
});
