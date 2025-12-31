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
		if data.has("productId"):
			obj.product_id = data["productId"]
		if data.has("isActive"):
			obj.is_active = data["isActive"]
		if data.has("expirationDateIOS"):
			obj.expiration_date_ios = data["expirationDateIOS"]
		if data.has("autoRenewingAndroid"):
			obj.auto_renewing_android = data["autoRenewingAndroid"]
		if data.has("environmentIOS"):
			obj.environment_ios = data["environmentIOS"]
		if data.has("willExpireSoon"):
			obj.will_expire_soon = data["willExpireSoon"]
		if data.has("daysUntilExpirationIOS"):
			obj.days_until_expiration_ios = data["daysUntilExpirationIOS"]
		if data.has("transactionId"):
			obj.transaction_id = data["transactionId"]
		if data.has("purchaseToken"):
			obj.purchase_token = data["purchaseToken"]
		if data.has("transactionDate"):
			obj.transaction_date = data["transactionDate"]
		if data.has("basePlanIdAndroid"):
			obj.base_plan_id_android = data["basePlanIdAndroid"]
		if data.has("purchaseTokenAndroid"):
			obj.purchase_token_android = data["purchaseTokenAndroid"]
		if data.has("currentPlanId"):
			obj.current_plan_id = data["currentPlanId"]
		if data.has("renewalInfoIOS"):
			obj.renewal_info_ios = data["renewalInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"productId": product_id,
			"isActive": is_active,
			"expirationDateIOS": expiration_date_ios,
			"autoRenewingAndroid": auto_renewing_android,
			"environmentIOS": environment_ios,
			"willExpireSoon": will_expire_soon,
			"daysUntilExpirationIOS": days_until_expiration_ios,
			"transactionId": transaction_id,
			"purchaseToken": purchase_token,
			"transactionDate": transaction_date,
			"basePlanIdAndroid": base_plan_id_android,
			"purchaseTokenAndroid": purchase_token_android,
			"currentPlanId": current_plan_id,
			"renewalInfoIOS": renewal_info_ios
		}

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
		if data.has("bundleId"):
			obj.bundle_id = data["bundleId"]
		if data.has("appVersion"):
			obj.app_version = data["appVersion"]
		if data.has("originalAppVersion"):
			obj.original_app_version = data["originalAppVersion"]
		if data.has("originalPurchaseDate"):
			obj.original_purchase_date = data["originalPurchaseDate"]
		if data.has("deviceVerification"):
			obj.device_verification = data["deviceVerification"]
		if data.has("deviceVerificationNonce"):
			obj.device_verification_nonce = data["deviceVerificationNonce"]
		if data.has("environment"):
			obj.environment = data["environment"]
		if data.has("signedDate"):
			obj.signed_date = data["signedDate"]
		if data.has("appId"):
			obj.app_id = data["appId"]
		if data.has("appVersionId"):
			obj.app_version_id = data["appVersionId"]
		if data.has("preorderDate"):
			obj.preorder_date = data["preorderDate"]
		if data.has("appTransactionId"):
			obj.app_transaction_id = data["appTransactionId"]
		if data.has("originalPlatform"):
			obj.original_platform = data["originalPlatform"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"bundleId": bundle_id,
			"appVersion": app_version,
			"originalAppVersion": original_app_version,
			"originalPurchaseDate": original_purchase_date,
			"deviceVerification": device_verification,
			"deviceVerificationNonce": device_verification_nonce,
			"environment": environment,
			"signedDate": signed_date,
			"appId": app_id,
			"appVersionId": app_version_id,
			"preorderDate": preorder_date,
			"appTransactionId": app_transaction_id,
			"originalPlatform": original_platform
		}

## Result of checking billing program availability (Android) Available in Google Play Billing Library 8.2.0+
class BillingProgramAvailabilityResultAndroid:
	## Whether the billing program is available for the user
	var is_available: bool
	## The billing program that was checked
	var billing_program: BillingProgramAndroid

	static func from_dict(data: Dictionary) -> BillingProgramAvailabilityResultAndroid:
		var obj = BillingProgramAvailabilityResultAndroid.new()
		if data.has("isAvailable"):
			obj.is_available = data["isAvailable"]
		if data.has("billingProgram"):
			obj.billing_program = data["billingProgram"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"isAvailable": is_available,
			"billingProgram": billing_program
		}

## Reporting details for transactions made outside of Google Play Billing (Android) Contains the external transaction token needed for reporting Available in Google Play Billing Library 8.2.0+
class BillingProgramReportingDetailsAndroid:
	## The billing program that the reporting details are associated with
	var billing_program: BillingProgramAndroid
	## External transaction token used to report transactions made outside of Google Play Billing.
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> BillingProgramReportingDetailsAndroid:
		var obj = BillingProgramReportingDetailsAndroid.new()
		if data.has("billingProgram"):
			obj.billing_program = data["billingProgram"]
		if data.has("externalTransactionToken"):
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"billingProgram": billing_program,
			"externalTransactionToken": external_transaction_token
		}

## Details provided when user selects developer billing option (Android) Received via DeveloperProvidedBillingListener callback Available in Google Play Billing Library 8.3.0+
class DeveloperProvidedBillingDetailsAndroid:
	## External transaction token used to report transactions made through developer billing.
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> DeveloperProvidedBillingDetailsAndroid:
		var obj = DeveloperProvidedBillingDetailsAndroid.new()
		if data.has("externalTransactionToken"):
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"externalTransactionToken": external_transaction_token
		}

