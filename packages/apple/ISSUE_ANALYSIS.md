# Issue #3054 Analysis and Solution

## Root Cause Discovered

Thank you @PavanSomarathne for providing the purchase data! This revealed the **actual root cause** of the issue.

### Key Finding

Both transactions show `"isUpgradedIOS": false`:

**Monthly (arrives first):**
```json
{
  "id": "2000001031579336",
  "productId": "oxiwearmedicalpromonthly",
  "transactionDate": 1760118720000,
  "isUpgradedIOS": false,  // ❌ Expected true, but is false!
  "reasonIOS": "renewal"
}
```

**Yearly (arrives 4 minutes later):**
```json
{
  "id": "2000001031579845",
  "productId": "oxiwearmedicalproyearly",
  "transactionDate": 1760118900000,  // 180 seconds later
  "isUpgradedIOS": false,
  "reasonIOS": "renewal"
}
```

### Why Our Previous Fix Didn't Work

The `isUpgraded` check didn't work because **StoreKit reports subscription upgrades as "renewal" events**, not as upgraded transactions. Both transactions have:
- `isUpgradedIOS: false`
- `reasonIOS: "renewal"`
- Same `subscriptionGroupIdIOS: "21609681"`
- Same `originalTransactionIdentifierIOS`

This happens because the upgrade occurred at the renewal boundary in Sandbox.

## New Solution

Instead of relying on `isUpgraded`, we now track the **latest transaction date per subscription group**:

### Changes Made

1. **Added subscription group tracking** in `IapState.swift`:
   - Tracks the latest `purchaseDate` for each `subscriptionGroupID`
   - Skips older transactions when a newer one exists in the same group

2. **Enhanced filtering** in `startTransactionListener()`:
   ```swift
   // For subscriptions, skip if we've already seen a newer transaction in the same group
   if await self.state.shouldProcessSubscriptionTransaction(transaction) == false {
       OpenIapLog.debug("⏭️ Skipping older subscription transaction: \(transactionId) (superseded by newer transaction in same group)")
       continue
   }
   ```

3. **Added comprehensive logging**:
   - Transaction details (ID, product, dates, subscription group)
   - Skip reasons
   - Emit confirmations

### How It Works

1. Monthly transaction arrives (transactionDate: 1760118720000)
   - ✅ First in group "21609681" → Process and emit

2. Yearly transaction arrives (transactionDate: 1760118900000)
   - ✅ Newer than monthly (180 seconds later) → Process and emit
   - If monthly arrives again → ⏭️ Skip (older than yearly)

### Benefits

- ✅ Works regardless of `isUpgraded` value
- ✅ Handles both immediate and delayed upgrades
- ✅ Prevents old transactions from being emitted multiple times
- ✅ Maintains support for normal renewals
- ✅ Added detailed logging for debugging

## Testing

All unit tests pass. The next release will include these changes.

## What to Expect

With this fix:
1. Monthly subscription will emit **once**
2. Yearly subscription will emit **once** when it arrives
3. Monthly won't re-emit after yearly is processed
4. Detailed logs will show exactly what's happening

Would appreciate if you can test the next version and share the console logs!
