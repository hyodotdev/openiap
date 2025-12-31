# ============================================================================
# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
# Generated from OpenIAP GraphQL schema (https://openiap.dev)
# Run `npm run generate:gdscript` to regenerate this file.
# ============================================================================
# Usage: const Types = preload("types.gd")
#        var store: Types.IapStore = Types.IapStore.APPLE
# ============================================================================

# ============================================================================
# Enums
# ============================================================================

## Alternative billing mode for Android Controls which billing system is used @deprecated Use enableBillingProgramAndroid with BillingProgramAndroid instead. Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
enum AlternativeBillingModeAndroid {
	## Standard Google Play billing (default)
	NONE = 0,
	## User choice billing - user can select between Google Play or alternative Requires Google Play Billing Library 7.0+ @deprecated Use BillingProgramAndroid.USER_CHOICE_BILLING instead
	USER_CHOICE = 1,
	## Alternative billing only - no Google Play billing option Requires Google Play Billing Library 6.2+ @deprecated Use BillingProgramAndroid.EXTERNAL_OFFER instead
	ALTERNATIVE_ONLY = 2,
}

## Billing program types for external content links, external offers, and external payments (Android) Available in Google Play Billing Library 8.2.0+, EXTERNAL_PAYMENTS added in 8.3.0
enum BillingProgramAndroid {
	## Unspecified billing program. Do not use.
	UNSPECIFIED = 0,
	## User Choice Billing program. User can select between Google Play Billing or alternative billing. Available in Google Play Billing Library 7.0+
	USER_CHOICE_BILLING = 1,
	## External Content Links program. Allows linking to external content outside the app. Available in Google Play Billing Library 8.2.0+
	EXTERNAL_CONTENT_LINK = 2,
	## External Offers program. Allows offering digital content purchases outside the app. Available in Google Play Billing Library 8.2.0+
	EXTERNAL_OFFER = 3,
	## External Payments program (Japan only). Allows presenting a side-by-side choice between Google Play Billing and developer's external payment option. Users can choose to complete the purchase on the developer's website. Available in Google Play Billing Library 8.3.0+
	EXTERNAL_PAYMENTS = 4,
}

## Launch mode for developer billing option (Android) Determines how the external payment URL is launched Available in Google Play Billing Library 8.3.0+
enum DeveloperBillingLaunchModeAndroid {
	## Unspecified launch mode. Do not use.
	UNSPECIFIED = 0,
	## Google Play will launch the link in an external browser or eligible app. Use this when you want Play to handle launching the external payment URL.
	LAUNCH_IN_EXTERNAL_BROWSER_OR_APP = 1,
	## The caller app will launch the link after Play returns control. Use this when you want to handle launching the external payment URL yourself.
	CALLER_WILL_LAUNCH_LINK = 2,
}

enum ErrorCode {
	UNKNOWN = 0,
	USER_CANCELLED = 1,
	USER_ERROR = 2,
	ITEM_UNAVAILABLE = 3,
	REMOTE_ERROR = 4,
	NETWORK_ERROR = 5,
	SERVICE_ERROR = 6,
	RECEIPT_FAILED = 7,
	RECEIPT_FINISHED = 8,
	RECEIPT_FINISHED_FAILED = 9,
	PURCHASE_VERIFICATION_FAILED = 10,
	PURCHASE_VERIFICATION_FINISHED = 11,
	PURCHASE_VERIFICATION_FINISH_FAILED = 12,
	NOT_PREPARED = 13,
	NOT_ENDED = 14,
	ALREADY_OWNED = 15,
	DEVELOPER_ERROR = 16,
	BILLING_RESPONSE_JSON_PARSE_ERROR = 17,
	DEFERRED_PAYMENT = 18,
	INTERRUPTED = 19,
	IAP_NOT_AVAILABLE = 20,
	PURCHASE_ERROR = 21,
	SYNC_ERROR = 22,
	TRANSACTION_VALIDATION_FAILED = 23,
	ACTIVITY_UNAVAILABLE = 24,
	ALREADY_PREPARED = 25,
	PENDING = 26,
	CONNECTION_CLOSED = 27,
	INIT_CONNECTION = 28,
	SERVICE_DISCONNECTED = 29,
	QUERY_PRODUCT = 30,
	SKU_NOT_FOUND = 31,
	SKU_OFFER_MISMATCH = 32,
	ITEM_NOT_OWNED = 33,
	BILLING_UNAVAILABLE = 34,
	FEATURE_NOT_SUPPORTED = 35,
	EMPTY_SKU_LIST = 36,
}

## Launch mode for external link flow (Android) Determines how the external URL is launched Available in Google Play Billing Library 8.2.0+
enum ExternalLinkLaunchModeAndroid {
	## Unspecified launch mode. Do not use.
	UNSPECIFIED = 0,
	## Play will launch the URL in an external browser or eligible app
	LAUNCH_IN_EXTERNAL_BROWSER_OR_APP = 1,
	## Play will not launch the URL. The app handles launching the URL after Play returns control.
	CALLER_WILL_LAUNCH_LINK = 2,
}

## Link type for external link flow (Android) Specifies the type of external link destination Available in Google Play Billing Library 8.2.0+
enum ExternalLinkTypeAndroid {
	## Unspecified link type. Do not use.
	UNSPECIFIED = 0,
	## The link will direct users to a digital content offer
	LINK_TO_DIGITAL_CONTENT_OFFER = 1,
	## The link will direct users to download an app
	LINK_TO_APP_DOWNLOAD = 2,
}

## User actions on external purchase notice sheet (iOS 18.2+)
enum ExternalPurchaseNoticeAction {
	## User chose to continue to external purchase
	CONTINUE = 0,
	## User dismissed the notice sheet
	DISMISSED = 1,
}

enum IapEvent {
	PURCHASE_UPDATED = 0,
	PURCHASE_ERROR = 1,
	PROMOTED_PRODUCT_IOS = 2,
	USER_CHOICE_BILLING_ANDROID = 3,
	## Fired when user selects developer-provided billing option in external payments flow. Available on Android with Google Play Billing Library 8.3.0+
	DEVELOPER_PROVIDED_BILLING_ANDROID = 4,
}

## Unified purchase states from IAPKit verification response.
enum IapkitPurchaseState {
	## User is entitled to the product (purchase is complete and active).
	ENTITLED = 0,
	## Receipt is valid but still needs server acknowledgment.
	PENDING_ACKNOWLEDGMENT = 1,
	## Purchase is in progress or awaiting confirmation.
	PENDING = 2,
	## Purchase was cancelled or refunded.
	CANCELED = 3,
	## Subscription or entitlement has expired.
	EXPIRED = 4,
	## Consumable purchase is ready to be fulfilled.
	READY_TO_CONSUME = 5,
	## Consumable item has been fulfilled/consumed.
	CONSUMED = 6,
	## Purchase state could not be determined.
	UNKNOWN = 7,
	## Purchase receipt is not authentic (fraudulent or tampered).
	INAUTHENTIC = 8,
}

enum IapPlatform {
	IOS = 0,
	ANDROID = 1,
}

enum IapStore {
	UNKNOWN = 0,
	APPLE = 1,
	GOOGLE = 2,
	HORIZON = 3,
}

enum PaymentModeIOS {
	EMPTY = 0,
	FREE_TRIAL = 1,
	PAY_AS_YOU_GO = 2,
	PAY_UP_FRONT = 3,
}

enum ProductQueryType {
	IN_APP = 0,
	SUBS = 1,
	ALL = 2,
}

enum ProductType {
	IN_APP = 0,
	SUBS = 1,
}

enum ProductTypeIOS {
	CONSUMABLE = 0,
	NON_CONSUMABLE = 1,
	AUTO_RENEWABLE_SUBSCRIPTION = 2,
	NON_RENEWING_SUBSCRIPTION = 3,
}

enum PurchaseState {
	PENDING = 0,
	PURCHASED = 1,
	UNKNOWN = 2,
}

enum PurchaseVerificationProvider {
	IAPKIT = 0,
}

enum SubscriptionOfferTypeIOS {
	INTRODUCTORY = 0,
	PROMOTIONAL = 1,
}

enum SubscriptionPeriodIOS {
	DAY = 0,
	WEEK = 1,
	MONTH = 2,
	YEAR = 3,
	EMPTY = 4,
}

## Replacement mode for subscription changes (Android) These modes determine how the subscription replacement affects billing. Available in Google Play Billing Library 8.1.0+
enum SubscriptionReplacementModeAndroid {
	## Unknown replacement mode. Do not use.
	UNKNOWN_REPLACEMENT_MODE = 0,
	## Replacement takes effect immediately, and the new expiration time will be prorated.
	WITH_TIME_PRORATION = 1,
	## Replacement takes effect immediately, and the billing cycle remains the same.
	CHARGE_PRORATED_PRICE = 2,
	## Replacement takes effect immediately, and the user is charged full price immediately.
	CHARGE_FULL_PRICE = 3,
	## Replacement takes effect when the old plan expires.
	WITHOUT_PRORATION = 4,
	## Replacement takes effect when the old plan expires, and the user is not charged.
	DEFERRED = 5,
	## Keep the existing payment schedule unchanged for the item (8.1.0+)
	KEEP_EXISTING = 6,
}

# ============================================================================
# Types
# ============================================================================

