import { v } from "convex/values";

export enum HarmonizedPurchaseState {
  // Purchase is complete and valid
  ENTITLED = "ENTITLED",
  // Purchase is waiting for acknowledgment (Google Play specific)
  PENDING_ACKNOWLEDGMENT = "PENDING_ACKNOWLEDGMENT",
  PENDING = "PENDING",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
  // Consumable purchase is ready to be fulfilled / consumed by the app
  READY_TO_CONSUME = "READY_TO_CONSUME",
  // Consumable item has been fulfilled / consumed (Google Play only)
  CONSUMED = "CONSUMED",
  UNKNOWN = "UNKNOWN",
  INAUTHENTIC = "INAUTHENTIC",
}

export const harmonizedPurchaseStateValidator = v.union(
  v.literal(HarmonizedPurchaseState.ENTITLED),
  v.literal(HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT),
  v.literal(HarmonizedPurchaseState.PENDING),
  v.literal(HarmonizedPurchaseState.CANCELED),
  v.literal(HarmonizedPurchaseState.EXPIRED),
  v.literal(HarmonizedPurchaseState.READY_TO_CONSUME),
  v.literal(HarmonizedPurchaseState.CONSUMED),
  v.literal(HarmonizedPurchaseState.UNKNOWN),
  v.literal(HarmonizedPurchaseState.INAUTHENTIC),
);
