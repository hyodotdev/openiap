"use node";

import { verifyGooglePlayReceiptInternalV1 } from "./android";
import { verifyAmazonReceiptInternalV1 } from "./amazon";
import { verifyAppStoreReceiptInternalV1 } from "./ios";

export const verifyGooglePlayReceipt = verifyGooglePlayReceiptInternalV1;
export const verifyAppStoreReceipt = verifyAppStoreReceiptInternalV1;
export const verifyAmazonReceipt = verifyAmazonReceiptInternalV1;