## Discount amount details for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class DiscountAmountAndroid:
	## Discount amount in micro-units (1,000,000 = 1 unit of currency)
	var discount_amount_micros: String
	## Formatted discount amount with currency sign (e.g., "$4.99")
	var formatted_discount_amount: String

	static func from_dict(data: Dictionary) -> DiscountAmountAndroid:
		var obj = DiscountAmountAndroid.new()
		if data.has("discountAmountMicros"):
			obj.discount_amount_micros = data["discountAmountMicros"]
		if data.has("formattedDiscountAmount"):
			obj.formatted_discount_amount = data["formattedDiscountAmount"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"discountAmountMicros": discount_amount_micros,
			"formattedDiscountAmount": formatted_discount_amount
		}

## Discount display information for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class DiscountDisplayInfoAndroid:
	## Percentage discount (e.g., 33 for 33% off)
	var percentage_discount: int
	## Absolute discount amount details
	var discount_amount: DiscountAmountAndroid

	static func from_dict(data: Dictionary) -> DiscountDisplayInfoAndroid:
		var obj = DiscountDisplayInfoAndroid.new()
		if data.has("percentageDiscount"):
			obj.percentage_discount = data["percentageDiscount"]
		if data.has("discountAmount"):
			obj.discount_amount = data["discountAmount"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"percentageDiscount": percentage_discount,
			"discountAmount": discount_amount
		}

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
		if data.has("identifier"):
			obj.identifier = data["identifier"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("numberOfPeriods"):
			obj.number_of_periods = data["numberOfPeriods"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("priceAmount"):
			obj.price_amount = data["priceAmount"]
		if data.has("paymentMode"):
			obj.payment_mode = data["paymentMode"]
		if data.has("subscriptionPeriod"):
			obj.subscription_period = data["subscriptionPeriod"]
		if data.has("localizedPrice"):
			obj.localized_price = data["localizedPrice"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"identifier": identifier,
			"type": type,
			"numberOfPeriods": number_of_periods,
			"price": price,
			"priceAmount": price_amount,
			"paymentMode": payment_mode,
			"subscriptionPeriod": subscription_period,
			"localizedPrice": localized_price
		}

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
		if data.has("identifier"):
			obj.identifier = data["identifier"]
		if data.has("keyIdentifier"):
			obj.key_identifier = data["keyIdentifier"]
		if data.has("nonce"):
			obj.nonce = data["nonce"]
		if data.has("signature"):
			obj.signature = data["signature"]
		if data.has("timestamp"):
			obj.timestamp = data["timestamp"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"identifier": identifier,
			"keyIdentifier": key_identifier,
			"nonce": nonce,
			"signature": signature,
			"timestamp": timestamp
		}

class EntitlementIOS:
	var sku: String
	var transaction_id: String
	var json_representation: String

	static func from_dict(data: Dictionary) -> EntitlementIOS:
		var obj = EntitlementIOS.new()
		if data.has("sku"):
			obj.sku = data["sku"]
		if data.has("transactionId"):
			obj.transaction_id = data["transactionId"]
		if data.has("jsonRepresentation"):
			obj.json_representation = data["jsonRepresentation"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"sku": sku,
			"transactionId": transaction_id,
			"jsonRepresentation": json_representation
		}

## External offer availability result (Android) @deprecated Use BillingProgramAvailabilityResultAndroid with isBillingProgramAvailableAsync instead Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
class ExternalOfferAvailabilityResultAndroid:
	## Whether external offers are available for the user
	var is_available: bool

	static func from_dict(data: Dictionary) -> ExternalOfferAvailabilityResultAndroid:
		var obj = ExternalOfferAvailabilityResultAndroid.new()
		if data.has("isAvailable"):
			obj.is_available = data["isAvailable"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"isAvailable": is_available
		}

## External offer reporting details (Android) @deprecated Use BillingProgramReportingDetailsAndroid with createBillingProgramReportingDetailsAsync instead Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
class ExternalOfferReportingDetailsAndroid:
	## External transaction token for reporting external offer transactions
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> ExternalOfferReportingDetailsAndroid:
		var obj = ExternalOfferReportingDetailsAndroid.new()
		if data.has("externalTransactionToken"):
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"externalTransactionToken": external_transaction_token
		}

## Result of presenting an external purchase link (iOS 18.2+)
class ExternalPurchaseLinkResultIOS:
	## Whether the user completed the external purchase flow
	var success: bool
	## Optional error message if the presentation failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseLinkResultIOS:
		var obj = ExternalPurchaseLinkResultIOS.new()
		if data.has("success"):
			obj.success = data["success"]
		if data.has("error"):
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"success": success,
			"error": error
		}

## Result of presenting external purchase notice sheet (iOS 18.2+)
class ExternalPurchaseNoticeResultIOS:
	## Notice result indicating user action
	var result: ExternalPurchaseNoticeAction
	## Optional error message if the presentation failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseNoticeResultIOS:
		var obj = ExternalPurchaseNoticeResultIOS.new()
		if data.has("result"):
			obj.result = data["result"]
		if data.has("error"):
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"result": result,
			"error": error
		}

## Limited quantity information for one-time purchase offers (Android) Available in Google Play Billing Library 7.0+
class LimitedQuantityInfoAndroid:
	## Maximum quantity a user can purchase
	var maximum_quantity: int
	## Remaining quantity the user can still purchase
	var remaining_quantity: int

	static func from_dict(data: Dictionary) -> LimitedQuantityInfoAndroid:
		var obj = LimitedQuantityInfoAndroid.new()
		if data.has("maximumQuantity"):
			obj.maximum_quantity = data["maximumQuantity"]
		if data.has("remainingQuantity"):
			obj.remaining_quantity = data["remainingQuantity"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"maximumQuantity": maximum_quantity,
			"remainingQuantity": remaining_quantity
		}

