import type {HybridObject} from 'react-native-nitro-modules';
import type {RnIap} from '../specs/RnIap.nitro';
import type {
  RnIapProtocol,
  NitroPurchaseError,
} from '../specs/RnIapProtocol.nitro';
import type {PurchaseError} from '../types';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type AsyncKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends (
    ...args: never[]
  ) => Promise<unknown>
    ? K
    : never;
}[keyof T];
type Operations = AsyncKeys<RnIap> | 'enableBillingProgramAndroid';
type ProtocolOperations = Exclude<
  keyof RnIapProtocol,
  keyof HybridObject<{ios: 'swift'; android: 'kotlin'}> | 'core'
>;
type Operation<T> = T extends (...args: never[]) => unknown ? T : never;
type Value<T> = T extends {value?: infer V} ? V : void;
type Consistency = {
  [K in Operations]: Equal<
    [
      Parameters<Operation<NonNullable<RnIap[K]>>>,
      Awaited<ReturnType<Operation<NonNullable<RnIap[K]>>>>,
    ],
    [
      Parameters<Operation<NonNullable<RnIapProtocol[K]>>>,
      Value<Awaited<ReturnType<Operation<NonNullable<RnIapProtocol[K]>>>>>,
    ]
  >;
};

it('covers the existing asynchronous contract and every PurchaseError field', () => {
  const contract: [
    Assert<Equal<Operations, ProtocolOperations>>,
    Assert<Equal<Consistency[Operations], true>>,
    Assert<
      Equal<
        {[K in keyof NitroPurchaseError]: NitroPurchaseError[K]},
        {
          [K in keyof PurchaseError]: K extends 'code'
            ? string
            : PurchaseError[K];
        }
      >
    >,
  ] = [true, true, true];
  expect(contract).toEqual([true, true, true]);
});
