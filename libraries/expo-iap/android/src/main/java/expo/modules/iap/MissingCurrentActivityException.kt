package expo.modules.iap

import expo.modules.kotlin.exception.CodedException

class MissingCurrentActivityException :
    CodedException("Current Activity is not available. Ensure the module is used within a running Activity context (e.g., not in a background service or after the Activity has been destroyed).")