## Pre-order details for one-time purchase products (Android) Available in Google Play Billing Library 8.1.0+
class PreorderDetailsAndroid:
	## Pre-order presale end time in milliseconds since epoch.
	var preorder_presale_end_time_millis: String
	## Pre-order release time in milliseconds since epoch.
	var preorder_release_time_millis: String

	static func from_dict(data: Dictionary) -> PreorderDetailsAndroid:
		var obj = PreorderDetailsAndroid.new()
		if data.has("preorderPresaleEndTimeMillis"):
			obj.preorder_presale_end_time_millis = data["preorderPresaleEndTimeMillis"]
		if data.has("preorderReleaseTimeMillis"):
			obj.preorder_release_time_millis = data["preorderReleaseTimeMillis"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"preorderPresaleEndTimeMillis": preorder_presale_end_time_millis,
			"preorderReleaseTimeMillis": preorder_release_time_millis
		}

class PricingPhaseAndroid:
	var formatted_price: String
	var price_currency_code: String
	var billing_period: String
	var billing_cycle_count: int
	var price_amount_micros: String
	var recurrence_mode: int

	static func from_dict(data: Dictionary) -> PricingPhaseAndroid:
		var obj = PricingPhaseAndroid.new()
		if data.has("formattedPrice"):
			obj.formatted_price = data["formattedPrice"]
		if data.has("priceCurrencyCode"):
			obj.price_currency_code = data["priceCurrencyCode"]
		if data.has("billingPeriod"):
			obj.billing_period = data["billingPeriod"]
		if data.has("billingCycleCount"):
			obj.billing_cycle_count = data["billingCycleCount"]
		if data.has("priceAmountMicros"):
			obj.price_amount_micros = data["priceAmountMicros"]
		if data.has("recurrenceMode"):
			obj.recurrence_mode = data["recurrenceMode"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"formattedPrice": formatted_price,
			"priceCurrencyCode": price_currency_code,
			"billingPeriod": billing_period,
			"billingCycleCount": billing_cycle_count,
			"priceAmountMicros": price_amount_micros,
			"recurrenceMode": recurrence_mode
		}