class ActiveSubscription:
	var product_id: String
	var is_active: bool
	var expiration_date_ios: float
	var auto_renewing_android: bool
	var environment_ios: String
	## @deprecated iOS only - use daysUntilExpirationIOS instead.
	var will_expire_soon: bool
	var days_until_expiration_ios: float
	var transaction_id: String
	var purchase_token: String
	var transaction_date: float
	var base_plan_id_android: String
	## Required for subscription upgrade/downgrade on Android
	var purchase_token_android: String
	## The current plan identifier. This is:
	var current_plan_id: String
	## Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,
	var renewal_info_ios: RenewalInfoIOS

	static func from_dict(data: Dictionary) -> ActiveSubscription:
		var obj = ActiveSubscription.new()
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("isActive") and data["isActive"] != null:
			obj.is_active = data["isActive"]
		if data.has("expirationDateIOS") and data["expirationDateIOS"] != null:
			obj.expiration_date_ios = data["expirationDateIOS"]
		if data.has("autoRenewingAndroid") and data["autoRenewingAndroid"] != null:
			obj.auto_renewing_android = data["autoRenewingAndroid"]
		if data.has("environmentIOS") and data["environmentIOS"] != null:
			obj.environment_ios = data["environmentIOS"]
		if data.has("willExpireSoon") and data["willExpireSoon"] != null:
			obj.will_expire_soon = data["willExpireSoon"]
		if data.has("daysUntilExpirationIOS") and data["daysUntilExpirationIOS"] != null:
			obj.days_until_expiration_ios = data["daysUntilExpirationIOS"]
		if data.has("transactionId") and data["transactionId"] != null:
			obj.transaction_id = data["transactionId"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("basePlanIdAndroid") and data["basePlanIdAndroid"] != null:
			obj.base_plan_id_android = data["basePlanIdAndroid"]
		if data.has("purchaseTokenAndroid") and data["purchaseTokenAndroid"] != null:
			obj.purchase_token_android = data["purchaseTokenAndroid"]
		if data.has("currentPlanId") and data["currentPlanId"] != null:
			obj.current_plan_id = data["currentPlanId"]
		if data.has("renewalInfoIOS") and data["renewalInfoIOS"] != null:
			if data["renewalInfoIOS"] is Dictionary:
				obj.renewal_info_ios = RenewalInfoIOS.from_dict(data["renewalInfoIOS"])
			else:
				obj.renewal_info_ios = data["renewalInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["productId"] = product_id
		result["isActive"] = is_active
		result["expirationDateIOS"] = expiration_date_ios
		result["autoRenewingAndroid"] = auto_renewing_android
		result["environmentIOS"] = environment_ios
		result["willExpireSoon"] = will_expire_soon
		result["daysUntilExpirationIOS"] = days_until_expiration_ios
		result["transactionId"] = transaction_id
		result["purchaseToken"] = purchase_token
		result["transactionDate"] = transaction_date
		result["basePlanIdAndroid"] = base_plan_id_android
		result["purchaseTokenAndroid"] = purchase_token_android
		result["currentPlanId"] = current_plan_id
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			result["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			result["renewalInfoIOS"] = renewal_info_ios
		return result

class AppTransaction:
	var bundle_id: String
	var app_version: String
	var original_app_version: String
	var original_purchase_date: float
	var device_verification: String
	var device_verification_nonce: String
	var environment: String
	var signed_date: float
	var app_id: float
	var app_version_id: float
	var preorder_date: float
	var app_transaction_id: String
	var original_platform: String

	static func from_dict(data: Dictionary) -> AppTransaction:
		var obj = AppTransaction.new()
		if data.has("bundleId") and data["bundleId"] != null:
			obj.bundle_id = data["bundleId"]
		if data.has("appVersion") and data["appVersion"] != null:
			obj.app_version = data["appVersion"]
		if data.has("originalAppVersion") and data["originalAppVersion"] != null:
			obj.original_app_version = data["originalAppVersion"]
		if data.has("originalPurchaseDate") and data["originalPurchaseDate"] != null:
			obj.original_purchase_date = data["originalPurchaseDate"]
		if data.has("deviceVerification") and data["deviceVerification"] != null:
			obj.device_verification = data["deviceVerification"]
		if data.has("deviceVerificationNonce") and data["deviceVerificationNonce"] != null:
			obj.device_verification_nonce = data["deviceVerificationNonce"]
		if data.has("environment") and data["environment"] != null:
			obj.environment = data["environment"]
		if data.has("signedDate") and data["signedDate"] != null:
			obj.signed_date = data["signedDate"]
		if data.has("appId") and data["appId"] != null:
			obj.app_id = data["appId"]
		if data.has("appVersionId") and data["appVersionId"] != null:
			obj.app_version_id = data["appVersionId"]
		if data.has("preorderDate") and data["preorderDate"] != null:
			obj.preorder_date = data["preorderDate"]
		if data.has("appTransactionId") and data["appTransactionId"] != null:
			obj.app_transaction_id = data["appTransactionId"]
		if data.has("originalPlatform") and data["originalPlatform"] != null:
			obj.original_platform = data["originalPlatform"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["bundleId"] = bundle_id
		result["appVersion"] = app_version
		result["originalAppVersion"] = original_app_version
		result["originalPurchaseDate"] = original_purchase_date
		result["deviceVerification"] = device_verification
		result["deviceVerificationNonce"] = device_verification_nonce
		result["environment"] = environment
		result["signedDate"] = signed_date
		result["appId"] = app_id
		result["appVersionId"] = app_version_id
		result["preorderDate"] = preorder_date
		result["appTransactionId"] = app_transaction_id
		result["originalPlatform"] = original_platform
		return result

## Result of checking billing program availability (Android) Available in Google Play Billing Library 8.2.0+
class BillingProgramAvailabilityResultAndroid:
	## Whether the billing program is available for the user
	var is_available: bool
	## The billing program that was checked
	var billing_program: BillingProgramAndroid

	static func from_dict(data: Dictionary) -> BillingProgramAvailabilityResultAndroid:
		var obj = BillingProgramAvailabilityResultAndroid.new()
		if data.has("isAvailable") and data["isAvailable"] != null:
			obj.is_available = data["isAvailable"]
		if data.has("billingProgram") and data["billingProgram"] != null:
			obj.billing_program = data["billingProgram"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["isAvailable"] = is_available
		result["billingProgram"] = billing_program
		return result

## Reporting details for transactions made outside of Google Play Billing (Android) Contains the external transaction token needed for reporting Available in Google Play Billing Library 8.2.0+
class BillingProgramReportingDetailsAndroid:
	## The billing program that the reporting details are associated with
	var billing_program: BillingProgramAndroid
	## External transaction token used to report transactions made outside of Google Play Billing.
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> BillingProgramReportingDetailsAndroid:
		var obj = BillingProgramReportingDetailsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			obj.billing_program = data["billingProgram"]
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["billingProgram"] = billing_program
		result["externalTransactionToken"] = external_transaction_token
		return result

## Details provided when user selects developer billing option (Android) Received via DeveloperProvidedBillingListener callback Available in Google Play Billing Library 8.3.0+
class DeveloperProvidedBillingDetailsAndroid:
	## External transaction token used to report transactions made through developer billing.
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> DeveloperProvidedBillingDetailsAndroid:
		var obj = DeveloperProvidedBillingDetailsAndroid.new()
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["externalTransactionToken"] = external_transaction_token
		return result

## Discount amount details for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class DiscountAmountAndroid:
	## Discount amount in micro-units (1,000,000 = 1 unit of currency)
	var discount_amount_micros: String
	## Formatted discount amount with currency sign (e.g., "$4.99")
	var formatted_discount_amount: String

	static func from_dict(data: Dictionary) -> DiscountAmountAndroid:
		var obj = DiscountAmountAndroid.new()
		if data.has("discountAmountMicros") and data["discountAmountMicros"] != null:
			obj.discount_amount_micros = data["discountAmountMicros"]
		if data.has("formattedDiscountAmount") and data["formattedDiscountAmount"] != null:
			obj.formatted_discount_amount = data["formattedDiscountAmount"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["discountAmountMicros"] = discount_amount_micros
		result["formattedDiscountAmount"] = formatted_discount_amount
		return result

## Discount display information for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class DiscountDisplayInfoAndroid:
	## Percentage discount (e.g., 33 for 33% off)
	var percentage_discount: int
	## Absolute discount amount details
	var discount_amount: DiscountAmountAndroid

	static func from_dict(data: Dictionary) -> DiscountDisplayInfoAndroid:
		var obj = DiscountDisplayInfoAndroid.new()
		if data.has("percentageDiscount") and data["percentageDiscount"] != null:
			obj.percentage_discount = data["percentageDiscount"]
		if data.has("discountAmount") and data["discountAmount"] != null:
			if data["discountAmount"] is Dictionary:
				obj.discount_amount = DiscountAmountAndroid.from_dict(data["discountAmount"])
			else:
				obj.discount_amount = data["discountAmount"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["percentageDiscount"] = percentage_discount
		if discount_amount != null and discount_amount.has_method("to_dict"):
			result["discountAmount"] = discount_amount.to_dict()
		else:
			result["discountAmount"] = discount_amount
		return result

class DiscountIOS:
	var identifier: String
	var type: String
	var number_of_periods: int
	var price: String
	var price_amount: float
	var payment_mode: PaymentModeIOS
	var subscription_period: String
	var localized_price: String

	static func from_dict(data: Dictionary) -> DiscountIOS:
		var obj = DiscountIOS.new()
		if data.has("identifier") and data["identifier"] != null:
			obj.identifier = data["identifier"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("numberOfPeriods") and data["numberOfPeriods"] != null:
			obj.number_of_periods = data["numberOfPeriods"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("priceAmount") and data["priceAmount"] != null:
			obj.price_amount = data["priceAmount"]
		if data.has("paymentMode") and data["paymentMode"] != null:
			obj.payment_mode = data["paymentMode"]
		if data.has("subscriptionPeriod") and data["subscriptionPeriod"] != null:
			obj.subscription_period = data["subscriptionPeriod"]
		if data.has("localizedPrice") and data["localizedPrice"] != null:
			obj.localized_price = data["localizedPrice"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["identifier"] = identifier
		result["type"] = type
		result["numberOfPeriods"] = number_of_periods
		result["price"] = price
		result["priceAmount"] = price_amount
		result["paymentMode"] = payment_mode
		result["subscriptionPeriod"] = subscription_period
		result["localizedPrice"] = localized_price
		return result

class DiscountOfferIOS:
	## Discount identifier
	var identifier: String
	## Key identifier for validation
	var key_identifier: String
	## Cryptographic nonce
	var nonce: String
	## Signature for validation
	var signature: String
	## Timestamp of discount offer
	var timestamp: float

	static func from_dict(data: Dictionary) -> DiscountOfferIOS:
		var obj = DiscountOfferIOS.new()
		if data.has("identifier") and data["identifier"] != null:
			obj.identifier = data["identifier"]
		if data.has("keyIdentifier") and data["keyIdentifier"] != null:
			obj.key_identifier = data["keyIdentifier"]
		if data.has("nonce") and data["nonce"] != null:
			obj.nonce = data["nonce"]
		if data.has("signature") and data["signature"] != null:
			obj.signature = data["signature"]
		if data.has("timestamp") and data["timestamp"] != null:
			obj.timestamp = data["timestamp"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["identifier"] = identifier
		result["keyIdentifier"] = key_identifier
		result["nonce"] = nonce
		result["signature"] = signature
		result["timestamp"] = timestamp
		return result

class EntitlementIOS:
	var sku: String
	var transaction_id: String
	var json_representation: String

	static func from_dict(data: Dictionary) -> EntitlementIOS:
		var obj = EntitlementIOS.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("transactionId") and data["transactionId"] != null:
			obj.transaction_id = data["transactionId"]
		if data.has("jsonRepresentation") and data["jsonRepresentation"] != null:
			obj.json_representation = data["jsonRepresentation"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["sku"] = sku
		result["transactionId"] = transaction_id
		result["jsonRepresentation"] = json_representation
		return result

## External offer availability result (Android) @deprecated Use BillingProgramAvailabilityResultAndroid with isBillingProgramAvailableAsync instead Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
class ExternalOfferAvailabilityResultAndroid:
	## Whether external offers are available for the user
	var is_available: bool

	static func from_dict(data: Dictionary) -> ExternalOfferAvailabilityResultAndroid:
		var obj = ExternalOfferAvailabilityResultAndroid.new()
		if data.has("isAvailable") and data["isAvailable"] != null:
			obj.is_available = data["isAvailable"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["isAvailable"] = is_available
		return result

## External offer reporting details (Android) @deprecated Use BillingProgramReportingDetailsAndroid with createBillingProgramReportingDetailsAsync instead Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
class ExternalOfferReportingDetailsAndroid:
	## External transaction token for reporting external offer transactions
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> ExternalOfferReportingDetailsAndroid:
		var obj = ExternalOfferReportingDetailsAndroid.new()
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["externalTransactionToken"] = external_transaction_token
		return result

## Result of presenting an external purchase link (iOS 18.2+)
class ExternalPurchaseLinkResultIOS:
	## Whether the user completed the external purchase flow
	var success: bool
	## Optional error message if the presentation failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseLinkResultIOS:
		var obj = ExternalPurchaseLinkResultIOS.new()
		if data.has("success") and data["success"] != null:
			obj.success = data["success"]
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["success"] = success
		result["error"] = error
		return result

## Result of presenting external purchase notice sheet (iOS 18.2+)
class ExternalPurchaseNoticeResultIOS:
	## Notice result indicating user action
	var result: ExternalPurchaseNoticeAction
	## Optional error message if the presentation failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseNoticeResultIOS:
		var obj = ExternalPurchaseNoticeResultIOS.new()
		if data.has("result") and data["result"] != null:
			obj.result = data["result"]
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["result"] = result
		result["error"] = error
		return result

## Limited quantity information for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class LimitedQuantityInfoAndroid:
	## Maximum quantity a user can purchase
	var maximum_quantity: int
	## Remaining quantity the user can still purchase
	var remaining_quantity: int

	static func from_dict(data: Dictionary) -> LimitedQuantityInfoAndroid:
		var obj = LimitedQuantityInfoAndroid.new()
		if data.has("maximumQuantity") and data["maximumQuantity"] != null:
			obj.maximum_quantity = data["maximumQuantity"]
		if data.has("remainingQuantity") and data["remainingQuantity"] != null:
			obj.remaining_quantity = data["remainingQuantity"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["maximumQuantity"] = maximum_quantity
		result["remainingQuantity"] = remaining_quantity
		return result

## Pre-order details for one-time purchase products (Android) Available in Google Play Billing Library 8.1.0+
class PreorderDetailsAndroid:
	## Pre-order presale end time in milliseconds since epoch.
	var preorder_presale_end_time_millis: String
	## Pre-order release time in milliseconds since epoch.
	var preorder_release_time_millis: String

	static func from_dict(data: Dictionary) -> PreorderDetailsAndroid:
		var obj = PreorderDetailsAndroid.new()
		if data.has("preorderPresaleEndTimeMillis") and data["preorderPresaleEndTimeMillis"] != null:
			obj.preorder_presale_end_time_millis = data["preorderPresaleEndTimeMillis"]
		if data.has("preorderReleaseTimeMillis") and data["preorderReleaseTimeMillis"] != null:
			obj.preorder_release_time_millis = data["preorderReleaseTimeMillis"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["preorderPresaleEndTimeMillis"] = preorder_presale_end_time_millis
		result["preorderReleaseTimeMillis"] = preorder_release_time_millis
		return result

class PricingPhaseAndroid:
	var formatted_price: String
	var price_currency_code: String
	var billing_period: String
	var billing_cycle_count: int
	var price_amount_micros: String
	var recurrence_mode: int

	static func from_dict(data: Dictionary) -> PricingPhaseAndroid:
		var obj = PricingPhaseAndroid.new()
		if data.has("formattedPrice") and data["formattedPrice"] != null:
			obj.formatted_price = data["formattedPrice"]
		if data.has("priceCurrencyCode") and data["priceCurrencyCode"] != null:
			obj.price_currency_code = data["priceCurrencyCode"]
		if data.has("billingPeriod") and data["billingPeriod"] != null:
			obj.billing_period = data["billingPeriod"]
		if data.has("billingCycleCount") and data["billingCycleCount"] != null:
			obj.billing_cycle_count = data["billingCycleCount"]
		if data.has("priceAmountMicros") and data["priceAmountMicros"] != null:
			obj.price_amount_micros = data["priceAmountMicros"]
		if data.has("recurrenceMode") and data["recurrenceMode"] != null:
			obj.recurrence_mode = data["recurrenceMode"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["formattedPrice"] = formatted_price
		result["priceCurrencyCode"] = price_currency_code
		result["billingPeriod"] = billing_period
		result["billingCycleCount"] = billing_cycle_count
		result["priceAmountMicros"] = price_amount_micros
		result["recurrenceMode"] = recurrence_mode
		return result

class PricingPhasesAndroid:
	var pricing_phase_list: Array[PricingPhaseAndroid]

	static func from_dict(data: Dictionary) -> PricingPhasesAndroid:
		var obj = PricingPhasesAndroid.new()
		if data.has("pricingPhaseList") and data["pricingPhaseList"] != null:
			var arr = []
			for item in data["pricingPhaseList"]:
				if item is Dictionary:
					arr.append(PricingPhaseAndroid.from_dict(item))
				else:
					arr.append(item)
			obj.pricing_phase_list = arr
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if pricing_phase_list != null:
			var arr = []
			for item in pricing_phase_list:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["pricingPhaseList"] = arr
		else:
			result["pricingPhaseList"] = null
		return result

class ProductAndroid:
	var id: String
	var title: String
	var description: String
	var type: ProductType
	var display_name: String
	var display_price: String
	var currency: String
	var price: float
	var debug_description: String
	var platform: IapPlatform
	var name_android: String
	## One-time purchase offer details including discounts (Android)
	var one_time_purchase_offer_details_android: Array[ProductAndroidOneTimePurchaseOfferDetail]
	var subscription_offer_details_android: Array[ProductSubscriptionAndroidOfferDetails]

	static func from_dict(data: Dictionary) -> ProductAndroid:
		var obj = ProductAndroid.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("title") and data["title"] != null:
			obj.title = data["title"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("debugDescription") and data["debugDescription"] != null:
			obj.debug_description = data["debugDescription"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("oneTimePurchaseOfferDetailsAndroid") and data["oneTimePurchaseOfferDetailsAndroid"] != null:
			var arr = []
			for item in data["oneTimePurchaseOfferDetailsAndroid"]:
				if item is Dictionary:
					arr.append(ProductAndroidOneTimePurchaseOfferDetail.from_dict(item))
				else:
					arr.append(item)
			obj.one_time_purchase_offer_details_android = arr
		if data.has("subscriptionOfferDetailsAndroid") and data["subscriptionOfferDetailsAndroid"] != null:
			var arr = []
			for item in data["subscriptionOfferDetailsAndroid"]:
				if item is Dictionary:
					arr.append(ProductSubscriptionAndroidOfferDetails.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offer_details_android = arr
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["title"] = title
		result["description"] = description
		result["type"] = type
		result["displayName"] = display_name
		result["displayPrice"] = display_price
		result["currency"] = currency
		result["price"] = price
		result["debugDescription"] = debug_description
		result["platform"] = platform
		result["nameAndroid"] = name_android
		if one_time_purchase_offer_details_android != null:
			var arr = []
			for item in one_time_purchase_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["oneTimePurchaseOfferDetailsAndroid"] = arr
		else:
			result["oneTimePurchaseOfferDetailsAndroid"] = null
		if subscription_offer_details_android != null:
			var arr = []
			for item in subscription_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["subscriptionOfferDetailsAndroid"] = arr
		else:
			result["subscriptionOfferDetailsAndroid"] = null
		return result

## One-time purchase offer details (Android) Available in Google Play Billing Library 7.0+
class ProductAndroidOneTimePurchaseOfferDetail:
	## Offer ID
	var offer_id: String
	## Offer token for use in BillingFlowParams when purchasing
	var offer_token: String
	## List of offer tags
	var offer_tags: Array[String]
	var price_currency_code: String
	var formatted_price: String
	var price_amount_micros: String
	## Full (non-discounted) price in micro-units
	var full_price_micros: String
	## Discount display information
	var discount_display_info: DiscountDisplayInfoAndroid
	## Valid time window for the offer
	var valid_time_window: ValidTimeWindowAndroid
	## Limited quantity information
	var limited_quantity_info: LimitedQuantityInfoAndroid
	## Pre-order details for products available for pre-order
	var preorder_details_android: PreorderDetailsAndroid
	## Rental details for rental offers
	var rental_details_android: RentalDetailsAndroid

	static func from_dict(data: Dictionary) -> ProductAndroidOneTimePurchaseOfferDetail:
		var obj = ProductAndroidOneTimePurchaseOfferDetail.new()
		if data.has("offerId") and data["offerId"] != null:
			obj.offer_id = data["offerId"]
		if data.has("offerToken") and data["offerToken"] != null:
			obj.offer_token = data["offerToken"]
		if data.has("offerTags") and data["offerTags"] != null:
			obj.offer_tags = data["offerTags"]
		if data.has("priceCurrencyCode") and data["priceCurrencyCode"] != null:
			obj.price_currency_code = data["priceCurrencyCode"]
		if data.has("formattedPrice") and data["formattedPrice"] != null:
			obj.formatted_price = data["formattedPrice"]
		if data.has("priceAmountMicros") and data["priceAmountMicros"] != null:
			obj.price_amount_micros = data["priceAmountMicros"]
		if data.has("fullPriceMicros") and data["fullPriceMicros"] != null:
			obj.full_price_micros = data["fullPriceMicros"]
		if data.has("discountDisplayInfo") and data["discountDisplayInfo"] != null:
			if data["discountDisplayInfo"] is Dictionary:
				obj.discount_display_info = DiscountDisplayInfoAndroid.from_dict(data["discountDisplayInfo"])
			else:
				obj.discount_display_info = data["discountDisplayInfo"]
		if data.has("validTimeWindow") and data["validTimeWindow"] != null:
			if data["validTimeWindow"] is Dictionary:
				obj.valid_time_window = ValidTimeWindowAndroid.from_dict(data["validTimeWindow"])
			else:
				obj.valid_time_window = data["validTimeWindow"]
		if data.has("limitedQuantityInfo") and data["limitedQuantityInfo"] != null:
			if data["limitedQuantityInfo"] is Dictionary:
				obj.limited_quantity_info = LimitedQuantityInfoAndroid.from_dict(data["limitedQuantityInfo"])
			else:
				obj.limited_quantity_info = data["limitedQuantityInfo"]
		if data.has("preorderDetailsAndroid") and data["preorderDetailsAndroid"] != null:
			if data["preorderDetailsAndroid"] is Dictionary:
				obj.preorder_details_android = PreorderDetailsAndroid.from_dict(data["preorderDetailsAndroid"])
			else:
				obj.preorder_details_android = data["preorderDetailsAndroid"]
		if data.has("rentalDetailsAndroid") and data["rentalDetailsAndroid"] != null:
			if data["rentalDetailsAndroid"] is Dictionary:
				obj.rental_details_android = RentalDetailsAndroid.from_dict(data["rentalDetailsAndroid"])
			else:
				obj.rental_details_android = data["rentalDetailsAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["offerId"] = offer_id
		result["offerToken"] = offer_token
		result["offerTags"] = offer_tags
		result["priceCurrencyCode"] = price_currency_code
		result["formattedPrice"] = formatted_price
		result["priceAmountMicros"] = price_amount_micros
		result["fullPriceMicros"] = full_price_micros
		if discount_display_info != null and discount_display_info.has_method("to_dict"):
			result["discountDisplayInfo"] = discount_display_info.to_dict()
		else:
			result["discountDisplayInfo"] = discount_display_info
		if valid_time_window != null and valid_time_window.has_method("to_dict"):
			result["validTimeWindow"] = valid_time_window.to_dict()
		else:
			result["validTimeWindow"] = valid_time_window
		if limited_quantity_info != null and limited_quantity_info.has_method("to_dict"):
			result["limitedQuantityInfo"] = limited_quantity_info.to_dict()
		else:
			result["limitedQuantityInfo"] = limited_quantity_info
		if preorder_details_android != null and preorder_details_android.has_method("to_dict"):
			result["preorderDetailsAndroid"] = preorder_details_android.to_dict()
		else:
			result["preorderDetailsAndroid"] = preorder_details_android
		if rental_details_android != null and rental_details_android.has_method("to_dict"):
			result["rentalDetailsAndroid"] = rental_details_android.to_dict()
		else:
			result["rentalDetailsAndroid"] = rental_details_android
		return result

class ProductIOS:
	var id: String
	var title: String
	var description: String
	var type: ProductType
	var display_name: String
	var display_price: String
	var currency: String
	var price: float
	var debug_description: String
	var platform: IapPlatform
	var display_name_ios: String
	var is_family_shareable_ios: bool
	var json_representation_ios: String
	var subscription_info_ios: SubscriptionInfoIOS
	var type_ios: ProductTypeIOS

	static func from_dict(data: Dictionary) -> ProductIOS:
		var obj = ProductIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("title") and data["title"] != null:
			obj.title = data["title"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("debugDescription") and data["debugDescription"] != null:
			obj.debug_description = data["debugDescription"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("displayNameIOS") and data["displayNameIOS"] != null:
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS") and data["isFamilyShareableIOS"] != null:
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS") and data["jsonRepresentationIOS"] != null:
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("subscriptionInfoIOS") and data["subscriptionInfoIOS"] != null:
			if data["subscriptionInfoIOS"] is Dictionary:
				obj.subscription_info_ios = SubscriptionInfoIOS.from_dict(data["subscriptionInfoIOS"])
			else:
				obj.subscription_info_ios = data["subscriptionInfoIOS"]
		if data.has("typeIOS") and data["typeIOS"] != null:
			obj.type_ios = data["typeIOS"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["title"] = title
		result["description"] = description
		result["type"] = type
		result["displayName"] = display_name
		result["displayPrice"] = display_price
		result["currency"] = currency
		result["price"] = price
		result["debugDescription"] = debug_description
		result["platform"] = platform
		result["displayNameIOS"] = display_name_ios
		result["isFamilyShareableIOS"] = is_family_shareable_ios
		result["jsonRepresentationIOS"] = json_representation_ios
		if subscription_info_ios != null and subscription_info_ios.has_method("to_dict"):
			result["subscriptionInfoIOS"] = subscription_info_ios.to_dict()
		else:
			result["subscriptionInfoIOS"] = subscription_info_ios
		result["typeIOS"] = type_ios
		return result

class ProductSubscriptionAndroid:
	var id: String
	var title: String
	var description: String
	var type: ProductType
	var display_name: String
	var display_price: String
	var currency: String
	var price: float
	var debug_description: String
	var platform: IapPlatform
	var name_android: String
	## One-time purchase offer details including discounts (Android)
	var one_time_purchase_offer_details_android: Array[ProductAndroidOneTimePurchaseOfferDetail]
	var subscription_offer_details_android: Array[ProductSubscriptionAndroidOfferDetails]

	static func from_dict(data: Dictionary) -> ProductSubscriptionAndroid:
		var obj = ProductSubscriptionAndroid.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("title") and data["title"] != null:
			obj.title = data["title"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("debugDescription") and data["debugDescription"] != null:
			obj.debug_description = data["debugDescription"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("oneTimePurchaseOfferDetailsAndroid") and data["oneTimePurchaseOfferDetailsAndroid"] != null:
			var arr = []
			for item in data["oneTimePurchaseOfferDetailsAndroid"]:
				if item is Dictionary:
					arr.append(ProductAndroidOneTimePurchaseOfferDetail.from_dict(item))
				else:
					arr.append(item)
			obj.one_time_purchase_offer_details_android = arr
		if data.has("subscriptionOfferDetailsAndroid") and data["subscriptionOfferDetailsAndroid"] != null:
			var arr = []
			for item in data["subscriptionOfferDetailsAndroid"]:
				if item is Dictionary:
					arr.append(ProductSubscriptionAndroidOfferDetails.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offer_details_android = arr
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["title"] = title
		result["description"] = description
		result["type"] = type
		result["displayName"] = display_name
		result["displayPrice"] = display_price
		result["currency"] = currency
		result["price"] = price
		result["debugDescription"] = debug_description
		result["platform"] = platform
		result["nameAndroid"] = name_android
		if one_time_purchase_offer_details_android != null:
			var arr = []
			for item in one_time_purchase_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["oneTimePurchaseOfferDetailsAndroid"] = arr
		else:
			result["oneTimePurchaseOfferDetailsAndroid"] = null
		if subscription_offer_details_android != null:
			var arr = []
			for item in subscription_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["subscriptionOfferDetailsAndroid"] = arr
		else:
			result["subscriptionOfferDetailsAndroid"] = null
		return result

class ProductSubscriptionAndroidOfferDetails:
	var base_plan_id: String
	var offer_id: String
	var offer_token: String
	var offer_tags: Array[String]
	var pricing_phases: PricingPhasesAndroid

	static func from_dict(data: Dictionary) -> ProductSubscriptionAndroidOfferDetails:
		var obj = ProductSubscriptionAndroidOfferDetails.new()
		if data.has("basePlanId") and data["basePlanId"] != null:
			obj.base_plan_id = data["basePlanId"]
		if data.has("offerId") and data["offerId"] != null:
			obj.offer_id = data["offerId"]
		if data.has("offerToken") and data["offerToken"] != null:
			obj.offer_token = data["offerToken"]
		if data.has("offerTags") and data["offerTags"] != null:
			obj.offer_tags = data["offerTags"]
		if data.has("pricingPhases") and data["pricingPhases"] != null:
			if data["pricingPhases"] is Dictionary:
				obj.pricing_phases = PricingPhasesAndroid.from_dict(data["pricingPhases"])
			else:
				obj.pricing_phases = data["pricingPhases"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["basePlanId"] = base_plan_id
		result["offerId"] = offer_id
		result["offerToken"] = offer_token
		result["offerTags"] = offer_tags
		if pricing_phases != null and pricing_phases.has_method("to_dict"):
			result["pricingPhases"] = pricing_phases.to_dict()
		else:
			result["pricingPhases"] = pricing_phases
		return result

class ProductSubscriptionIOS:
	var id: String
	var title: String
	var description: String
	var type: ProductType
	var display_name: String
	var display_price: String
	var currency: String
	var price: float
	var debug_description: String
	var platform: IapPlatform
	var display_name_ios: String
	var is_family_shareable_ios: bool
	var json_representation_ios: String
	var subscription_info_ios: SubscriptionInfoIOS
	var type_ios: ProductTypeIOS
	var discounts_ios: Array[DiscountIOS]
	var introductory_price_ios: String
	var introductory_price_as_amount_ios: String
	var introductory_price_payment_mode_ios: PaymentModeIOS
	var introductory_price_number_of_periods_ios: String
	var introductory_price_subscription_period_ios: SubscriptionPeriodIOS
	var subscription_period_number_ios: String
	var subscription_period_unit_ios: SubscriptionPeriodIOS

	static func from_dict(data: Dictionary) -> ProductSubscriptionIOS:
		var obj = ProductSubscriptionIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("title") and data["title"] != null:
			obj.title = data["title"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("debugDescription") and data["debugDescription"] != null:
			obj.debug_description = data["debugDescription"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("displayNameIOS") and data["displayNameIOS"] != null:
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS") and data["isFamilyShareableIOS"] != null:
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS") and data["jsonRepresentationIOS"] != null:
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("subscriptionInfoIOS") and data["subscriptionInfoIOS"] != null:
			if data["subscriptionInfoIOS"] is Dictionary:
				obj.subscription_info_ios = SubscriptionInfoIOS.from_dict(data["subscriptionInfoIOS"])
			else:
				obj.subscription_info_ios = data["subscriptionInfoIOS"]
		if data.has("typeIOS") and data["typeIOS"] != null:
			obj.type_ios = data["typeIOS"]
		if data.has("discountsIOS") and data["discountsIOS"] != null:
			var arr = []
			for item in data["discountsIOS"]:
				if item is Dictionary:
					arr.append(DiscountIOS.from_dict(item))
				else:
					arr.append(item)
			obj.discounts_ios = arr
		if data.has("introductoryPriceIOS") and data["introductoryPriceIOS"] != null:
			obj.introductory_price_ios = data["introductoryPriceIOS"]
		if data.has("introductoryPriceAsAmountIOS") and data["introductoryPriceAsAmountIOS"] != null:
			obj.introductory_price_as_amount_ios = data["introductoryPriceAsAmountIOS"]
		if data.has("introductoryPricePaymentModeIOS") and data["introductoryPricePaymentModeIOS"] != null:
			obj.introductory_price_payment_mode_ios = data["introductoryPricePaymentModeIOS"]
		if data.has("introductoryPriceNumberOfPeriodsIOS") and data["introductoryPriceNumberOfPeriodsIOS"] != null:
			obj.introductory_price_number_of_periods_ios = data["introductoryPriceNumberOfPeriodsIOS"]
		if data.has("introductoryPriceSubscriptionPeriodIOS") and data["introductoryPriceSubscriptionPeriodIOS"] != null:
			obj.introductory_price_subscription_period_ios = data["introductoryPriceSubscriptionPeriodIOS"]
		if data.has("subscriptionPeriodNumberIOS") and data["subscriptionPeriodNumberIOS"] != null:
			obj.subscription_period_number_ios = data["subscriptionPeriodNumberIOS"]
		if data.has("subscriptionPeriodUnitIOS") and data["subscriptionPeriodUnitIOS"] != null:
			obj.subscription_period_unit_ios = data["subscriptionPeriodUnitIOS"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["title"] = title
		result["description"] = description
		result["type"] = type
		result["displayName"] = display_name
		result["displayPrice"] = display_price
		result["currency"] = currency
		result["price"] = price
		result["debugDescription"] = debug_description
		result["platform"] = platform
		result["displayNameIOS"] = display_name_ios
		result["isFamilyShareableIOS"] = is_family_shareable_ios
		result["jsonRepresentationIOS"] = json_representation_ios
		if subscription_info_ios != null and subscription_info_ios.has_method("to_dict"):
			result["subscriptionInfoIOS"] = subscription_info_ios.to_dict()
		else:
			result["subscriptionInfoIOS"] = subscription_info_ios
		result["typeIOS"] = type_ios
		if discounts_ios != null:
			var arr = []
			for item in discounts_ios:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["discountsIOS"] = arr
		else:
			result["discountsIOS"] = null
		result["introductoryPriceIOS"] = introductory_price_ios
		result["introductoryPriceAsAmountIOS"] = introductory_price_as_amount_ios
		result["introductoryPricePaymentModeIOS"] = introductory_price_payment_mode_ios
		result["introductoryPriceNumberOfPeriodsIOS"] = introductory_price_number_of_periods_ios
		result["introductoryPriceSubscriptionPeriodIOS"] = introductory_price_subscription_period_ios
		result["subscriptionPeriodNumberIOS"] = subscription_period_number_ios
		result["subscriptionPeriodUnitIOS"] = subscription_period_unit_ios
		return result

class PurchaseAndroid:
	var id: String
	var product_id: String
	var ids: Array[String]
	var transaction_id: String
	var transaction_date: float
	var purchase_token: String
	## Store where purchase was made
	var store: IapStore
	var platform: IapPlatform
	var quantity: int
	var purchase_state: PurchaseState
	var is_auto_renewing: bool
	var current_plan_id: String
	var data_android: String
	var signature_android: String
	var auto_renewing_android: bool
	var is_acknowledged_android: bool
	var package_name_android: String
	var developer_payload_android: String
	var obfuscated_account_id_android: String
	var obfuscated_profile_id_android: String
	## Whether the subscription is suspended (Android)
	var is_suspended_android: bool

	static func from_dict(data: Dictionary) -> PurchaseAndroid:
		var obj = PurchaseAndroid.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			obj.ids = data["ids"]
		if data.has("transactionId") and data["transactionId"] != null:
			obj.transaction_id = data["transactionId"]
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("store") and data["store"] != null:
			obj.store = data["store"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			obj.purchase_state = data["purchaseState"]
		if data.has("isAutoRenewing") and data["isAutoRenewing"] != null:
			obj.is_auto_renewing = data["isAutoRenewing"]
		if data.has("currentPlanId") and data["currentPlanId"] != null:
			obj.current_plan_id = data["currentPlanId"]
		if data.has("dataAndroid") and data["dataAndroid"] != null:
			obj.data_android = data["dataAndroid"]
		if data.has("signatureAndroid") and data["signatureAndroid"] != null:
			obj.signature_android = data["signatureAndroid"]
		if data.has("autoRenewingAndroid") and data["autoRenewingAndroid"] != null:
			obj.auto_renewing_android = data["autoRenewingAndroid"]
		if data.has("isAcknowledgedAndroid") and data["isAcknowledgedAndroid"] != null:
			obj.is_acknowledged_android = data["isAcknowledgedAndroid"]
		if data.has("packageNameAndroid") and data["packageNameAndroid"] != null:
			obj.package_name_android = data["packageNameAndroid"]
		if data.has("developerPayloadAndroid") and data["developerPayloadAndroid"] != null:
			obj.developer_payload_android = data["developerPayloadAndroid"]
		if data.has("obfuscatedAccountIdAndroid") and data["obfuscatedAccountIdAndroid"] != null:
			obj.obfuscated_account_id_android = data["obfuscatedAccountIdAndroid"]
		if data.has("obfuscatedProfileIdAndroid") and data["obfuscatedProfileIdAndroid"] != null:
			obj.obfuscated_profile_id_android = data["obfuscatedProfileIdAndroid"]
		if data.has("isSuspendedAndroid") and data["isSuspendedAndroid"] != null:
			obj.is_suspended_android = data["isSuspendedAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["productId"] = product_id
		result["ids"] = ids
		result["transactionId"] = transaction_id
		result["transactionDate"] = transaction_date
		result["purchaseToken"] = purchase_token
		result["store"] = store
		result["platform"] = platform
		result["quantity"] = quantity
		result["purchaseState"] = purchase_state
		result["isAutoRenewing"] = is_auto_renewing
		result["currentPlanId"] = current_plan_id
		result["dataAndroid"] = data_android
		result["signatureAndroid"] = signature_android
		result["autoRenewingAndroid"] = auto_renewing_android
		result["isAcknowledgedAndroid"] = is_acknowledged_android
		result["packageNameAndroid"] = package_name_android
		result["developerPayloadAndroid"] = developer_payload_android
		result["obfuscatedAccountIdAndroid"] = obfuscated_account_id_android
		result["obfuscatedProfileIdAndroid"] = obfuscated_profile_id_android
		result["isSuspendedAndroid"] = is_suspended_android
		return result

class PurchaseError:
	var code: ErrorCode
	var message: String
	var product_id: String

	static func from_dict(data: Dictionary) -> PurchaseError:
		var obj = PurchaseError.new()
		if data.has("code") and data["code"] != null:
			obj.code = data["code"]
		if data.has("message") and data["message"] != null:
			obj.message = data["message"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["code"] = code
		result["message"] = message
		result["productId"] = product_id
		return result

class PurchaseIOS:
	var id: String
	var product_id: String
	var ids: Array[String]
	var transaction_date: float
	var purchase_token: String
	## Store where purchase was made
	var store: IapStore
	var platform: IapPlatform
	var quantity: int
	var purchase_state: PurchaseState
	var is_auto_renewing: bool
	var current_plan_id: String
	var transaction_id: String
	var quantity_ios: int
	var original_transaction_date_ios: float
	var original_transaction_identifier_ios: String
	var app_account_token: String
	var expiration_date_ios: float
	var web_order_line_item_id_ios: String
	var environment_ios: String
	var storefront_country_code_ios: String
	var app_bundle_id_ios: String
	var subscription_group_id_ios: String
	var is_upgraded_ios: bool
	var ownership_type_ios: String
	var reason_ios: String
	var reason_string_representation_ios: String
	var transaction_reason_ios: String
	var revocation_date_ios: float
	var revocation_reason_ios: String
	var offer_ios: PurchaseOfferIOS
	var currency_code_ios: String
	var currency_symbol_ios: String
	var country_code_ios: String
	var renewal_info_ios: RenewalInfoIOS

	static func from_dict(data: Dictionary) -> PurchaseIOS:
		var obj = PurchaseIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			obj.ids = data["ids"]
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("store") and data["store"] != null:
			obj.store = data["store"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			obj.purchase_state = data["purchaseState"]
		if data.has("isAutoRenewing") and data["isAutoRenewing"] != null:
			obj.is_auto_renewing = data["isAutoRenewing"]
		if data.has("currentPlanId") and data["currentPlanId"] != null:
			obj.current_plan_id = data["currentPlanId"]
		if data.has("transactionId") and data["transactionId"] != null:
			obj.transaction_id = data["transactionId"]
		if data.has("quantityIOS") and data["quantityIOS"] != null:
			obj.quantity_ios = data["quantityIOS"]
		if data.has("originalTransactionDateIOS") and data["originalTransactionDateIOS"] != null:
			obj.original_transaction_date_ios = data["originalTransactionDateIOS"]
		if data.has("originalTransactionIdentifierIOS") and data["originalTransactionIdentifierIOS"] != null:
			obj.original_transaction_identifier_ios = data["originalTransactionIdentifierIOS"]
		if data.has("appAccountToken") and data["appAccountToken"] != null:
			obj.app_account_token = data["appAccountToken"]
		if data.has("expirationDateIOS") and data["expirationDateIOS"] != null:
			obj.expiration_date_ios = data["expirationDateIOS"]
		if data.has("webOrderLineItemIdIOS") and data["webOrderLineItemIdIOS"] != null:
			obj.web_order_line_item_id_ios = data["webOrderLineItemIdIOS"]
		if data.has("environmentIOS") and data["environmentIOS"] != null:
			obj.environment_ios = data["environmentIOS"]
		if data.has("storefrontCountryCodeIOS") and data["storefrontCountryCodeIOS"] != null:
			obj.storefront_country_code_ios = data["storefrontCountryCodeIOS"]
		if data.has("appBundleIdIOS") and data["appBundleIdIOS"] != null:
			obj.app_bundle_id_ios = data["appBundleIdIOS"]
		if data.has("subscriptionGroupIdIOS") and data["subscriptionGroupIdIOS"] != null:
			obj.subscription_group_id_ios = data["subscriptionGroupIdIOS"]
		if data.has("isUpgradedIOS") and data["isUpgradedIOS"] != null:
			obj.is_upgraded_ios = data["isUpgradedIOS"]
		if data.has("ownershipTypeIOS") and data["ownershipTypeIOS"] != null:
			obj.ownership_type_ios = data["ownershipTypeIOS"]
		if data.has("reasonIOS") and data["reasonIOS"] != null:
			obj.reason_ios = data["reasonIOS"]
		if data.has("reasonStringRepresentationIOS") and data["reasonStringRepresentationIOS"] != null:
			obj.reason_string_representation_ios = data["reasonStringRepresentationIOS"]
		if data.has("transactionReasonIOS") and data["transactionReasonIOS"] != null:
			obj.transaction_reason_ios = data["transactionReasonIOS"]
		if data.has("revocationDateIOS") and data["revocationDateIOS"] != null:
			obj.revocation_date_ios = data["revocationDateIOS"]
		if data.has("revocationReasonIOS") and data["revocationReasonIOS"] != null:
			obj.revocation_reason_ios = data["revocationReasonIOS"]
		if data.has("offerIOS") and data["offerIOS"] != null:
			if data["offerIOS"] is Dictionary:
				obj.offer_ios = PurchaseOfferIOS.from_dict(data["offerIOS"])
			else:
				obj.offer_ios = data["offerIOS"]
		if data.has("currencyCodeIOS") and data["currencyCodeIOS"] != null:
			obj.currency_code_ios = data["currencyCodeIOS"]
		if data.has("currencySymbolIOS") and data["currencySymbolIOS"] != null:
			obj.currency_symbol_ios = data["currencySymbolIOS"]
		if data.has("countryCodeIOS") and data["countryCodeIOS"] != null:
			obj.country_code_ios = data["countryCodeIOS"]
		if data.has("renewalInfoIOS") and data["renewalInfoIOS"] != null:
			if data["renewalInfoIOS"] is Dictionary:
				obj.renewal_info_ios = RenewalInfoIOS.from_dict(data["renewalInfoIOS"])
			else:
				obj.renewal_info_ios = data["renewalInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["productId"] = product_id
		result["ids"] = ids
		result["transactionDate"] = transaction_date
		result["purchaseToken"] = purchase_token
		result["store"] = store
		result["platform"] = platform
		result["quantity"] = quantity
		result["purchaseState"] = purchase_state
		result["isAutoRenewing"] = is_auto_renewing
		result["currentPlanId"] = current_plan_id
		result["transactionId"] = transaction_id
		result["quantityIOS"] = quantity_ios
		result["originalTransactionDateIOS"] = original_transaction_date_ios
		result["originalTransactionIdentifierIOS"] = original_transaction_identifier_ios
		result["appAccountToken"] = app_account_token
		result["expirationDateIOS"] = expiration_date_ios
		result["webOrderLineItemIdIOS"] = web_order_line_item_id_ios
		result["environmentIOS"] = environment_ios
		result["storefrontCountryCodeIOS"] = storefront_country_code_ios
		result["appBundleIdIOS"] = app_bundle_id_ios
		result["subscriptionGroupIdIOS"] = subscription_group_id_ios
		result["isUpgradedIOS"] = is_upgraded_ios
		result["ownershipTypeIOS"] = ownership_type_ios
		result["reasonIOS"] = reason_ios
		result["reasonStringRepresentationIOS"] = reason_string_representation_ios
		result["transactionReasonIOS"] = transaction_reason_ios
		result["revocationDateIOS"] = revocation_date_ios
		result["revocationReasonIOS"] = revocation_reason_ios
		if offer_ios != null and offer_ios.has_method("to_dict"):
			result["offerIOS"] = offer_ios.to_dict()
		else:
			result["offerIOS"] = offer_ios
		result["currencyCodeIOS"] = currency_code_ios
		result["currencySymbolIOS"] = currency_symbol_ios
		result["countryCodeIOS"] = country_code_ios
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			result["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			result["renewalInfoIOS"] = renewal_info_ios
		return result

class PurchaseOfferIOS:
	var id: String
	var type: String
	var payment_mode: String

	static func from_dict(data: Dictionary) -> PurchaseOfferIOS:
		var obj = PurchaseOfferIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("paymentMode") and data["paymentMode"] != null:
			obj.payment_mode = data["paymentMode"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["id"] = id
		result["type"] = type
		result["paymentMode"] = payment_mode
		return result

class RefundResultIOS:
	var status: String
	var message: String

	static func from_dict(data: Dictionary) -> RefundResultIOS:
		var obj = RefundResultIOS.new()
		if data.has("status") and data["status"] != null:
			obj.status = data["status"]
		if data.has("message") and data["message"] != null:
			obj.message = data["message"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["status"] = status
		result["message"] = message
		return result

## Subscription renewal information from Product.SubscriptionInfo.RenewalInfo https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
class RenewalInfoIOS:
	var json_representation: String
	var will_auto_renew: bool
	var auto_renew_preference: String
	## When subscription expires due to cancellation/billing issue
	var expiration_reason: String
	## Grace period expiration date (milliseconds since epoch)
	var grace_period_expiration_date: float
	## True if subscription failed to renew due to billing issue and is retrying
	var is_in_billing_retry: bool
	## Product ID that will be used on next renewal (when user upgrades/downgrades)
	var pending_upgrade_product_id: String
	## User's response to subscription price increase
	var price_increase_status: String
	## Expected renewal date (milliseconds since epoch)
	var renewal_date: float
	## Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)
	var renewal_offer_id: String
	## Type of offer applied to next renewal
	var renewal_offer_type: String

	static func from_dict(data: Dictionary) -> RenewalInfoIOS:
		var obj = RenewalInfoIOS.new()
		if data.has("jsonRepresentation") and data["jsonRepresentation"] != null:
			obj.json_representation = data["jsonRepresentation"]
		if data.has("willAutoRenew") and data["willAutoRenew"] != null:
			obj.will_auto_renew = data["willAutoRenew"]
		if data.has("autoRenewPreference") and data["autoRenewPreference"] != null:
			obj.auto_renew_preference = data["autoRenewPreference"]
		if data.has("expirationReason") and data["expirationReason"] != null:
			obj.expiration_reason = data["expirationReason"]
		if data.has("gracePeriodExpirationDate") and data["gracePeriodExpirationDate"] != null:
			obj.grace_period_expiration_date = data["gracePeriodExpirationDate"]
		if data.has("isInBillingRetry") and data["isInBillingRetry"] != null:
			obj.is_in_billing_retry = data["isInBillingRetry"]
		if data.has("pendingUpgradeProductId") and data["pendingUpgradeProductId"] != null:
			obj.pending_upgrade_product_id = data["pendingUpgradeProductId"]
		if data.has("priceIncreaseStatus") and data["priceIncreaseStatus"] != null:
			obj.price_increase_status = data["priceIncreaseStatus"]
		if data.has("renewalDate") and data["renewalDate"] != null:
			obj.renewal_date = data["renewalDate"]
		if data.has("renewalOfferId") and data["renewalOfferId"] != null:
			obj.renewal_offer_id = data["renewalOfferId"]
		if data.has("renewalOfferType") and data["renewalOfferType"] != null:
			obj.renewal_offer_type = data["renewalOfferType"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["jsonRepresentation"] = json_representation
		result["willAutoRenew"] = will_auto_renew
		result["autoRenewPreference"] = auto_renew_preference
		result["expirationReason"] = expiration_reason
		result["gracePeriodExpirationDate"] = grace_period_expiration_date
		result["isInBillingRetry"] = is_in_billing_retry
		result["pendingUpgradeProductId"] = pending_upgrade_product_id
		result["priceIncreaseStatus"] = price_increase_status
		result["renewalDate"] = renewal_date
		result["renewalOfferId"] = renewal_offer_id
		result["renewalOfferType"] = renewal_offer_type
		return result

## Rental details for one-time purchase products that can be rented (Android) Available in Google Play Billing Library 7.0+
class RentalDetailsAndroid:
	## Rental period in ISO 8601 format (e.g., P7D for 7 days)
	var rental_period: String
	## Rental expiration period in ISO 8601 format
	var rental_expiration_period: String

	static func from_dict(data: Dictionary) -> RentalDetailsAndroid:
		var obj = RentalDetailsAndroid.new()
		if data.has("rentalPeriod") and data["rentalPeriod"] != null:
			obj.rental_period = data["rentalPeriod"]
		if data.has("rentalExpirationPeriod") and data["rentalExpirationPeriod"] != null:
			obj.rental_expiration_period = data["rentalExpirationPeriod"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["rentalPeriod"] = rental_period
		result["rentalExpirationPeriod"] = rental_expiration_period
		return result

class RequestVerifyPurchaseWithIapkitResult:
	var store: IapStore
	## Whether the purchase is valid (not falsified).
	var is_valid: bool
	## The current state of the purchase.
	var state: IapkitPurchaseState

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitResult:
		var obj = RequestVerifyPurchaseWithIapkitResult.new()
		if data.has("store") and data["store"] != null:
			obj.store = data["store"]
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
		if data.has("state") and data["state"] != null:
			obj.state = data["state"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["store"] = store
		result["isValid"] = is_valid
		result["state"] = state
		return result

class SubscriptionInfoIOS:
	var introductory_offer: SubscriptionOfferIOS
	var promotional_offers: Array[SubscriptionOfferIOS]
	var subscription_group_id: String
	var subscription_period: SubscriptionPeriodValueIOS

	static func from_dict(data: Dictionary) -> SubscriptionInfoIOS:
		var obj = SubscriptionInfoIOS.new()
		if data.has("introductoryOffer") and data["introductoryOffer"] != null:
			if data["introductoryOffer"] is Dictionary:
				obj.introductory_offer = SubscriptionOfferIOS.from_dict(data["introductoryOffer"])
			else:
				obj.introductory_offer = data["introductoryOffer"]
		if data.has("promotionalOffers") and data["promotionalOffers"] != null:
			var arr = []
			for item in data["promotionalOffers"]:
				if item is Dictionary:
					arr.append(SubscriptionOfferIOS.from_dict(item))
				else:
					arr.append(item)
			obj.promotional_offers = arr
		if data.has("subscriptionGroupId") and data["subscriptionGroupId"] != null:
			obj.subscription_group_id = data["subscriptionGroupId"]
		if data.has("subscriptionPeriod") and data["subscriptionPeriod"] != null:
			if data["subscriptionPeriod"] is Dictionary:
				obj.subscription_period = SubscriptionPeriodValueIOS.from_dict(data["subscriptionPeriod"])
			else:
				obj.subscription_period = data["subscriptionPeriod"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if introductory_offer != null and introductory_offer.has_method("to_dict"):
			result["introductoryOffer"] = introductory_offer.to_dict()
		else:
			result["introductoryOffer"] = introductory_offer
		if promotional_offers != null:
			var arr = []
			for item in promotional_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["promotionalOffers"] = arr
		else:
			result["promotionalOffers"] = null
		result["subscriptionGroupId"] = subscription_group_id
		if subscription_period != null and subscription_period.has_method("to_dict"):
			result["subscriptionPeriod"] = subscription_period.to_dict()
		else:
			result["subscriptionPeriod"] = subscription_period
		return result

class SubscriptionOfferIOS:
	var display_price: String
	var id: String
	var payment_mode: PaymentModeIOS
	var period: SubscriptionPeriodValueIOS
	var period_count: int
	var price: float
	var type: SubscriptionOfferTypeIOS

	static func from_dict(data: Dictionary) -> SubscriptionOfferIOS:
		var obj = SubscriptionOfferIOS.new()
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("paymentMode") and data["paymentMode"] != null:
			obj.payment_mode = data["paymentMode"]
		if data.has("period") and data["period"] != null:
			if data["period"] is Dictionary:
				obj.period = SubscriptionPeriodValueIOS.from_dict(data["period"])
			else:
				obj.period = data["period"]
		if data.has("periodCount") and data["periodCount"] != null:
			obj.period_count = data["periodCount"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["displayPrice"] = display_price
		result["id"] = id
		result["paymentMode"] = payment_mode
		if period != null and period.has_method("to_dict"):
			result["period"] = period.to_dict()
		else:
			result["period"] = period
		result["periodCount"] = period_count
		result["price"] = price
		result["type"] = type
		return result

class SubscriptionPeriodValueIOS:
	var unit: SubscriptionPeriodIOS
	var value: int

	static func from_dict(data: Dictionary) -> SubscriptionPeriodValueIOS:
		var obj = SubscriptionPeriodValueIOS.new()
		if data.has("unit") and data["unit"] != null:
			obj.unit = data["unit"]
		if data.has("value") and data["value"] != null:
			obj.value = data["value"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["unit"] = unit
		result["value"] = value
		return result

class SubscriptionStatusIOS:
	var state: String
	var renewal_info: RenewalInfoIOS

	static func from_dict(data: Dictionary) -> SubscriptionStatusIOS:
		var obj = SubscriptionStatusIOS.new()
		if data.has("state") and data["state"] != null:
			obj.state = data["state"]
		if data.has("renewalInfo") and data["renewalInfo"] != null:
			if data["renewalInfo"] is Dictionary:
				obj.renewal_info = RenewalInfoIOS.from_dict(data["renewalInfo"])
			else:
				obj.renewal_info = data["renewalInfo"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["state"] = state
		if renewal_info != null and renewal_info.has_method("to_dict"):
			result["renewalInfo"] = renewal_info.to_dict()
		else:
			result["renewalInfo"] = renewal_info
		return result

## User Choice Billing event details (Android) Fired when a user selects alternative billing in the User Choice Billing dialog
class UserChoiceBillingDetails:
	## Token that must be reported to Google Play within 24 hours
	var external_transaction_token: String
	## List of product IDs selected by the user
	var products: Array[String]

	static func from_dict(data: Dictionary) -> UserChoiceBillingDetails:
		var obj = UserChoiceBillingDetails.new()
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		if data.has("products") and data["products"] != null:
			obj.products = data["products"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["externalTransactionToken"] = external_transaction_token
		result["products"] = products
		return result

## Valid time window for when an offer is available (Android) Available in Google Play Billing Library 7.0+
class ValidTimeWindowAndroid:
	## Start time in milliseconds since epoch
	var start_time_millis: String
	## End time in milliseconds since epoch
	var end_time_millis: String

	static func from_dict(data: Dictionary) -> ValidTimeWindowAndroid:
		var obj = ValidTimeWindowAndroid.new()
		if data.has("startTimeMillis") and data["startTimeMillis"] != null:
			obj.start_time_millis = data["startTimeMillis"]
		if data.has("endTimeMillis") and data["endTimeMillis"] != null:
			obj.end_time_millis = data["endTimeMillis"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["startTimeMillis"] = start_time_millis
		result["endTimeMillis"] = end_time_millis
		return result

class VerifyPurchaseResultAndroid:
	var auto_renewing: bool
	var beta_product: bool
	var cancel_date: float
	var cancel_reason: String
	var deferred_date: float
	var deferred_sku: String
	var free_trial_end_date: float
	var grace_period_end_date: float
	var parent_product_id: String
	var product_id: String
	var product_type: String
	var purchase_date: float
	var quantity: int
	var receipt_id: String
	var renewal_date: float
	var term: String
	var term_sku: String
	var test_transaction: bool

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultAndroid:
		var obj = VerifyPurchaseResultAndroid.new()
		if data.has("autoRenewing") and data["autoRenewing"] != null:
			obj.auto_renewing = data["autoRenewing"]
		if data.has("betaProduct") and data["betaProduct"] != null:
			obj.beta_product = data["betaProduct"]
		if data.has("cancelDate") and data["cancelDate"] != null:
			obj.cancel_date = data["cancelDate"]
		if data.has("cancelReason") and data["cancelReason"] != null:
			obj.cancel_reason = data["cancelReason"]
		if data.has("deferredDate") and data["deferredDate"] != null:
			obj.deferred_date = data["deferredDate"]
		if data.has("deferredSku") and data["deferredSku"] != null:
			obj.deferred_sku = data["deferredSku"]
		if data.has("freeTrialEndDate") and data["freeTrialEndDate"] != null:
			obj.free_trial_end_date = data["freeTrialEndDate"]
		if data.has("gracePeriodEndDate") and data["gracePeriodEndDate"] != null:
			obj.grace_period_end_date = data["gracePeriodEndDate"]
		if data.has("parentProductId") and data["parentProductId"] != null:
			obj.parent_product_id = data["parentProductId"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("productType") and data["productType"] != null:
			obj.product_type = data["productType"]
		if data.has("purchaseDate") and data["purchaseDate"] != null:
			obj.purchase_date = data["purchaseDate"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("receiptId") and data["receiptId"] != null:
			obj.receipt_id = data["receiptId"]
		if data.has("renewalDate") and data["renewalDate"] != null:
			obj.renewal_date = data["renewalDate"]
		if data.has("term") and data["term"] != null:
			obj.term = data["term"]
		if data.has("termSku") and data["termSku"] != null:
			obj.term_sku = data["termSku"]
		if data.has("testTransaction") and data["testTransaction"] != null:
			obj.test_transaction = data["testTransaction"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["autoRenewing"] = auto_renewing
		result["betaProduct"] = beta_product
		result["cancelDate"] = cancel_date
		result["cancelReason"] = cancel_reason
		result["deferredDate"] = deferred_date
		result["deferredSku"] = deferred_sku
		result["freeTrialEndDate"] = free_trial_end_date
		result["gracePeriodEndDate"] = grace_period_end_date
		result["parentProductId"] = parent_product_id
		result["productId"] = product_id
		result["productType"] = product_type
		result["purchaseDate"] = purchase_date
		result["quantity"] = quantity
		result["receiptId"] = receipt_id
		result["renewalDate"] = renewal_date
		result["term"] = term
		result["termSku"] = term_sku
		result["testTransaction"] = test_transaction
		return result

## Result from Meta Horizon verify_entitlement API. Returns verification status and grant time for the entitlement.
class VerifyPurchaseResultHorizon:
	## Whether the entitlement verification succeeded.
	var success: bool
	## Unix timestamp (seconds) when the entitlement was granted.
	var grant_time: float

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultHorizon:
		var obj = VerifyPurchaseResultHorizon.new()
		if data.has("success") and data["success"] != null:
			obj.success = data["success"]
		if data.has("grantTime") and data["grantTime"] != null:
			obj.grant_time = data["grantTime"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["success"] = success
		result["grantTime"] = grant_time
		return result

class VerifyPurchaseResultIOS:
	## Whether the receipt is valid
	var is_valid: bool
	## Receipt data string
	var receipt_data: String
	## JWS representation
	var jws_representation: String
	## Latest transaction if available
	var latest_transaction: Variant

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultIOS:
		var obj = VerifyPurchaseResultIOS.new()
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
		if data.has("receiptData") and data["receiptData"] != null:
			obj.receipt_data = data["receiptData"]
		if data.has("jwsRepresentation") and data["jwsRepresentation"] != null:
			obj.jws_representation = data["jwsRepresentation"]
		if data.has("latestTransaction") and data["latestTransaction"] != null:
			obj.latest_transaction = data["latestTransaction"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["isValid"] = is_valid
		result["receiptData"] = receipt_data
		result["jwsRepresentation"] = jws_representation
		result["latestTransaction"] = latest_transaction
		return result

class VerifyPurchaseWithProviderError:
	var message: String
	var code: String

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderError:
		var obj = VerifyPurchaseWithProviderError.new()
		if data.has("message") and data["message"] != null:
			obj.message = data["message"]
		if data.has("code") and data["code"] != null:
			obj.code = data["code"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["message"] = message
		result["code"] = code
		return result

class VerifyPurchaseWithProviderResult:
	var provider: PurchaseVerificationProvider
	## IAPKit verification result
	var iapkit: RequestVerifyPurchaseWithIapkitResult
	## Error details if verification failed
	var errors: Array[VerifyPurchaseWithProviderError]

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderResult:
		var obj = VerifyPurchaseWithProviderResult.new()
		if data.has("provider") and data["provider"] != null:
			obj.provider = data["provider"]
		if data.has("iapkit") and data["iapkit"] != null:
			if data["iapkit"] is Dictionary:
				obj.iapkit = RequestVerifyPurchaseWithIapkitResult.from_dict(data["iapkit"])
			else:
				obj.iapkit = data["iapkit"]
		if data.has("errors") and data["errors"] != null:
			var arr = []
			for item in data["errors"]:
				if item is Dictionary:
					arr.append(VerifyPurchaseWithProviderError.from_dict(item))
				else:
					arr.append(item)
			obj.errors = arr
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["provider"] = provider
		if iapkit != null and iapkit.has_method("to_dict"):
			result["iapkit"] = iapkit.to_dict()
		else:
			result["iapkit"] = iapkit
		if errors != null:
			var arr = []
			for item in errors:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["errors"] = arr
		else:
			result["errors"] = null
		return result

class VoidResult:
	var success: bool

	static func from_dict(data: Dictionary) -> VoidResult:
		var obj = VoidResult.new()
		if data.has("success") and data["success"] != null:
			obj.success = data["success"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		result["success"] = success
		return result

# ============================================================================
# Input Types
# ============================================================================

class AndroidSubscriptionOfferInput:
	## Product SKU
	var sku: String
	## Offer token
	var offer_token: String

	static func from_dict(data: Dictionary) -> AndroidSubscriptionOfferInput:
		var obj = AndroidSubscriptionOfferInput.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("offerToken") and data["offerToken"] != null:
			obj.offer_token = data["offerToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		if offer_token != null:
			result["offerToken"] = offer_token
		return result

class DeepLinkOptions:
	## Android SKU to open (required on Android)
	var sku_android: String
	## Android package name to target (required on Android)
	var package_name_android: String

	static func from_dict(data: Dictionary) -> DeepLinkOptions:
		var obj = DeepLinkOptions.new()
		if data.has("skuAndroid") and data["skuAndroid"] != null:
			obj.sku_android = data["skuAndroid"]
		if data.has("packageNameAndroid") and data["packageNameAndroid"] != null:
			obj.package_name_android = data["packageNameAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku_android != null:
			result["skuAndroid"] = sku_android
		if package_name_android != null:
			result["packageNameAndroid"] = package_name_android
		return result

## Parameters for developer billing option in purchase flow (Android) Used with BillingFlowParams to enable external payments flow Available in Google Play Billing Library 8.3.0+
class DeveloperBillingOptionParamsAndroid:
	## The billing program (should be EXTERNAL_PAYMENTS for external payments flow)
	var billing_program: BillingProgramAndroid
	## The URI where the external payment will be processed
	var link_uri: String
	## The launch mode for the external payment link
	var launch_mode: DeveloperBillingLaunchModeAndroid

	static func from_dict(data: Dictionary) -> DeveloperBillingOptionParamsAndroid:
		var obj = DeveloperBillingOptionParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			obj.billing_program = data["billingProgram"]
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		if data.has("launchMode") and data["launchMode"] != null:
			obj.launch_mode = data["launchMode"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if billing_program != null:
			result["billingProgram"] = billing_program
		if link_uri != null:
			result["linkUri"] = link_uri
		if launch_mode != null:
			result["launchMode"] = launch_mode
		return result

class DiscountOfferInputIOS:
	## Discount identifier
	var identifier: String
	## Key identifier for validation
	var key_identifier: String
	## Cryptographic nonce
	var nonce: String
	## Signature for validation
	var signature: String
	## Timestamp of discount offer
	var timestamp: float

	static func from_dict(data: Dictionary) -> DiscountOfferInputIOS:
		var obj = DiscountOfferInputIOS.new()
		if data.has("identifier") and data["identifier"] != null:
			obj.identifier = data["identifier"]
		if data.has("keyIdentifier") and data["keyIdentifier"] != null:
			obj.key_identifier = data["keyIdentifier"]
		if data.has("nonce") and data["nonce"] != null:
			obj.nonce = data["nonce"]
		if data.has("signature") and data["signature"] != null:
			obj.signature = data["signature"]
		if data.has("timestamp") and data["timestamp"] != null:
			obj.timestamp = data["timestamp"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if identifier != null:
			result["identifier"] = identifier
		if key_identifier != null:
			result["keyIdentifier"] = key_identifier
		if nonce != null:
			result["nonce"] = nonce
		if signature != null:
			result["signature"] = signature
		if timestamp != null:
			result["timestamp"] = timestamp
		return result

## Connection initialization configuration
class InitConnectionConfig:
	## Alternative billing mode for Android
	var alternative_billing_mode_android: AlternativeBillingModeAndroid
	## Enable a specific billing program for Android (7.0+)
	var enable_billing_program_android: BillingProgramAndroid

	static func from_dict(data: Dictionary) -> InitConnectionConfig:
		var obj = InitConnectionConfig.new()
		if data.has("alternativeBillingModeAndroid") and data["alternativeBillingModeAndroid"] != null:
			obj.alternative_billing_mode_android = data["alternativeBillingModeAndroid"]
		if data.has("enableBillingProgramAndroid") and data["enableBillingProgramAndroid"] != null:
			obj.enable_billing_program_android = data["enableBillingProgramAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if alternative_billing_mode_android != null:
			result["alternativeBillingModeAndroid"] = alternative_billing_mode_android
		if enable_billing_program_android != null:
			result["enableBillingProgramAndroid"] = enable_billing_program_android
		return result

## Parameters for launching an external link (Android) Used with launchExternalLink to initiate external offer or app install flows Available in Google Play Billing Library 8.2.0+
class LaunchExternalLinkParamsAndroid:
	## The billing program (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)
	var billing_program: BillingProgramAndroid
	## The external link launch mode
	var launch_mode: ExternalLinkLaunchModeAndroid
	## The type of the external link
	var link_type: ExternalLinkTypeAndroid
	## The URI where the content will be accessed from
	var link_uri: String

	static func from_dict(data: Dictionary) -> LaunchExternalLinkParamsAndroid:
		var obj = LaunchExternalLinkParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			obj.billing_program = data["billingProgram"]
		if data.has("launchMode") and data["launchMode"] != null:
			obj.launch_mode = data["launchMode"]
		if data.has("linkType") and data["linkType"] != null:
			obj.link_type = data["linkType"]
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if billing_program != null:
			result["billingProgram"] = billing_program
		if launch_mode != null:
			result["launchMode"] = launch_mode
		if link_type != null:
			result["linkType"] = link_type
		if link_uri != null:
			result["linkUri"] = link_uri
		return result

class ProductRequest:
	var skus: Array[String]
	var type: ProductQueryType

	static func from_dict(data: Dictionary) -> ProductRequest:
		var obj = ProductRequest.new()
		if data.has("skus") and data["skus"] != null:
			obj.skus = data["skus"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if skus != null:
			result["skus"] = skus
		if type != null:
			result["type"] = type
		return result

class PurchaseInput:
	var id: String
	var product_id: String
	var ids: Array[String]
	var transaction_date: float
	var purchase_token: String
	## Store where purchase was made
	var store: IapStore
	## @deprecated Use store instead
	var platform: IapPlatform
	var quantity: int
	var purchase_state: PurchaseState
	var is_auto_renewing: bool

	static func from_dict(data: Dictionary) -> PurchaseInput:
		var obj = PurchaseInput.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			obj.ids = data["ids"]
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("store") and data["store"] != null:
			obj.store = data["store"]
		if data.has("platform") and data["platform"] != null:
			obj.platform = data["platform"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			obj.purchase_state = data["purchaseState"]
		if data.has("isAutoRenewing") and data["isAutoRenewing"] != null:
			obj.is_auto_renewing = data["isAutoRenewing"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if id != null:
			result["id"] = id
		if product_id != null:
			result["productId"] = product_id
		if ids != null:
			result["ids"] = ids
		if transaction_date != null:
			result["transactionDate"] = transaction_date
		if purchase_token != null:
			result["purchaseToken"] = purchase_token
		if store != null:
			result["store"] = store
		if platform != null:
			result["platform"] = platform
		if quantity != null:
			result["quantity"] = quantity
		if purchase_state != null:
			result["purchaseState"] = purchase_state
		if is_auto_renewing != null:
			result["isAutoRenewing"] = is_auto_renewing
		return result

class PurchaseOptions:
	## Also emit results through the iOS event listeners
	var also_publish_to_event_listener_ios: bool
	## Limit to currently active items on iOS
	var only_include_active_items_ios: bool

	static func from_dict(data: Dictionary) -> PurchaseOptions:
		var obj = PurchaseOptions.new()
		if data.has("alsoPublishToEventListenerIOS") and data["alsoPublishToEventListenerIOS"] != null:
			obj.also_publish_to_event_listener_ios = data["alsoPublishToEventListenerIOS"]
		if data.has("onlyIncludeActiveItemsIOS") and data["onlyIncludeActiveItemsIOS"] != null:
			obj.only_include_active_items_ios = data["onlyIncludeActiveItemsIOS"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if also_publish_to_event_listener_ios != null:
			result["alsoPublishToEventListenerIOS"] = also_publish_to_event_listener_ios
		if only_include_active_items_ios != null:
			result["onlyIncludeActiveItemsIOS"] = only_include_active_items_ios
		return result

class RequestPurchaseAndroidProps:
	## List of product SKUs
	var skus: Array[String]
	## Obfuscated account ID
	var obfuscated_account_id_android: String
	## Obfuscated profile ID
	var obfuscated_profile_id_android: String
	## Personalized offer flag
	var is_offer_personalized: bool
	## Developer billing option parameters for external payments flow (8.3.0+).
	var developer_billing_option: DeveloperBillingOptionParamsAndroid

	static func from_dict(data: Dictionary) -> RequestPurchaseAndroidProps:
		var obj = RequestPurchaseAndroidProps.new()
		if data.has("skus") and data["skus"] != null:
			obj.skus = data["skus"]
		if data.has("obfuscatedAccountIdAndroid") and data["obfuscatedAccountIdAndroid"] != null:
			obj.obfuscated_account_id_android = data["obfuscatedAccountIdAndroid"]
		if data.has("obfuscatedProfileIdAndroid") and data["obfuscatedProfileIdAndroid"] != null:
			obj.obfuscated_profile_id_android = data["obfuscatedProfileIdAndroid"]
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null:
			obj.is_offer_personalized = data["isOfferPersonalized"]
		if data.has("developerBillingOption") and data["developerBillingOption"] != null:
			if data["developerBillingOption"] is Dictionary:
				obj.developer_billing_option = DeveloperBillingOptionParamsAndroid.from_dict(data["developerBillingOption"])
			else:
				obj.developer_billing_option = data["developerBillingOption"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if skus != null:
			result["skus"] = skus
		if obfuscated_account_id_android != null:
			result["obfuscatedAccountIdAndroid"] = obfuscated_account_id_android
		if obfuscated_profile_id_android != null:
			result["obfuscatedProfileIdAndroid"] = obfuscated_profile_id_android
		if is_offer_personalized != null:
			result["isOfferPersonalized"] = is_offer_personalized
		if developer_billing_option != null:
			if developer_billing_option.has_method("to_dict"):
				result["developerBillingOption"] = developer_billing_option.to_dict()
			else:
				result["developerBillingOption"] = developer_billing_option
		return result

class RequestPurchaseIosProps:
	## Product SKU
	var sku: String
	## Auto-finish transaction (dangerous)
	var and_dangerously_finish_transaction_automatically: bool
	## App account token for user tracking
	var app_account_token: String
	## Purchase quantity
	var quantity: int
	## Discount offer to apply
	var with_offer: DiscountOfferInputIOS
	## Advanced commerce data token (iOS 15+).
	var advanced_commerce_data: String

	static func from_dict(data: Dictionary) -> RequestPurchaseIosProps:
		var obj = RequestPurchaseIosProps.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("andDangerouslyFinishTransactionAutomatically") and data["andDangerouslyFinishTransactionAutomatically"] != null:
			obj.and_dangerously_finish_transaction_automatically = data["andDangerouslyFinishTransactionAutomatically"]
		if data.has("appAccountToken") and data["appAccountToken"] != null:
			obj.app_account_token = data["appAccountToken"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("withOffer") and data["withOffer"] != null:
			if data["withOffer"] is Dictionary:
				obj.with_offer = DiscountOfferInputIOS.from_dict(data["withOffer"])
			else:
				obj.with_offer = data["withOffer"]
		if data.has("advancedCommerceData") and data["advancedCommerceData"] != null:
			obj.advanced_commerce_data = data["advancedCommerceData"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		if and_dangerously_finish_transaction_automatically != null:
			result["andDangerouslyFinishTransactionAutomatically"] = and_dangerously_finish_transaction_automatically
		if app_account_token != null:
			result["appAccountToken"] = app_account_token
		if quantity != null:
			result["quantity"] = quantity
		if with_offer != null:
			if with_offer.has_method("to_dict"):
				result["withOffer"] = with_offer.to_dict()
			else:
				result["withOffer"] = with_offer
		if advanced_commerce_data != null:
			result["advancedCommerceData"] = advanced_commerce_data
		return result

class RequestPurchaseProps:
	## Per-platform purchase request props
	var request_purchase: RequestPurchasePropsByPlatforms
	## Per-platform subscription request props
	var request_subscription: RequestSubscriptionPropsByPlatforms
	## Explicit purchase type hint (defaults to in-app)
	var type: ProductQueryType
	## @deprecated Use enableBillingProgramAndroid in InitConnectionConfig instead.
	var use_alternative_billing: bool

	static func from_dict(data: Dictionary) -> RequestPurchaseProps:
		var obj = RequestPurchaseProps.new()
		if data.has("requestPurchase") and data["requestPurchase"] != null:
			if data["requestPurchase"] is Dictionary:
				obj.request_purchase = RequestPurchasePropsByPlatforms.from_dict(data["requestPurchase"])
			else:
				obj.request_purchase = data["requestPurchase"]
		if data.has("requestSubscription") and data["requestSubscription"] != null:
			if data["requestSubscription"] is Dictionary:
				obj.request_subscription = RequestSubscriptionPropsByPlatforms.from_dict(data["requestSubscription"])
			else:
				obj.request_subscription = data["requestSubscription"]
		if data.has("type") and data["type"] != null:
			obj.type = data["type"]
		if data.has("useAlternativeBilling") and data["useAlternativeBilling"] != null:
			obj.use_alternative_billing = data["useAlternativeBilling"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if request_purchase != null:
			if request_purchase.has_method("to_dict"):
				result["requestPurchase"] = request_purchase.to_dict()
			else:
				result["requestPurchase"] = request_purchase
		if request_subscription != null:
			if request_subscription.has_method("to_dict"):
				result["requestSubscription"] = request_subscription.to_dict()
			else:
				result["requestSubscription"] = request_subscription
		if type != null:
			result["type"] = type
		if use_alternative_billing != null:
			result["useAlternativeBilling"] = use_alternative_billing
		return result

## Platform-specific purchase request parameters.  Note: "Platforms" refers to the SDK/OS level (apple, google), not the store. - apple: Always targets App Store - google: Targets Play Store by default, or Horizon when built with horizon flavor   (determined at build time, not runtime)
class RequestPurchasePropsByPlatforms:
	## Apple-specific purchase parameters
	var apple: RequestPurchaseIosProps
	## Google-specific purchase parameters
	var google: RequestPurchaseAndroidProps
	## @deprecated Use apple instead
	var ios: RequestPurchaseIosProps
	## @deprecated Use google instead
	var android: RequestPurchaseAndroidProps

	static func from_dict(data: Dictionary) -> RequestPurchasePropsByPlatforms:
		var obj = RequestPurchasePropsByPlatforms.new()
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				obj.apple = RequestPurchaseIosProps.from_dict(data["apple"])
			else:
				obj.apple = data["apple"]
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				obj.google = RequestPurchaseAndroidProps.from_dict(data["google"])
			else:
				obj.google = data["google"]
		if data.has("ios") and data["ios"] != null:
			if data["ios"] is Dictionary:
				obj.ios = RequestPurchaseIosProps.from_dict(data["ios"])
			else:
				obj.ios = data["ios"]
		if data.has("android") and data["android"] != null:
			if data["android"] is Dictionary:
				obj.android = RequestPurchaseAndroidProps.from_dict(data["android"])
			else:
				obj.android = data["android"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			if apple.has_method("to_dict"):
				result["apple"] = apple.to_dict()
			else:
				result["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				result["google"] = google.to_dict()
			else:
				result["google"] = google
		if ios != null:
			if ios.has_method("to_dict"):
				result["ios"] = ios.to_dict()
			else:
				result["ios"] = ios
		if android != null:
			if android.has_method("to_dict"):
				result["android"] = android.to_dict()
			else:
				result["android"] = android
		return result

class RequestSubscriptionAndroidProps:
	## List of subscription SKUs
	var skus: Array[String]
	## Obfuscated account ID
	var obfuscated_account_id_android: String
	## Obfuscated profile ID
	var obfuscated_profile_id_android: String
	## Personalized offer flag
	var is_offer_personalized: bool
	## Purchase token for upgrades/downgrades
	var purchase_token_android: String
	## Replacement mode for subscription changes
	var replacement_mode_android: int
	## Subscription offers
	var subscription_offers: Array[AndroidSubscriptionOfferInput]
	## Product-level replacement parameters (8.1.0+)
	var subscription_product_replacement_params: SubscriptionProductReplacementParamsAndroid
	## Developer billing option parameters for external payments flow (8.3.0+).
	var developer_billing_option: DeveloperBillingOptionParamsAndroid

	static func from_dict(data: Dictionary) -> RequestSubscriptionAndroidProps:
		var obj = RequestSubscriptionAndroidProps.new()
		if data.has("skus") and data["skus"] != null:
			obj.skus = data["skus"]
		if data.has("obfuscatedAccountIdAndroid") and data["obfuscatedAccountIdAndroid"] != null:
			obj.obfuscated_account_id_android = data["obfuscatedAccountIdAndroid"]
		if data.has("obfuscatedProfileIdAndroid") and data["obfuscatedProfileIdAndroid"] != null:
			obj.obfuscated_profile_id_android = data["obfuscatedProfileIdAndroid"]
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null:
			obj.is_offer_personalized = data["isOfferPersonalized"]
		if data.has("purchaseTokenAndroid") and data["purchaseTokenAndroid"] != null:
			obj.purchase_token_android = data["purchaseTokenAndroid"]
		if data.has("replacementModeAndroid") and data["replacementModeAndroid"] != null:
			obj.replacement_mode_android = data["replacementModeAndroid"]
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			var arr = []
			for item in data["subscriptionOffers"]:
				if item is Dictionary:
					arr.append(AndroidSubscriptionOfferInput.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offers = arr
		if data.has("subscriptionProductReplacementParams") and data["subscriptionProductReplacementParams"] != null:
			if data["subscriptionProductReplacementParams"] is Dictionary:
				obj.subscription_product_replacement_params = SubscriptionProductReplacementParamsAndroid.from_dict(data["subscriptionProductReplacementParams"])
			else:
				obj.subscription_product_replacement_params = data["subscriptionProductReplacementParams"]
		if data.has("developerBillingOption") and data["developerBillingOption"] != null:
			if data["developerBillingOption"] is Dictionary:
				obj.developer_billing_option = DeveloperBillingOptionParamsAndroid.from_dict(data["developerBillingOption"])
			else:
				obj.developer_billing_option = data["developerBillingOption"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if skus != null:
			result["skus"] = skus
		if obfuscated_account_id_android != null:
			result["obfuscatedAccountIdAndroid"] = obfuscated_account_id_android
		if obfuscated_profile_id_android != null:
			result["obfuscatedProfileIdAndroid"] = obfuscated_profile_id_android
		if is_offer_personalized != null:
			result["isOfferPersonalized"] = is_offer_personalized
		if purchase_token_android != null:
			result["purchaseTokenAndroid"] = purchase_token_android
		if replacement_mode_android != null:
			result["replacementModeAndroid"] = replacement_mode_android
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			result["subscriptionOffers"] = arr
		if subscription_product_replacement_params != null:
			if subscription_product_replacement_params.has_method("to_dict"):
				result["subscriptionProductReplacementParams"] = subscription_product_replacement_params.to_dict()
			else:
				result["subscriptionProductReplacementParams"] = subscription_product_replacement_params
		if developer_billing_option != null:
			if developer_billing_option.has_method("to_dict"):
				result["developerBillingOption"] = developer_billing_option.to_dict()
			else:
				result["developerBillingOption"] = developer_billing_option
		return result

class RequestSubscriptionIosProps:
	var sku: String
	var and_dangerously_finish_transaction_automatically: bool
	var app_account_token: String
	var quantity: int
	var with_offer: DiscountOfferInputIOS
	## Advanced commerce data token (iOS 15+).
	var advanced_commerce_data: String

	static func from_dict(data: Dictionary) -> RequestSubscriptionIosProps:
		var obj = RequestSubscriptionIosProps.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("andDangerouslyFinishTransactionAutomatically") and data["andDangerouslyFinishTransactionAutomatically"] != null:
			obj.and_dangerously_finish_transaction_automatically = data["andDangerouslyFinishTransactionAutomatically"]
		if data.has("appAccountToken") and data["appAccountToken"] != null:
			obj.app_account_token = data["appAccountToken"]
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("withOffer") and data["withOffer"] != null:
			if data["withOffer"] is Dictionary:
				obj.with_offer = DiscountOfferInputIOS.from_dict(data["withOffer"])
			else:
				obj.with_offer = data["withOffer"]
		if data.has("advancedCommerceData") and data["advancedCommerceData"] != null:
			obj.advanced_commerce_data = data["advancedCommerceData"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		if and_dangerously_finish_transaction_automatically != null:
			result["andDangerouslyFinishTransactionAutomatically"] = and_dangerously_finish_transaction_automatically
		if app_account_token != null:
			result["appAccountToken"] = app_account_token
		if quantity != null:
			result["quantity"] = quantity
		if with_offer != null:
			if with_offer.has_method("to_dict"):
				result["withOffer"] = with_offer.to_dict()
			else:
				result["withOffer"] = with_offer
		if advanced_commerce_data != null:
			result["advancedCommerceData"] = advanced_commerce_data
		return result

## Platform-specific subscription request parameters.  Note: "Platforms" refers to the SDK/OS level (apple, google), not the store. - apple: Always targets App Store - google: Targets Play Store by default, or Horizon when built with horizon flavor   (determined at build time, not runtime)
class RequestSubscriptionPropsByPlatforms:
	## Apple-specific subscription parameters
	var apple: RequestSubscriptionIosProps
	## Google-specific subscription parameters
	var google: RequestSubscriptionAndroidProps
	## @deprecated Use apple instead
	var ios: RequestSubscriptionIosProps
	## @deprecated Use google instead
	var android: RequestSubscriptionAndroidProps

	static func from_dict(data: Dictionary) -> RequestSubscriptionPropsByPlatforms:
		var obj = RequestSubscriptionPropsByPlatforms.new()
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				obj.apple = RequestSubscriptionIosProps.from_dict(data["apple"])
			else:
				obj.apple = data["apple"]
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				obj.google = RequestSubscriptionAndroidProps.from_dict(data["google"])
			else:
				obj.google = data["google"]
		if data.has("ios") and data["ios"] != null:
			if data["ios"] is Dictionary:
				obj.ios = RequestSubscriptionIosProps.from_dict(data["ios"])
			else:
				obj.ios = data["ios"]
		if data.has("android") and data["android"] != null:
			if data["android"] is Dictionary:
				obj.android = RequestSubscriptionAndroidProps.from_dict(data["android"])
			else:
				obj.android = data["android"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			if apple.has_method("to_dict"):
				result["apple"] = apple.to_dict()
			else:
				result["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				result["google"] = google.to_dict()
			else:
				result["google"] = google
		if ios != null:
			if ios.has_method("to_dict"):
				result["ios"] = ios.to_dict()
			else:
				result["ios"] = ios
		if android != null:
			if android.has_method("to_dict"):
				result["android"] = android.to_dict()
			else:
				result["android"] = android
		return result

class RequestVerifyPurchaseWithIapkitAppleProps:
	## The JWS token returned with the purchase response.
	var jws: String

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitAppleProps:
		var obj = RequestVerifyPurchaseWithIapkitAppleProps.new()
		if data.has("jws") and data["jws"] != null:
			obj.jws = data["jws"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if jws != null:
			result["jws"] = jws
		return result

class RequestVerifyPurchaseWithIapkitGoogleProps:
	## The token provided to the user's device when the product or subscription was purchased.
	var purchase_token: String

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitGoogleProps:
		var obj = RequestVerifyPurchaseWithIapkitGoogleProps.new()
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if purchase_token != null:
			result["purchaseToken"] = purchase_token
		return result

## Platform-specific verification parameters for IAPKit.  - apple: Verifies via App Store (JWS token) - google: Verifies via Play Store (purchase token)
class RequestVerifyPurchaseWithIapkitProps:
	## API key used for the Authorization header (Bearer {apiKey}).
	var api_key: String
	## Apple App Store verification parameters.
	var apple: RequestVerifyPurchaseWithIapkitAppleProps
	## Google Play Store verification parameters.
	var google: RequestVerifyPurchaseWithIapkitGoogleProps

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitProps:
		var obj = RequestVerifyPurchaseWithIapkitProps.new()
		if data.has("apiKey") and data["apiKey"] != null:
			obj.api_key = data["apiKey"]
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				obj.apple = RequestVerifyPurchaseWithIapkitAppleProps.from_dict(data["apple"])
			else:
				obj.apple = data["apple"]
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				obj.google = RequestVerifyPurchaseWithIapkitGoogleProps.from_dict(data["google"])
			else:
				obj.google = data["google"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if api_key != null:
			result["apiKey"] = api_key
		if apple != null:
			if apple.has_method("to_dict"):
				result["apple"] = apple.to_dict()
			else:
				result["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				result["google"] = google.to_dict()
			else:
				result["google"] = google
		return result

## Product-level subscription replacement parameters (Android) Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams Available in Google Play Billing Library 8.1.0+
class SubscriptionProductReplacementParamsAndroid:
	## The old product ID that needs to be replaced
	var old_product_id: String
	## The replacement mode for this product change
	var replacement_mode: SubscriptionReplacementModeAndroid

	static func from_dict(data: Dictionary) -> SubscriptionProductReplacementParamsAndroid:
		var obj = SubscriptionProductReplacementParamsAndroid.new()
		if data.has("oldProductId") and data["oldProductId"] != null:
			obj.old_product_id = data["oldProductId"]
		if data.has("replacementMode") and data["replacementMode"] != null:
			obj.replacement_mode = data["replacementMode"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if old_product_id != null:
			result["oldProductId"] = old_product_id
		if replacement_mode != null:
			result["replacementMode"] = replacement_mode
		return result

## Apple App Store verification parameters. Used for server-side receipt validation via App Store Server API.
class VerifyPurchaseAppleOptions:
	## Product SKU to validate
	var sku: String

	static func from_dict(data: Dictionary) -> VerifyPurchaseAppleOptions:
		var obj = VerifyPurchaseAppleOptions.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		return result

## Google Play Store verification parameters. Used for server-side receipt validation via Google Play Developer API.  ⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.
class VerifyPurchaseGoogleOptions:
	## Product SKU to validate
	var sku: String
	## Android package name (e.g., com.example.app)
	var package_name: String
	## Purchase token from the purchase response.
	var purchase_token: String
	## Google OAuth2 access token for API authentication.
	var access_token: String
	## Whether this is a subscription purchase (affects API endpoint used)
	var is_sub: bool

	static func from_dict(data: Dictionary) -> VerifyPurchaseGoogleOptions:
		var obj = VerifyPurchaseGoogleOptions.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("packageName") and data["packageName"] != null:
			obj.package_name = data["packageName"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("accessToken") and data["accessToken"] != null:
			obj.access_token = data["accessToken"]
		if data.has("isSub") and data["isSub"] != null:
			obj.is_sub = data["isSub"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		if package_name != null:
			result["packageName"] = package_name
		if purchase_token != null:
			result["purchaseToken"] = purchase_token
		if access_token != null:
			result["accessToken"] = access_token
		if is_sub != null:
			result["isSub"] = is_sub
		return result

## Meta Horizon (Quest) verification parameters. Used for server-side entitlement verification via Meta's S2S API. POST https://graph.oculus.com/$APP_ID/verify_entitlement  ⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.
class VerifyPurchaseHorizonOptions:
	## The SKU for the add-on item, defined in Meta Developer Dashboard
	var sku: String
	## The user ID of the user whose purchase you want to verify
	var user_id: String
	## Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token).
	var access_token: String

	static func from_dict(data: Dictionary) -> VerifyPurchaseHorizonOptions:
		var obj = VerifyPurchaseHorizonOptions.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		if data.has("userId") and data["userId"] != null:
			obj.user_id = data["userId"]
		if data.has("accessToken") and data["accessToken"] != null:
			obj.access_token = data["accessToken"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if sku != null:
			result["sku"] = sku
		if user_id != null:
			result["userId"] = user_id
		if access_token != null:
			result["accessToken"] = access_token
		return result

## Platform-specific purchase verification parameters.  - apple: Verifies via App Store Server API - google: Verifies via Google Play Developer API - horizon: Verifies via Meta's S2S API (verify_entitlement endpoint)
class VerifyPurchaseProps:
	## Apple App Store verification parameters.
	var apple: VerifyPurchaseAppleOptions
	## Google Play Store verification parameters.
	var google: VerifyPurchaseGoogleOptions
	## Meta Horizon (Quest) verification parameters.
	var horizon: VerifyPurchaseHorizonOptions

	static func from_dict(data: Dictionary) -> VerifyPurchaseProps:
		var obj = VerifyPurchaseProps.new()
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				obj.apple = VerifyPurchaseAppleOptions.from_dict(data["apple"])
			else:
				obj.apple = data["apple"]
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				obj.google = VerifyPurchaseGoogleOptions.from_dict(data["google"])
			else:
				obj.google = data["google"]
		if data.has("horizon") and data["horizon"] != null:
			if data["horizon"] is Dictionary:
				obj.horizon = VerifyPurchaseHorizonOptions.from_dict(data["horizon"])
			else:
				obj.horizon = data["horizon"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			if apple.has_method("to_dict"):
				result["apple"] = apple.to_dict()
			else:
				result["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				result["google"] = google.to_dict()
			else:
				result["google"] = google
		if horizon != null:
			if horizon.has_method("to_dict"):
				result["horizon"] = horizon.to_dict()
			else:
				result["horizon"] = horizon
		return result

class VerifyPurchaseWithProviderProps:
	var provider: PurchaseVerificationProvider
	var iapkit: RequestVerifyPurchaseWithIapkitProps

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderProps:
		var obj = VerifyPurchaseWithProviderProps.new()
		if data.has("provider") and data["provider"] != null:
			obj.provider = data["provider"]
		if data.has("iapkit") and data["iapkit"] != null:
			if data["iapkit"] is Dictionary:
				obj.iapkit = RequestVerifyPurchaseWithIapkitProps.from_dict(data["iapkit"])
			else:
				obj.iapkit = data["iapkit"]
		return obj

	func to_dict() -> Dictionary:
		var result = {}
		if provider != null:
			result["provider"] = provider
		if iapkit != null:
			if iapkit.has_method("to_dict"):
				result["iapkit"] = iapkit.to_dict()
			else:
				result["iapkit"] = iapkit
		return result

# ============================================================================
# Enum String Helpers
# ============================================================================

const ALTERNATIVE_BILLING_MODE_ANDROID_VALUES = {
	AlternativeBillingModeAndroid.NONE: "NONE",
	AlternativeBillingModeAndroid.USER_CHOICE: "USER_CHOICE",
	AlternativeBillingModeAndroid.ALTERNATIVE_ONLY: "ALTERNATIVE_ONLY"
}

const BILLING_PROGRAM_ANDROID_VALUES = {
	BillingProgramAndroid.UNSPECIFIED: "UNSPECIFIED",
	BillingProgramAndroid.USER_CHOICE_BILLING: "USER_CHOICE_BILLING",
	BillingProgramAndroid.EXTERNAL_CONTENT_LINK: "EXTERNAL_CONTENT_LINK",
	BillingProgramAndroid.EXTERNAL_OFFER: "EXTERNAL_OFFER",
	BillingProgramAndroid.EXTERNAL_PAYMENTS: "EXTERNAL_PAYMENTS"
}

const DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES = {
	DeveloperBillingLaunchModeAndroid.UNSPECIFIED: "UNSPECIFIED",
	DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP: "LAUNCH_IN_EXTERNAL_BROWSER_OR_APP",
	DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK: "CALLER_WILL_LAUNCH_LINK"
}

const ERROR_CODE_VALUES = {
	ErrorCode.UNKNOWN: "Unknown",
	ErrorCode.USER_CANCELLED: "UserCancelled",
	ErrorCode.USER_ERROR: "UserError",
	ErrorCode.ITEM_UNAVAILABLE: "ItemUnavailable",
	ErrorCode.REMOTE_ERROR: "RemoteError",
	ErrorCode.NETWORK_ERROR: "NetworkError",
	ErrorCode.SERVICE_ERROR: "ServiceError",
	ErrorCode.RECEIPT_FAILED: "ReceiptFailed",
	ErrorCode.RECEIPT_FINISHED: "ReceiptFinished",
	ErrorCode.RECEIPT_FINISHED_FAILED: "ReceiptFinishedFailed",
	ErrorCode.PURCHASE_VERIFICATION_FAILED: "PurchaseVerificationFailed",
	ErrorCode.PURCHASE_VERIFICATION_FINISHED: "PurchaseVerificationFinished",
	ErrorCode.PURCHASE_VERIFICATION_FINISH_FAILED: "PurchaseVerificationFinishFailed",
	ErrorCode.NOT_PREPARED: "NotPrepared",
	ErrorCode.NOT_ENDED: "NotEnded",
	ErrorCode.ALREADY_OWNED: "AlreadyOwned",
	ErrorCode.DEVELOPER_ERROR: "DeveloperError",
	ErrorCode.BILLING_RESPONSE_JSON_PARSE_ERROR: "BillingResponseJsonParseError",
	ErrorCode.DEFERRED_PAYMENT: "DeferredPayment",
	ErrorCode.INTERRUPTED: "Interrupted",
	ErrorCode.IAP_NOT_AVAILABLE: "IapNotAvailable",
	ErrorCode.PURCHASE_ERROR: "PurchaseError",
	ErrorCode.SYNC_ERROR: "SyncError",
	ErrorCode.TRANSACTION_VALIDATION_FAILED: "TransactionValidationFailed",
	ErrorCode.ACTIVITY_UNAVAILABLE: "ActivityUnavailable",
	ErrorCode.ALREADY_PREPARED: "AlreadyPrepared",
	ErrorCode.PENDING: "Pending",
	ErrorCode.CONNECTION_CLOSED: "ConnectionClosed",
	ErrorCode.INIT_CONNECTION: "InitConnection",
	ErrorCode.SERVICE_DISCONNECTED: "ServiceDisconnected",
	ErrorCode.QUERY_PRODUCT: "QueryProduct",
	ErrorCode.SKU_NOT_FOUND: "SkuNotFound",
	ErrorCode.SKU_OFFER_MISMATCH: "SkuOfferMismatch",
	ErrorCode.ITEM_NOT_OWNED: "ItemNotOwned",
	ErrorCode.BILLING_UNAVAILABLE: "BillingUnavailable",
	ErrorCode.FEATURE_NOT_SUPPORTED: "FeatureNotSupported",
	ErrorCode.EMPTY_SKU_LIST: "EmptySkuList"
}

const EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES = {
	ExternalLinkLaunchModeAndroid.UNSPECIFIED: "UNSPECIFIED",
	ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP: "LAUNCH_IN_EXTERNAL_BROWSER_OR_APP",
	ExternalLinkLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK: "CALLER_WILL_LAUNCH_LINK"
}

const EXTERNAL_LINK_TYPE_ANDROID_VALUES = {
	ExternalLinkTypeAndroid.UNSPECIFIED: "UNSPECIFIED",
	ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER: "LINK_TO_DIGITAL_CONTENT_OFFER",
	ExternalLinkTypeAndroid.LINK_TO_APP_DOWNLOAD: "LINK_TO_APP_DOWNLOAD"
}

const EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES = {
	ExternalPurchaseNoticeAction.CONTINUE: "Continue",
	ExternalPurchaseNoticeAction.DISMISSED: "Dismissed"
}

const IAP_EVENT_VALUES = {
	IapEvent.PURCHASE_UPDATED: "PurchaseUpdated",
	IapEvent.PURCHASE_ERROR: "PurchaseError",
	IapEvent.PROMOTED_PRODUCT_IOS: "PromotedProductIOS",
	IapEvent.USER_CHOICE_BILLING_ANDROID: "UserChoiceBillingAndroid",
	IapEvent.DEVELOPER_PROVIDED_BILLING_ANDROID: "DeveloperProvidedBillingAndroid"
}

const IAPKIT_PURCHASE_STATE_VALUES = {
	IapkitPurchaseState.ENTITLED: "ENTITLED",
	IapkitPurchaseState.PENDING_ACKNOWLEDGMENT: "PENDING_ACKNOWLEDGMENT",
	IapkitPurchaseState.PENDING: "PENDING",
	IapkitPurchaseState.CANCELED: "CANCELED",
	IapkitPurchaseState.EXPIRED: "EXPIRED",
	IapkitPurchaseState.READY_TO_CONSUME: "READY_TO_CONSUME",
	IapkitPurchaseState.CONSUMED: "CONSUMED",
	IapkitPurchaseState.UNKNOWN: "UNKNOWN",
	IapkitPurchaseState.INAUTHENTIC: "INAUTHENTIC"
}

const IAP_PLATFORM_VALUES = {
	IapPlatform.IOS: "IOS",
	IapPlatform.ANDROID: "Android"
}

const IAP_STORE_VALUES = {
	IapStore.UNKNOWN: "Unknown",
	IapStore.APPLE: "Apple",
	IapStore.GOOGLE: "Google",
	IapStore.HORIZON: "Horizon"
}

const PAYMENT_MODE_IOS_VALUES = {
	PaymentModeIOS.EMPTY: "Empty",
	PaymentModeIOS.FREE_TRIAL: "FreeTrial",
	PaymentModeIOS.PAY_AS_YOU_GO: "PayAsYouGo",
	PaymentModeIOS.PAY_UP_FRONT: "PayUpFront"
}

const PRODUCT_QUERY_TYPE_VALUES = {
	ProductQueryType.IN_APP: "InApp",
	ProductQueryType.SUBS: "Subs",
	ProductQueryType.ALL: "All"
}

const PRODUCT_TYPE_VALUES = {
	ProductType.IN_APP: "InApp",
	ProductType.SUBS: "Subs"
}

const PRODUCT_TYPE_IOS_VALUES = {
	ProductTypeIOS.CONSUMABLE: "Consumable",
	ProductTypeIOS.NON_CONSUMABLE: "NonConsumable",
	ProductTypeIOS.AUTO_RENEWABLE_SUBSCRIPTION: "AutoRenewableSubscription",
	ProductTypeIOS.NON_RENEWING_SUBSCRIPTION: "NonRenewingSubscription"
}

const PURCHASE_STATE_VALUES = {
	PurchaseState.PENDING: "Pending",
	PurchaseState.PURCHASED: "Purchased",
	PurchaseState.UNKNOWN: "Unknown"
}

const PURCHASE_VERIFICATION_PROVIDER_VALUES = {
	PurchaseVerificationProvider.IAPKIT: "Iapkit"
}

const SUBSCRIPTION_OFFER_TYPE_IOS_VALUES = {
	SubscriptionOfferTypeIOS.INTRODUCTORY: "Introductory",
	SubscriptionOfferTypeIOS.PROMOTIONAL: "Promotional"
}

const SUBSCRIPTION_PERIOD_IOS_VALUES = {
	SubscriptionPeriodIOS.DAY: "Day",
	SubscriptionPeriodIOS.WEEK: "Week",
	SubscriptionPeriodIOS.MONTH: "Month",
	SubscriptionPeriodIOS.YEAR: "Year",
	SubscriptionPeriodIOS.EMPTY: "Empty"
}

const SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES = {
	SubscriptionReplacementModeAndroid.UNKNOWN_REPLACEMENT_MODE: "UNKNOWN_REPLACEMENT_MODE",
	SubscriptionReplacementModeAndroid.WITH_TIME_PRORATION: "WITH_TIME_PRORATION",
	SubscriptionReplacementModeAndroid.CHARGE_PRORATED_PRICE: "CHARGE_PRORATED_PRICE",
	SubscriptionReplacementModeAndroid.CHARGE_FULL_PRICE: "CHARGE_FULL_PRICE",
	SubscriptionReplacementModeAndroid.WITHOUT_PRORATION: "WITHOUT_PRORATION",
	SubscriptionReplacementModeAndroid.DEFERRED: "DEFERRED",
	SubscriptionReplacementModeAndroid.KEEP_EXISTING: "KEEP_EXISTING"
}
