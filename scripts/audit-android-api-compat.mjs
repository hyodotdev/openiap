import { maskKotlinCommentsAndStrings } from "./audit-purchase-payload-parity.mjs";

const API_24_CONCURRENT_KEY_SET = /\bnewKeySet\s*(?:<[^>]*>)?\s*\(/;

export function usesApi24ConcurrentKeySet(source) {
  return API_24_CONCURRENT_KEY_SET.test(maskKotlinCommentsAndStrings(source));
}