class PricingPhasesAndroid:
	var pricing_phase_list: Array[PricingPhaseAndroid]

	static func from_dict(data: Dictionary) -> PricingPhasesAndroid:
		var obj = PricingPhasesAndroid.new()
		if data.has("pricingPhaseList"):
			obj.pricing_phase_list = data["pricingPhaseList"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"pricingPhaseList": pricing_phase_list
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("title"):
			obj.title = data["title"]
		if data.has("description"):
			obj.description = data["description"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("displayName"):
			obj.display_name = data["displayName"]
		if data.has("displayPrice"):
			obj.display_price = data["displayPrice"]
		if data.has("currency"):
			obj.currency = data["currency"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("debugDescription"):
			obj.debug_description = data["debugDescription"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("nameAndroid"):
			obj.name_android = data["nameAndroid"]
		if data.has("oneTimePurchaseOfferDetailsAndroid"):
			obj.one_time_purchase_offer_details_android = data["oneTimePurchaseOfferDetailsAndroid"]
		if data.has("subscriptionOfferDetailsAndroid"):
			obj.subscription_offer_details_android = data["subscriptionOfferDetailsAndroid"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"title": title,
			"description": description,
			"type": type,
			"displayName": display_name,
			"displayPrice": display_price,
			"currency": currency,
			"price": price,
			"debugDescription": debug_description,
			"platform": platform,
			"nameAndroid": name_android,
			"oneTimePurchaseOfferDetailsAndroid": one_time_purchase_offer_details_android,
			"subscriptionOfferDetailsAndroid": subscription_offer_details_android
		}

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
		if data.has("offerId"):
			obj.offer_id = data["offerId"]
		if data.has("offerToken"):
			obj.offer_token = data["offerToken"]
		if data.has("offerTags"):
			obj.offer_tags = data["offerTags"]
		if data.has("priceCurrencyCode"):
			obj.price_currency_code = data["priceCurrencyCode"]
		if data.has("formattedPrice"):
			obj.formatted_price = data["formattedPrice"]
		if data.has("priceAmountMicros"):
			obj.price_amount_micros = data["priceAmountMicros"]
		if data.has("fullPriceMicros"):
			obj.full_price_micros = data["fullPriceMicros"]
		if data.has("discountDisplayInfo"):
			obj.discount_display_info = data["discountDisplayInfo"]
		if data.has("validTimeWindow"):
			obj.valid_time_window = data["validTimeWindow"]
		if data.has("limitedQuantityInfo"):
			obj.limited_quantity_info = data["limitedQuantityInfo"]
		if data.has("preorderDetailsAndroid"):
			obj.preorder_details_android = data["preorderDetailsAndroid"]
		if data.has("rentalDetailsAndroid"):
			obj.rental_details_android = data["rentalDetailsAndroid"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"offerId": offer_id,
			"offerToken": offer_token,
			"offerTags": offer_tags,
			"priceCurrencyCode": price_currency_code,
			"formattedPrice": formatted_price,
			"priceAmountMicros": price_amount_micros,
			"fullPriceMicros": full_price_micros,
			"discountDisplayInfo": discount_display_info,
			"validTimeWindow": valid_time_window,
			"limitedQuantityInfo": limited_quantity_info,
			"preorderDetailsAndroid": preorder_details_android,
			"rentalDetailsAndroid": rental_details_android
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("title"):
			obj.title = data["title"]
		if data.has("description"):
			obj.description = data["description"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("displayName"):
			obj.display_name = data["displayName"]
		if data.has("displayPrice"):
			obj.display_price = data["displayPrice"]
		if data.has("currency"):
			obj.currency = data["currency"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("debugDescription"):
			obj.debug_description = data["debugDescription"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("displayNameIOS"):
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS"):
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS"):
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("subscriptionInfoIOS"):
			obj.subscription_info_ios = data["subscriptionInfoIOS"]
		if data.has("typeIOS"):
			obj.type_ios = data["typeIOS"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"title": title,
			"description": description,
			"type": type,
			"displayName": display_name,
			"displayPrice": display_price,
			"currency": currency,
			"price": price,
			"debugDescription": debug_description,
			"platform": platform,
			"displayNameIOS": display_name_ios,
			"isFamilyShareableIOS": is_family_shareable_ios,
			"jsonRepresentationIOS": json_representation_ios,
			"subscriptionInfoIOS": subscription_info_ios,
			"typeIOS": type_ios
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("title"):
			obj.title = data["title"]
		if data.has("description"):
			obj.description = data["description"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("displayName"):
			obj.display_name = data["displayName"]
		if data.has("displayPrice"):
			obj.display_price = data["displayPrice"]
		if data.has("currency"):
			obj.currency = data["currency"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("debugDescription"):
			obj.debug_description = data["debugDescription"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("nameAndroid"):
			obj.name_android = data["nameAndroid"]
		if data.has("oneTimePurchaseOfferDetailsAndroid"):
			obj.one_time_purchase_offer_details_android = data["oneTimePurchaseOfferDetailsAndroid"]
		if data.has("subscriptionOfferDetailsAndroid"):
			obj.subscription_offer_details_android = data["subscriptionOfferDetailsAndroid"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"title": title,
			"description": description,
			"type": type,
			"displayName": display_name,
			"displayPrice": display_price,
			"currency": currency,
			"price": price,
			"debugDescription": debug_description,
			"platform": platform,
			"nameAndroid": name_android,
			"oneTimePurchaseOfferDetailsAndroid": one_time_purchase_offer_details_android,
			"subscriptionOfferDetailsAndroid": subscription_offer_details_android
		}

class ProductSubscriptionAndroidOfferDetails:
	var base_plan_id: String
	var offer_id: String
	var offer_token: String
	var offer_tags: Array[String]
	var pricing_phases: PricingPhasesAndroid

	static func from_dict(data: Dictionary) -> ProductSubscriptionAndroidOfferDetails:
		var obj = ProductSubscriptionAndroidOfferDetails.new()
		if data.has("basePlanId"):
			obj.base_plan_id = data["basePlanId"]
		if data.has("offerId"):
			obj.offer_id = data["offerId"]
		if data.has("offerToken"):
			obj.offer_token = data["offerToken"]
		if data.has("offerTags"):
			obj.offer_tags = data["offerTags"]
		if data.has("pricingPhases"):
			obj.pricing_phases = data["pricingPhases"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"basePlanId": base_plan_id,
			"offerId": offer_id,
			"offerToken": offer_token,
			"offerTags": offer_tags,
			"pricingPhases": pricing_phases
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("title"):
			obj.title = data["title"]
		if data.has("description"):
			obj.description = data["description"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("displayName"):
			obj.display_name = data["displayName"]
		if data.has("displayPrice"):
			obj.display_price = data["displayPrice"]
		if data.has("currency"):
			obj.currency = data["currency"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("debugDescription"):
			obj.debug_description = data["debugDescription"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("displayNameIOS"):
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS"):
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS"):
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("subscriptionInfoIOS"):
			obj.subscription_info_ios = data["subscriptionInfoIOS"]
		if data.has("typeIOS"):
			obj.type_ios = data["typeIOS"]
		if data.has("discountsIOS"):
			obj.discounts_ios = data["discountsIOS"]
		if data.has("introductoryPriceIOS"):
			obj.introductory_price_ios = data["introductoryPriceIOS"]
		if data.has("introductoryPriceAsAmountIOS"):
			obj.introductory_price_as_amount_ios = data["introductoryPriceAsAmountIOS"]
		if data.has("introductoryPricePaymentModeIOS"):
			obj.introductory_price_payment_mode_ios = data["introductoryPricePaymentModeIOS"]
		if data.has("introductoryPriceNumberOfPeriodsIOS"):
			obj.introductory_price_number_of_periods_ios = data["introductoryPriceNumberOfPeriodsIOS"]
		if data.has("introductoryPriceSubscriptionPeriodIOS"):
			obj.introductory_price_subscription_period_ios = data["introductoryPriceSubscriptionPeriodIOS"]
		if data.has("subscriptionPeriodNumberIOS"):
			obj.subscription_period_number_ios = data["subscriptionPeriodNumberIOS"]
		if data.has("subscriptionPeriodUnitIOS"):
			obj.subscription_period_unit_ios = data["subscriptionPeriodUnitIOS"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"title": title,
			"description": description,
			"type": type,
			"displayName": display_name,
			"displayPrice": display_price,
			"currency": currency,
			"price": price,
			"debugDescription": debug_description,
			"platform": platform,
			"displayNameIOS": display_name_ios,
			"isFamilyShareableIOS": is_family_shareable_ios,
			"jsonRepresentationIOS": json_representation_ios,
			"subscriptionInfoIOS": subscription_info_ios,
			"typeIOS": type_ios,
			"discountsIOS": discounts_ios,
			"introductoryPriceIOS": introductory_price_ios,
			"introductoryPriceAsAmountIOS": introductory_price_as_amount_ios,
			"introductoryPricePaymentModeIOS": introductory_price_payment_mode_ios,
			"introductoryPriceNumberOfPeriodsIOS": introductory_price_number_of_periods_ios,
			"introductoryPriceSubscriptionPeriodIOS": introductory_price_subscription_period_ios,
			"subscriptionPeriodNumberIOS": subscription_period_number_ios,
			"subscriptionPeriodUnitIOS": subscription_period_unit_ios
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("productId"):
			obj.product_id = data["productId"]
		if data.has("ids"):
			obj.ids = data["ids"]
		if data.has("transactionId"):
			obj.transaction_id = data["transactionId"]
		if data.has("transactionDate"):
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken"):
			obj.purchase_token = data["purchaseToken"]
		if data.has("store"):
			obj.store = data["store"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("quantity"):
			obj.quantity = data["quantity"]
		if data.has("purchaseState"):
			obj.purchase_state = data["purchaseState"]
		if data.has("isAutoRenewing"):
			obj.is_auto_renewing = data["isAutoRenewing"]
		if data.has("currentPlanId"):
			obj.current_plan_id = data["currentPlanId"]
		if data.has("dataAndroid"):
			obj.data_android = data["dataAndroid"]
		if data.has("signatureAndroid"):
			obj.signature_android = data["signatureAndroid"]
		if data.has("autoRenewingAndroid"):
			obj.auto_renewing_android = data["autoRenewingAndroid"]
		if data.has("isAcknowledgedAndroid"):
			obj.is_acknowledged_android = data["isAcknowledgedAndroid"]
		if data.has("packageNameAndroid"):
			obj.package_name_android = data["packageNameAndroid"]
		if data.has("developerPayloadAndroid"):
			obj.developer_payload_android = data["developerPayloadAndroid"]
		if data.has("obfuscatedAccountIdAndroid"):
			obj.obfuscated_account_id_android = data["obfuscatedAccountIdAndroid"]
		if data.has("obfuscatedProfileIdAndroid"):
			obj.obfuscated_profile_id_android = data["obfuscatedProfileIdAndroid"]
		if data.has("isSuspendedAndroid"):
			obj.is_suspended_android = data["isSuspendedAndroid"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"productId": product_id,
			"ids": ids,
			"transactionId": transaction_id,
			"transactionDate": transaction_date,
			"purchaseToken": purchase_token,
			"store": store,
			"platform": platform,
			"quantity": quantity,
			"purchaseState": purchase_state,
			"isAutoRenewing": is_auto_renewing,
			"currentPlanId": current_plan_id,
			"dataAndroid": data_android,
			"signatureAndroid": signature_android,
			"autoRenewingAndroid": auto_renewing_android,
			"isAcknowledgedAndroid": is_acknowledged_android,
			"packageNameAndroid": package_name_android,
			"developerPayloadAndroid": developer_payload_android,
			"obfuscatedAccountIdAndroid": obfuscated_account_id_android,
			"obfuscatedProfileIdAndroid": obfuscated_profile_id_android,
			"isSuspendedAndroid": is_suspended_android
		}

class PurchaseError:
	var code: ErrorCode
	var message: String
	var product_id: String

	static func from_dict(data: Dictionary) -> PurchaseError:
		var obj = PurchaseError.new()
		if data.has("code"):
			obj.code = data["code"]
		if data.has("message"):
			obj.message = data["message"]
		if data.has("productId"):
			obj.product_id = data["productId"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"code": code,
			"message": message,
			"productId": product_id
		}

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
		if data.has("id"):
			obj.id = data["id"]
		if data.has("productId"):
			obj.product_id = data["productId"]
		if data.has("ids"):
			obj.ids = data["ids"]
		if data.has("transactionDate"):
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken"):
			obj.purchase_token = data["purchaseToken"]
		if data.has("store"):
			obj.store = data["store"]
		if data.has("platform"):
			obj.platform = data["platform"]
		if data.has("quantity"):
			obj.quantity = data["quantity"]
		if data.has("purchaseState"):
			obj.purchase_state = data["purchaseState"]
		if data.has("isAutoRenewing"):
			obj.is_auto_renewing = data["isAutoRenewing"]
		if data.has("currentPlanId"):
			obj.current_plan_id = data["currentPlanId"]
		if data.has("transactionId"):
			obj.transaction_id = data["transactionId"]
		if data.has("quantityIOS"):
			obj.quantity_ios = data["quantityIOS"]
		if data.has("originalTransactionDateIOS"):
			obj.original_transaction_date_ios = data["originalTransactionDateIOS"]
		if data.has("originalTransactionIdentifierIOS"):
			obj.original_transaction_identifier_ios = data["originalTransactionIdentifierIOS"]
		if data.has("appAccountToken"):
			obj.app_account_token = data["appAccountToken"]
		if data.has("expirationDateIOS"):
			obj.expiration_date_ios = data["expirationDateIOS"]
		if data.has("webOrderLineItemIdIOS"):
			obj.web_order_line_item_id_ios = data["webOrderLineItemIdIOS"]
		if data.has("environmentIOS"):
			obj.environment_ios = data["environmentIOS"]
		if data.has("storefrontCountryCodeIOS"):
			obj.storefront_country_code_ios = data["storefrontCountryCodeIOS"]
		if data.has("appBundleIdIOS"):
			obj.app_bundle_id_ios = data["appBundleIdIOS"]
		if data.has("subscriptionGroupIdIOS"):
			obj.subscription_group_id_ios = data["subscriptionGroupIdIOS"]
		if data.has("isUpgradedIOS"):
			obj.is_upgraded_ios = data["isUpgradedIOS"]
		if data.has("ownershipTypeIOS"):
			obj.ownership_type_ios = data["ownershipTypeIOS"]
		if data.has("reasonIOS"):
			obj.reason_ios = data["reasonIOS"]
		if data.has("reasonStringRepresentationIOS"):
			obj.reason_string_representation_ios = data["reasonStringRepresentationIOS"]
		if data.has("transactionReasonIOS"):
			obj.transaction_reason_ios = data["transactionReasonIOS"]
		if data.has("revocationDateIOS"):
			obj.revocation_date_ios = data["revocationDateIOS"]
		if data.has("revocationReasonIOS"):
			obj.revocation_reason_ios = data["revocationReasonIOS"]
		if data.has("offerIOS"):
			obj.offer_ios = data["offerIOS"]
		if data.has("currencyCodeIOS"):
			obj.currency_code_ios = data["currencyCodeIOS"]
		if data.has("currencySymbolIOS"):
			obj.currency_symbol_ios = data["currencySymbolIOS"]
		if data.has("countryCodeIOS"):
			obj.country_code_ios = data["countryCodeIOS"]
		if data.has("renewalInfoIOS"):
			obj.renewal_info_ios = data["renewalInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"productId": product_id,
			"ids": ids,
			"transactionDate": transaction_date,
			"purchaseToken": purchase_token,
			"store": store,
			"platform": platform,
			"quantity": quantity,
			"purchaseState": purchase_state,
			"isAutoRenewing": is_auto_renewing,
			"currentPlanId": current_plan_id,
			"transactionId": transaction_id,
			"quantityIOS": quantity_ios,
			"originalTransactionDateIOS": original_transaction_date_ios,
			"originalTransactionIdentifierIOS": original_transaction_identifier_ios,
			"appAccountToken": app_account_token,
			"expirationDateIOS": expiration_date_ios,
			"webOrderLineItemIdIOS": web_order_line_item_id_ios,
			"environmentIOS": environment_ios,
			"storefrontCountryCodeIOS": storefront_country_code_ios,
			"appBundleIdIOS": app_bundle_id_ios,
			"subscriptionGroupIdIOS": subscription_group_id_ios,
			"isUpgradedIOS": is_upgraded_ios,
			"ownershipTypeIOS": ownership_type_ios,
			"reasonIOS": reason_ios,
			"reasonStringRepresentationIOS": reason_string_representation_ios,
			"transactionReasonIOS": transaction_reason_ios,
			"revocationDateIOS": revocation_date_ios,
			"revocationReasonIOS": revocation_reason_ios,
			"offerIOS": offer_ios,
			"currencyCodeIOS": currency_code_ios,
			"currencySymbolIOS": currency_symbol_ios,
			"countryCodeIOS": country_code_ios,
			"renewalInfoIOS": renewal_info_ios
		}

class PurchaseOfferIOS:
	var id: String
	var type: String
	var payment_mode: String

	static func from_dict(data: Dictionary) -> PurchaseOfferIOS:
		var obj = PurchaseOfferIOS.new()
		if data.has("id"):
			obj.id = data["id"]
		if data.has("type"):
			obj.type = data["type"]
		if data.has("paymentMode"):
			obj.payment_mode = data["paymentMode"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"id": id,
			"type": type,
			"paymentMode": payment_mode
		}

class RefundResultIOS:
	var status: String
	var message: String

	static func from_dict(data: Dictionary) -> RefundResultIOS:
		var obj = RefundResultIOS.new()
		if data.has("status"):
			obj.status = data["status"]
		if data.has("message"):
			obj.message = data["message"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"status": status,
			"message": message
		}

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
		if data.has("jsonRepresentation"):
			obj.json_representation = data["jsonRepresentation"]
		if data.has("willAutoRenew"):
			obj.will_auto_renew = data["willAutoRenew"]
		if data.has("autoRenewPreference"):
			obj.auto_renew_preference = data["autoRenewPreference"]
		if data.has("expirationReason"):
			obj.expiration_reason = data["expirationReason"]
		if data.has("gracePeriodExpirationDate"):
			obj.grace_period_expiration_date = data["gracePeriodExpirationDate"]
		if data.has("isInBillingRetry"):
			obj.is_in_billing_retry = data["isInBillingRetry"]
		if data.has("pendingUpgradeProductId"):
			obj.pending_upgrade_product_id = data["pendingUpgradeProductId"]
		if data.has("priceIncreaseStatus"):
			obj.price_increase_status = data["priceIncreaseStatus"]
		if data.has("renewalDate"):
			obj.renewal_date = data["renewalDate"]
		if data.has("renewalOfferId"):
			obj.renewal_offer_id = data["renewalOfferId"]
		if data.has("renewalOfferType"):
			obj.renewal_offer_type = data["renewalOfferType"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"jsonRepresentation": json_representation,
			"willAutoRenew": will_auto_renew,
			"autoRenewPreference": auto_renew_preference,
			"expirationReason": expiration_reason,
			"gracePeriodExpirationDate": grace_period_expiration_date,
			"isInBillingRetry": is_in_billing_retry,
			"pendingUpgradeProductId": pending_upgrade_product_id,
			"priceIncreaseStatus": price_increase_status,
			"renewalDate": renewal_date,
			"renewalOfferId": renewal_offer_id,
			"renewalOfferType": renewal_offer_type
		}

## Rental details for one-time purchase products that can be rented (Android) Available in Google Play Billing Library 7.0+
class RentalDetailsAndroid:
	## Rental period in ISO 8601 format (e.g., P7D for 7 days)
	var rental_period: String
	## Rental expiration period in ISO 8601 format
	var rental_expiration_period: String

	static func from_dict(data: Dictionary) -> RentalDetailsAndroid:
		var obj = RentalDetailsAndroid.new()
		if data.has("rentalPeriod"):
			obj.rental_period = data["rentalPeriod"]
		if data.has("rentalExpirationPeriod"):
			obj.rental_expiration_period = data["rentalExpirationPeriod"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"rentalPeriod": rental_period,
			"rentalExpirationPeriod": rental_expiration_period
		}

class RequestVerifyPurchaseWithIapkitResult:
	var store: IapStore
	## Whether the purchase is valid (not falsified).
	var is_valid: bool
	## The current state of the purchase.
	var state: IapkitPurchaseState

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitResult:
		var obj = RequestVerifyPurchaseWithIapkitResult.new()
		if data.has("store"):
			obj.store = data["store"]
		if data.has("isValid"):
			obj.is_valid = data["isValid"]
		if data.has("state"):
			obj.state = data["state"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"store": store,
			"isValid": is_valid,
			"state": state
		}

class SubscriptionInfoIOS:
	var introductory_offer: SubscriptionOfferIOS
	var promotional_offers: Array[SubscriptionOfferIOS]
	var subscription_group_id: String
	var subscription_period: SubscriptionPeriodValueIOS

	static func from_dict(data: Dictionary) -> SubscriptionInfoIOS:
		var obj = SubscriptionInfoIOS.new()
		if data.has("introductoryOffer"):
			obj.introductory_offer = data["introductoryOffer"]
		if data.has("promotionalOffers"):
			obj.promotional_offers = data["promotionalOffers"]
		if data.has("subscriptionGroupId"):
			obj.subscription_group_id = data["subscriptionGroupId"]
		if data.has("subscriptionPeriod"):
			obj.subscription_period = data["subscriptionPeriod"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"introductoryOffer": introductory_offer,
			"promotionalOffers": promotional_offers,
			"subscriptionGroupId": subscription_group_id,
			"subscriptionPeriod": subscription_period
		}

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
		if data.has("displayPrice"):
			obj.display_price = data["displayPrice"]
		if data.has("id"):
			obj.id = data["id"]
		if data.has("paymentMode"):
			obj.payment_mode = data["paymentMode"]
		if data.has("period"):
			obj.period = data["period"]
		if data.has("periodCount"):
			obj.period_count = data["periodCount"]
		if data.has("price"):
			obj.price = data["price"]
		if data.has("type"):
			obj.type = data["type"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"displayPrice": display_price,
			"id": id,
			"paymentMode": payment_mode,
			"period": period,
			"periodCount": period_count,
			"price": price,
			"type": type
		}

class SubscriptionPeriodValueIOS:
	var unit: SubscriptionPeriodIOS
	var value: int

	static func from_dict(data: Dictionary) -> SubscriptionPeriodValueIOS:
		var obj = SubscriptionPeriodValueIOS.new()
		if data.has("unit"):
			obj.unit = data["unit"]
		if data.has("value"):
			obj.value = data["value"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"unit": unit,
			"value": value
		}

class SubscriptionStatusIOS:
	var state: String
	var renewal_info: RenewalInfoIOS

	static func from_dict(data: Dictionary) -> SubscriptionStatusIOS:
		var obj = SubscriptionStatusIOS.new()
		if data.has("state"):
			obj.state = data["state"]
		if data.has("renewalInfo"):
			obj.renewal_info = data["renewalInfo"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"state": state,
			"renewalInfo": renewal_info
		}

## User Choice Billing event details (Android) Fired when a user selects alternative billing in the User Choice Billing dialog
class UserChoiceBillingDetails:
	## Token that must be reported to Google Play within 24 hours
	var external_transaction_token: String
	## List of product IDs selected by the user
	var products: Array[String]

	static func from_dict(data: Dictionary) -> UserChoiceBillingDetails:
		var obj = UserChoiceBillingDetails.new()
		if data.has("externalTransactionToken"):
			obj.external_transaction_token = data["externalTransactionToken"]
		if data.has("products"):
			obj.products = data["products"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"externalTransactionToken": external_transaction_token,
			"products": products
		}

## Valid time window for when an offer is available (Android) Available in Google Play Billing Library 7.0+
class ValidTimeWindowAndroid:
	## Start time in milliseconds since epoch
	var start_time_millis: String
	## End time in milliseconds since epoch
	var end_time_millis: String

	static func from_dict(data: Dictionary) -> ValidTimeWindowAndroid:
		var obj = ValidTimeWindowAndroid.new()
		if data.has("startTimeMillis"):
			obj.start_time_millis = data["startTimeMillis"]
		if data.has("endTimeMillis"):
			obj.end_time_millis = data["endTimeMillis"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"startTimeMillis": start_time_millis,
			"endTimeMillis": end_time_millis
		}

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
		if data.has("autoRenewing"):
			obj.auto_renewing = data["autoRenewing"]
		if data.has("betaProduct"):
			obj.beta_product = data["betaProduct"]
		if data.has("cancelDate"):
			obj.cancel_date = data["cancelDate"]
		if data.has("cancelReason"):
			obj.cancel_reason = data["cancelReason"]
		if data.has("deferredDate"):
			obj.deferred_date = data["deferredDate"]
		if data.has("deferredSku"):
			obj.deferred_sku = data["deferredSku"]
		if data.has("freeTrialEndDate"):
			obj.free_trial_end_date = data["freeTrialEndDate"]
		if data.has("gracePeriodEndDate"):
			obj.grace_period_end_date = data["gracePeriodEndDate"]
		if data.has("parentProductId"):
			obj.parent_product_id = data["parentProductId"]
		if data.has("productId"):
			obj.product_id = data["productId"]
		if data.has("productType"):
			obj.product_type = data["productType"]
		if data.has("purchaseDate"):
			obj.purchase_date = data["purchaseDate"]
		if data.has("quantity"):
			obj.quantity = data["quantity"]
		if data.has("receiptId"):
			obj.receipt_id = data["receiptId"]
		if data.has("renewalDate"):
			obj.renewal_date = data["renewalDate"]
		if data.has("term"):
			obj.term = data["term"]
		if data.has("termSku"):
			obj.term_sku = data["termSku"]
		if data.has("testTransaction"):
			obj.test_transaction = data["testTransaction"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"autoRenewing": auto_renewing,
			"betaProduct": beta_product,
			"cancelDate": cancel_date,
			"cancelReason": cancel_reason,
			"deferredDate": deferred_date,
			"deferredSku": deferred_sku,
			"freeTrialEndDate": free_trial_end_date,
			"gracePeriodEndDate": grace_period_end_date,
			"parentProductId": parent_product_id,
			"productId": product_id,
			"productType": product_type,
			"purchaseDate": purchase_date,
			"quantity": quantity,
			"receiptId": receipt_id,
			"renewalDate": renewal_date,
			"term": term,
			"termSku": term_sku,
			"testTransaction": test_transaction
		}

## Result from Meta Horizon verify_entitlement API. Returns verification status and grant time for the entitlement.
class VerifyPurchaseResultHorizon:
	## Whether the entitlement verification succeeded.
	var success: bool
	## Unix timestamp (seconds) when the entitlement was granted.
	var grant_time: float

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultHorizon:
		var obj = VerifyPurchaseResultHorizon.new()
		if data.has("success"):
			obj.success = data["success"]
		if data.has("grantTime"):
			obj.grant_time = data["grantTime"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"success": success,
			"grantTime": grant_time
		}

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
		if data.has("isValid"):
			obj.is_valid = data["isValid"]
		if data.has("receiptData"):
			obj.receipt_data = data["receiptData"]
		if data.has("jwsRepresentation"):
			obj.jws_representation = data["jwsRepresentation"]
		if data.has("latestTransaction"):
			obj.latest_transaction = data["latestTransaction"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"isValid": is_valid,
			"receiptData": receipt_data,
			"jwsRepresentation": jws_representation,
			"latestTransaction": latest_transaction
		}

class VerifyPurchaseWithProviderError:
	var message: String
	var code: String

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderError:
		var obj = VerifyPurchaseWithProviderError.new()
		if data.has("message"):
			obj.message = data["message"]
		if data.has("code"):
			obj.code = data["code"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"message": message,
			"code": code
		}

class VerifyPurchaseWithProviderResult:
	var provider: PurchaseVerificationProvider
	## IAPKit verification result
	var iapkit: RequestVerifyPurchaseWithIapkitResult
	## Error details if verification failed
	var errors: Array[VerifyPurchaseWithProviderError]

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderResult:
		var obj = VerifyPurchaseWithProviderResult.new()
		if data.has("provider"):
			obj.provider = data["provider"]
		if data.has("iapkit"):
			obj.iapkit = data["iapkit"]
		if data.has("errors"):
			obj.errors = data["errors"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"provider": provider,
			"iapkit": iapkit,
			"errors": errors
		}

class VoidResult:
	var success: bool

	static func from_dict(data: Dictionary) -> VoidResult:
		var obj = VoidResult.new()
		if data.has("success"):
			obj.success = data["success"]
		return obj

	func to_dict() -> Dictionary:
		return {
			"success": success
		}

# ============================================================================
# Input Types
# ============================================================================

class AndroidSubscriptionOfferInput:
	## Product SKU
	var sku: String
	## Offer token
	var offer_token: String

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

	func to_dict() -> Dictionary:
		var result = {}
		if request_purchase != null:
			result["requestPurchase"] = request_purchase
		if request_subscription != null:
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

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			result["apple"] = apple
		if google != null:
			result["google"] = google
		if ios != null:
			result["ios"] = ios
		if android != null:
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
			result["subscriptionOffers"] = subscription_offers
		if subscription_product_replacement_params != null:
			result["subscriptionProductReplacementParams"] = subscription_product_replacement_params
		if developer_billing_option != null:
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

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			result["apple"] = apple
		if google != null:
			result["google"] = google
		if ios != null:
			result["ios"] = ios
		if android != null:
			result["android"] = android
		return result

class RequestVerifyPurchaseWithIapkitAppleProps:
	## The JWS token returned with the purchase response.
	var jws: String

	func to_dict() -> Dictionary:
		var result = {}
		if jws != null:
			result["jws"] = jws
		return result

class RequestVerifyPurchaseWithIapkitGoogleProps:
	## The token provided to the user's device when the product or subscription was purchased.
	var purchase_token: String

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

	func to_dict() -> Dictionary:
		var result = {}
		if api_key != null:
			result["apiKey"] = api_key
		if apple != null:
			result["apple"] = apple
		if google != null:
			result["google"] = google
		return result

## Product-level subscription replacement parameters (Android) Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams Available in Google Play Billing Library 8.1.0+
class SubscriptionProductReplacementParamsAndroid:
	## The old product ID that needs to be replaced
	var old_product_id: String
	## The replacement mode for this product change
	var replacement_mode: SubscriptionReplacementModeAndroid

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

	func to_dict() -> Dictionary:
		var result = {}
		if apple != null:
			result["apple"] = apple
		if google != null:
			result["google"] = google
		if horizon != null:
			result["horizon"] = horizon
		return result

class VerifyPurchaseWithProviderProps:
	var provider: PurchaseVerificationProvider
	var iapkit: RequestVerifyPurchaseWithIapkitProps

	func to_dict() -> Dictionary:
		var result = {}
		if provider != null:
			result["provider"] = provider
		if iapkit != null:
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
