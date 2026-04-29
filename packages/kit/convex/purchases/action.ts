"use node";

import { verifyGooglePlayReceiptInternalV1 } from "./android";
import { verifyAppStoreReceiptInternalV1 } from "./ios";

export const verifyGooglePlayReceipt = verifyGooglePlayReceiptInternalV1;
export const verifyAppStoreReceipt = verifyAppStoreReceiptInternalV1;
