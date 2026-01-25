# ============================================================================
# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
# Generated from OpenIAP GraphQL schema (https://openiap.dev)
# Run `bun run generate` to regenerate this file.
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

## Discount offer type enumeration. Categorizes the type of discount or promotional offer.
enum DiscountOfferType {
	## Introductory offer for new subscribers (first-time purchase discount)
	INTRODUCTORY = 0,
	## Promotional offer for existing or returning subscribers
	PROMOTIONAL = 1,
	## One-time product discount (Android only, Google Play Billing 7.0+)
	ONE_TIME = 2,
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

## Notice types for ExternalPurchaseCustomLink (iOS 18.1+). Determines the style of disclosure notice to display. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/noticetype
enum ExternalPurchaseCustomLinkNoticeTypeIOS {
	## Notice type indicating external purchases will be displayed in a browser or destination of the app's choice.
	BROWSER = 0,
}

## Token types for ExternalPurchaseCustomLink (iOS 18.1+). Used to request different types of external purchase tokens for reporting to Apple. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
enum ExternalPurchaseCustomLinkTokenTypeIOS {
	## Token for customer acquisition tracking. Use this when a new customer makes their first purchase through external link.
	ACQUISITION = 0,
	## Token for ongoing services tracking. Use this for existing customers making additional purchases.
	SERVICES = 1,
}

## User actions on external purchase notice sheet (iOS 17.4+)
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

## Payment mode for subscription offers. Determines how the user pays during the offer period.
enum PaymentMode {
	## Free trial period - no charge during offer
	FREE_TRIAL = 0,
	## Pay each period at reduced price
	PAY_AS_YOU_GO = 1,
	## Pay full discounted amount upfront
	PAY_UP_FRONT = 2,
	## Unknown or unspecified payment mode
	UNKNOWN = 3,
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

## Status code for individual products returned from queryProductDetailsAsync (Android) Prior to 8.0, products that couldn't be fetched were simply not returned. With 8.0+, these products are returned with a status code explaining why. Available in Google Play Billing Library 8.0.0+
enum ProductStatusAndroid {
	## Product was successfully fetched
	OK = 0,
	## Product not found - the SKU doesn't exist in the Play Console
	NOT_FOUND = 1,
	## No offers available for the user - product exists but user is not eligible for any offers
	NO_OFFERS_AVAILABLE = 2,
	## Unknown error occurred while fetching the product
	UNKNOWN = 3,
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

## Sub-response codes for more granular purchase error information (Android) Available in Google Play Billing Library 8.0.0+
enum SubResponseCodeAndroid {
	## No specific sub-response code applies
	NO_APPLICABLE_SUB_RESPONSE_CODE = 0,
	## User's payment method has insufficient funds
	PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS = 1,
	## User doesn't meet subscription offer eligibility requirements
	USER_INELIGIBLE = 2,
}

enum SubscriptionOfferTypeIOS {
	INTRODUCTORY = 0,
	PROMOTIONAL = 1,
	## Win-back offer type (iOS 18+) Used to re-engage churned subscribers with a discount or free trial.
	WIN_BACK = 2,
}

enum SubscriptionPeriodIOS {
	DAY = 0,
	WEEK = 1,
	MONTH = 2,
	YEAR = 3,
	EMPTY = 4,
}

## Subscription period unit for cross-platform use.
enum SubscriptionPeriodUnit {
	DAY = 0,
	WEEK = 1,
	MONTH = 2,
	YEAR = 3,
	UNKNOWN = 4,
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
		var dict = {}
		dict["productId"] = product_id
		dict["isActive"] = is_active
		dict["expirationDateIOS"] = expiration_date_ios
		dict["autoRenewingAndroid"] = auto_renewing_android
		dict["environmentIOS"] = environment_ios
		dict["willExpireSoon"] = will_expire_soon
		dict["daysUntilExpirationIOS"] = days_until_expiration_ios
		dict["transactionId"] = transaction_id
		dict["purchaseToken"] = purchase_token
		dict["transactionDate"] = transaction_date
		dict["basePlanIdAndroid"] = base_plan_id_android
		dict["purchaseTokenAndroid"] = purchase_token_android
		dict["currentPlanId"] = current_plan_id
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			dict["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			dict["renewalInfoIOS"] = renewal_info_ios
		return dict

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
		var dict = {}
		dict["bundleId"] = bundle_id
		dict["appVersion"] = app_version
		dict["originalAppVersion"] = original_app_version
		dict["originalPurchaseDate"] = original_purchase_date
		dict["deviceVerification"] = device_verification
		dict["deviceVerificationNonce"] = device_verification_nonce
		dict["environment"] = environment
		dict["signedDate"] = signed_date
		dict["appId"] = app_id
		dict["appVersionId"] = app_version_id
		dict["preorderDate"] = preorder_date
		dict["appTransactionId"] = app_transaction_id
		dict["originalPlatform"] = original_platform
		return dict

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
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			else:
				obj.billing_program = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["isAvailable"] = is_available
		if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
			dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
		else:
			dict["billingProgram"] = billing_program
		return dict

## Reporting details for transactions made outside of Google Play Billing (Android) Contains the external transaction token needed for reporting Available in Google Play Billing Library 8.2.0+
class BillingProgramReportingDetailsAndroid:
	## The billing program that the reporting details are associated with
	var billing_program: BillingProgramAndroid
	## External transaction token used to report transactions made outside of Google Play Billing.
	var external_transaction_token: String

	static func from_dict(data: Dictionary) -> BillingProgramReportingDetailsAndroid:
		var obj = BillingProgramReportingDetailsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			else:
				obj.billing_program = enum_str
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
			dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
		else:
			dict["billingProgram"] = billing_program
		dict["externalTransactionToken"] = external_transaction_token
		return dict

## Extended billing result with sub-response code (Android) Available in Google Play Billing Library 8.0.0+
class BillingResultAndroid:
	## The response code from the billing operation
	var response_code: int
	## Debug message from the billing library
	var debug_message: String
	## Sub-response code for more granular error information (8.0+).
	var sub_response_code: SubResponseCodeAndroid

	static func from_dict(data: Dictionary) -> BillingResultAndroid:
		var obj = BillingResultAndroid.new()
		if data.has("responseCode") and data["responseCode"] != null:
			obj.response_code = data["responseCode"]
		if data.has("debugMessage") and data["debugMessage"] != null:
			obj.debug_message = data["debugMessage"]
		if data.has("subResponseCode") and data["subResponseCode"] != null:
			var enum_str = data["subResponseCode"]
			if enum_str is String and SUB_RESPONSE_CODE_ANDROID_FROM_STRING.has(enum_str):
				obj.sub_response_code = SUB_RESPONSE_CODE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.sub_response_code = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["responseCode"] = response_code
		dict["debugMessage"] = debug_message
		if SUB_RESPONSE_CODE_ANDROID_VALUES.has(sub_response_code):
			dict["subResponseCode"] = SUB_RESPONSE_CODE_ANDROID_VALUES[sub_response_code]
		else:
			dict["subResponseCode"] = sub_response_code
		return dict

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
		var dict = {}
		dict["externalTransactionToken"] = external_transaction_token
		return dict

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
		var dict = {}
		dict["discountAmountMicros"] = discount_amount_micros
		dict["formattedDiscountAmount"] = formatted_discount_amount
		return dict

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
		var dict = {}
		dict["percentageDiscount"] = percentage_discount
		if discount_amount != null and discount_amount.has_method("to_dict"):
			dict["discountAmount"] = discount_amount.to_dict()
		else:
			dict["discountAmount"] = discount_amount
		return dict

## Discount information returned from the store. @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. @see https://openiap.dev/docs/types#subscription-offer
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
			var enum_str = data["paymentMode"]
			if enum_str is String and PAYMENT_MODE_IOS_FROM_STRING.has(enum_str):
				obj.payment_mode = PAYMENT_MODE_IOS_FROM_STRING[enum_str]
			else:
				obj.payment_mode = enum_str
		if data.has("subscriptionPeriod") and data["subscriptionPeriod"] != null:
			obj.subscription_period = data["subscriptionPeriod"]
		if data.has("localizedPrice") and data["localizedPrice"] != null:
			obj.localized_price = data["localizedPrice"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["identifier"] = identifier
		dict["type"] = type
		dict["numberOfPeriods"] = number_of_periods
		dict["price"] = price
		dict["priceAmount"] = price_amount
		if PAYMENT_MODE_IOS_VALUES.has(payment_mode):
			dict["paymentMode"] = PAYMENT_MODE_IOS_VALUES[payment_mode]
		else:
			dict["paymentMode"] = payment_mode
		dict["subscriptionPeriod"] = subscription_period
		dict["localizedPrice"] = localized_price
		return dict

## Standardized one-time product discount offer. Provides a unified interface for one-time purchase discounts across platforms.  Currently supported on Android (Google Play Billing 7.0+). iOS does not support one-time purchase discounts in the same way.  @see https://openiap.dev/docs/features/discount
class DiscountOffer:
	## Unique identifier for the offer.
	var id: String
	## Formatted display price string (e.g., "$4.99")
	var display_price: String
	## Numeric price value
	var price: float
	## Currency code (ISO 4217, e.g., "USD")
	var currency: String
	## Type of discount offer
	var type: DiscountOfferType
	## [Android] Offer token required for purchase.
	var offer_token_android: String
	## [Android] List of tags associated with this offer.
	var offer_tags_android: Array[String]
	## [Android] Original full price in micro-units before discount.
	var full_price_micros_android: String
	## [Android] Percentage discount (e.g., 33 for 33% off).
	var percentage_discount_android: int
	## [Android] Fixed discount amount in micro-units.
	var discount_amount_micros_android: String
	## [Android] Formatted discount amount string (e.g., "$5.00 OFF").
	var formatted_discount_amount_android: String
	## [Android] Valid time window for the offer.
	var valid_time_window_android: ValidTimeWindowAndroid
	## [Android] Limited quantity information.
	var limited_quantity_info_android: LimitedQuantityInfoAndroid
	## [Android] Pre-order details if this is a pre-order offer.
	var preorder_details_android: PreorderDetailsAndroid
	## [Android] Rental details if this is a rental offer.
	var rental_details_android: RentalDetailsAndroid

	static func from_dict(data: Dictionary) -> DiscountOffer:
		var obj = DiscountOffer.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and DISCOUNT_OFFER_TYPE_FROM_STRING.has(enum_str):
				obj.type = DISCOUNT_OFFER_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
		if data.has("offerTokenAndroid") and data["offerTokenAndroid"] != null:
			obj.offer_token_android = data["offerTokenAndroid"]
		if data.has("offerTagsAndroid") and data["offerTagsAndroid"] != null:
			obj.offer_tags_android = data["offerTagsAndroid"]
		if data.has("fullPriceMicrosAndroid") and data["fullPriceMicrosAndroid"] != null:
			obj.full_price_micros_android = data["fullPriceMicrosAndroid"]
		if data.has("percentageDiscountAndroid") and data["percentageDiscountAndroid"] != null:
			obj.percentage_discount_android = data["percentageDiscountAndroid"]
		if data.has("discountAmountMicrosAndroid") and data["discountAmountMicrosAndroid"] != null:
			obj.discount_amount_micros_android = data["discountAmountMicrosAndroid"]
		if data.has("formattedDiscountAmountAndroid") and data["formattedDiscountAmountAndroid"] != null:
			obj.formatted_discount_amount_android = data["formattedDiscountAmountAndroid"]
		if data.has("validTimeWindowAndroid") and data["validTimeWindowAndroid"] != null:
			if data["validTimeWindowAndroid"] is Dictionary:
				obj.valid_time_window_android = ValidTimeWindowAndroid.from_dict(data["validTimeWindowAndroid"])
			else:
				obj.valid_time_window_android = data["validTimeWindowAndroid"]
		if data.has("limitedQuantityInfoAndroid") and data["limitedQuantityInfoAndroid"] != null:
			if data["limitedQuantityInfoAndroid"] is Dictionary:
				obj.limited_quantity_info_android = LimitedQuantityInfoAndroid.from_dict(data["limitedQuantityInfoAndroid"])
			else:
				obj.limited_quantity_info_android = data["limitedQuantityInfoAndroid"]
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
		var dict = {}
		dict["id"] = id
		dict["displayPrice"] = display_price
		dict["price"] = price
		dict["currency"] = currency
		if DISCOUNT_OFFER_TYPE_VALUES.has(type):
			dict["type"] = DISCOUNT_OFFER_TYPE_VALUES[type]
		else:
			dict["type"] = type
		dict["offerTokenAndroid"] = offer_token_android
		dict["offerTagsAndroid"] = offer_tags_android
		dict["fullPriceMicrosAndroid"] = full_price_micros_android
		dict["percentageDiscountAndroid"] = percentage_discount_android
		dict["discountAmountMicrosAndroid"] = discount_amount_micros_android
		dict["formattedDiscountAmountAndroid"] = formatted_discount_amount_android
		if valid_time_window_android != null and valid_time_window_android.has_method("to_dict"):
			dict["validTimeWindowAndroid"] = valid_time_window_android.to_dict()
		else:
			dict["validTimeWindowAndroid"] = valid_time_window_android
		if limited_quantity_info_android != null and limited_quantity_info_android.has_method("to_dict"):
			dict["limitedQuantityInfoAndroid"] = limited_quantity_info_android.to_dict()
		else:
			dict["limitedQuantityInfoAndroid"] = limited_quantity_info_android
		if preorder_details_android != null and preorder_details_android.has_method("to_dict"):
			dict["preorderDetailsAndroid"] = preorder_details_android.to_dict()
		else:
			dict["preorderDetailsAndroid"] = preorder_details_android
		if rental_details_android != null and rental_details_android.has_method("to_dict"):
			dict["rentalDetailsAndroid"] = rental_details_android.to_dict()
		else:
			dict["rentalDetailsAndroid"] = rental_details_android
		return dict

## iOS DiscountOffer (output type). @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. @see https://openiap.dev/docs/types#subscription-offer
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
		var dict = {}
		dict["identifier"] = identifier
		dict["keyIdentifier"] = key_identifier
		dict["nonce"] = nonce
		dict["signature"] = signature
		dict["timestamp"] = timestamp
		return dict

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
		var dict = {}
		dict["sku"] = sku
		dict["transactionId"] = transaction_id
		dict["jsonRepresentation"] = json_representation
		return dict

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
		var dict = {}
		dict["isAvailable"] = is_available
		return dict

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
		var dict = {}
		dict["externalTransactionToken"] = external_transaction_token
		return dict

## Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).
class ExternalPurchaseCustomLinkNoticeResultIOS:
	## Whether the user chose to continue to external purchase
	var continued: bool
	## Optional error message if the presentation failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseCustomLinkNoticeResultIOS:
		var obj = ExternalPurchaseCustomLinkNoticeResultIOS.new()
		if data.has("continued") and data["continued"] != null:
			obj.continued = data["continued"]
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["continued"] = continued
		dict["error"] = error
		return dict

## Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).
class ExternalPurchaseCustomLinkTokenResultIOS:
	## The external purchase token string.
	var token: String
	## Optional error message if token retrieval failed
	var error: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseCustomLinkTokenResultIOS:
		var obj = ExternalPurchaseCustomLinkTokenResultIOS.new()
		if data.has("token") and data["token"] != null:
			obj.token = data["token"]
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["token"] = token
		dict["error"] = error
		return dict

## Result of presenting an external purchase link
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
		var dict = {}
		dict["success"] = success
		dict["error"] = error
		return dict

## Result of presenting external purchase notice sheet (iOS 17.4+) Returns the token when user continues to external purchase.
class ExternalPurchaseNoticeResultIOS:
	## Notice result indicating user action
	var result: ExternalPurchaseNoticeAction
	## Optional error message if the presentation failed
	var error: String
	## External purchase token returned when user continues (iOS 17.4+).
	var external_purchase_token: String

	static func from_dict(data: Dictionary) -> ExternalPurchaseNoticeResultIOS:
		var obj = ExternalPurchaseNoticeResultIOS.new()
		if data.has("result") and data["result"] != null:
			var enum_str = data["result"]
			if enum_str is String and EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING.has(enum_str):
				obj.result = EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING[enum_str]
			else:
				obj.result = enum_str
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		if data.has("externalPurchaseToken") and data["externalPurchaseToken"] != null:
			obj.external_purchase_token = data["externalPurchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES.has(result):
			dict["result"] = EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES[result]
		else:
			dict["result"] = result
		dict["error"] = error
		dict["externalPurchaseToken"] = external_purchase_token
		return dict

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
		var dict = {}
		dict["maximumQuantity"] = maximum_quantity
		dict["remainingQuantity"] = remaining_quantity
		return dict

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
		var dict = {}
		dict["preorderPresaleEndTimeMillis"] = preorder_presale_end_time_millis
		dict["preorderReleaseTimeMillis"] = preorder_release_time_millis
		return dict

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
		var dict = {}
		dict["formattedPrice"] = formatted_price
		dict["priceCurrencyCode"] = price_currency_code
		dict["billingPeriod"] = billing_period
		dict["billingCycleCount"] = billing_cycle_count
		dict["priceAmountMicros"] = price_amount_micros
		dict["recurrenceMode"] = recurrence_mode
		return dict

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
		var dict = {}
		if pricing_phase_list != null:
			var arr = []
			for item in pricing_phase_list:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["pricingPhaseList"] = arr
		else:
			dict["pricingPhaseList"] = null
		return dict

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
	## Product-level status code indicating fetch result (Android 8.0+)
	var product_status_android: ProductStatusAndroid
	## Standardized discount offers for one-time products.
	var discount_offers: Array[DiscountOffer]
	## Standardized subscription offers.
	var subscription_offers: Array[SubscriptionOffer]
	## One-time purchase offer details including discounts (Android)
	var one_time_purchase_offer_details_android: Array[ProductAndroidOneTimePurchaseOfferDetail]
	## @deprecated Use subscriptionOffers instead for cross-platform compatibility.
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
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
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
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("productStatusAndroid") and data["productStatusAndroid"] != null:
			var enum_str = data["productStatusAndroid"]
			if enum_str is String and PRODUCT_STATUS_ANDROID_FROM_STRING.has(enum_str):
				obj.product_status_android = PRODUCT_STATUS_ANDROID_FROM_STRING[enum_str]
			else:
				obj.product_status_android = enum_str
		if data.has("discountOffers") and data["discountOffers"] != null:
			var arr = []
			for item in data["discountOffers"]:
				if item is Dictionary:
					arr.append(DiscountOffer.from_dict(item))
				else:
					arr.append(item)
			obj.discount_offers = arr
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			var arr = []
			for item in data["subscriptionOffers"]:
				if item is Dictionary:
					arr.append(SubscriptionOffer.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offers = arr
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
		var dict = {}
		dict["id"] = id
		dict["title"] = title
		dict["description"] = description
		if PRODUCT_TYPE_VALUES.has(type):
			dict["type"] = PRODUCT_TYPE_VALUES[type]
		else:
			dict["type"] = type
		dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		dict["price"] = price
		dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["nameAndroid"] = name_android
		if PRODUCT_STATUS_ANDROID_VALUES.has(product_status_android):
			dict["productStatusAndroid"] = PRODUCT_STATUS_ANDROID_VALUES[product_status_android]
		else:
			dict["productStatusAndroid"] = product_status_android
		if discount_offers != null:
			var arr = []
			for item in discount_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["discountOffers"] = arr
		else:
			dict["discountOffers"] = null
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOffers"] = arr
		else:
			dict["subscriptionOffers"] = null
		if one_time_purchase_offer_details_android != null:
			var arr = []
			for item in one_time_purchase_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["oneTimePurchaseOfferDetailsAndroid"] = arr
		else:
			dict["oneTimePurchaseOfferDetailsAndroid"] = null
		if subscription_offer_details_android != null:
			var arr = []
			for item in subscription_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOfferDetailsAndroid"] = arr
		else:
			dict["subscriptionOfferDetailsAndroid"] = null
		return dict

## One-time purchase offer details (Android). Available in Google Play Billing Library 7.0+ @deprecated Use the standardized DiscountOffer type instead for cross-platform compatibility. @see https://openiap.dev/docs/types#discount-offer
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
		var dict = {}
		dict["offerId"] = offer_id
		dict["offerToken"] = offer_token
		dict["offerTags"] = offer_tags
		dict["priceCurrencyCode"] = price_currency_code
		dict["formattedPrice"] = formatted_price
		dict["priceAmountMicros"] = price_amount_micros
		dict["fullPriceMicros"] = full_price_micros
		if discount_display_info != null and discount_display_info.has_method("to_dict"):
			dict["discountDisplayInfo"] = discount_display_info.to_dict()
		else:
			dict["discountDisplayInfo"] = discount_display_info
		if valid_time_window != null and valid_time_window.has_method("to_dict"):
			dict["validTimeWindow"] = valid_time_window.to_dict()
		else:
			dict["validTimeWindow"] = valid_time_window
		if limited_quantity_info != null and limited_quantity_info.has_method("to_dict"):
			dict["limitedQuantityInfo"] = limited_quantity_info.to_dict()
		else:
			dict["limitedQuantityInfo"] = limited_quantity_info
		if preorder_details_android != null and preorder_details_android.has_method("to_dict"):
			dict["preorderDetailsAndroid"] = preorder_details_android.to_dict()
		else:
			dict["preorderDetailsAndroid"] = preorder_details_android
		if rental_details_android != null and rental_details_android.has_method("to_dict"):
			dict["rentalDetailsAndroid"] = rental_details_android.to_dict()
		else:
			dict["rentalDetailsAndroid"] = rental_details_android
		return dict

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
	var type_ios: ProductTypeIOS
	## Standardized subscription offers.
	var subscription_offers: Array[SubscriptionOffer]
	## @deprecated Use subscriptionOffers instead for cross-platform compatibility.
	var subscription_info_ios: SubscriptionInfoIOS

	static func from_dict(data: Dictionary) -> ProductIOS:
		var obj = ProductIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("title") and data["title"] != null:
			obj.title = data["title"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
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
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("displayNameIOS") and data["displayNameIOS"] != null:
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS") and data["isFamilyShareableIOS"] != null:
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS") and data["jsonRepresentationIOS"] != null:
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("typeIOS") and data["typeIOS"] != null:
			var enum_str = data["typeIOS"]
			if enum_str is String and PRODUCT_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.type_ios = PRODUCT_TYPE_IOS_FROM_STRING[enum_str]
			else:
				obj.type_ios = enum_str
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			var arr = []
			for item in data["subscriptionOffers"]:
				if item is Dictionary:
					arr.append(SubscriptionOffer.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offers = arr
		if data.has("subscriptionInfoIOS") and data["subscriptionInfoIOS"] != null:
			if data["subscriptionInfoIOS"] is Dictionary:
				obj.subscription_info_ios = SubscriptionInfoIOS.from_dict(data["subscriptionInfoIOS"])
			else:
				obj.subscription_info_ios = data["subscriptionInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["title"] = title
		dict["description"] = description
		if PRODUCT_TYPE_VALUES.has(type):
			dict["type"] = PRODUCT_TYPE_VALUES[type]
		else:
			dict["type"] = type
		dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		dict["price"] = price
		dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["displayNameIOS"] = display_name_ios
		dict["isFamilyShareableIOS"] = is_family_shareable_ios
		dict["jsonRepresentationIOS"] = json_representation_ios
		if PRODUCT_TYPE_IOS_VALUES.has(type_ios):
			dict["typeIOS"] = PRODUCT_TYPE_IOS_VALUES[type_ios]
		else:
			dict["typeIOS"] = type_ios
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOffers"] = arr
		else:
			dict["subscriptionOffers"] = null
		if subscription_info_ios != null and subscription_info_ios.has_method("to_dict"):
			dict["subscriptionInfoIOS"] = subscription_info_ios.to_dict()
		else:
			dict["subscriptionInfoIOS"] = subscription_info_ios
		return dict

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
	## Product-level status code indicating fetch result (Android 8.0+)
	var product_status_android: ProductStatusAndroid
	## Standardized discount offers for one-time products.
	var discount_offers: Array[DiscountOffer]
	## Standardized subscription offers.
	var subscription_offers: Array[SubscriptionOffer]
	## One-time purchase offer details including discounts (Android)
	var one_time_purchase_offer_details_android: Array[ProductAndroidOneTimePurchaseOfferDetail]
	## @deprecated Use subscriptionOffers instead for cross-platform compatibility.
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
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
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
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("productStatusAndroid") and data["productStatusAndroid"] != null:
			var enum_str = data["productStatusAndroid"]
			if enum_str is String and PRODUCT_STATUS_ANDROID_FROM_STRING.has(enum_str):
				obj.product_status_android = PRODUCT_STATUS_ANDROID_FROM_STRING[enum_str]
			else:
				obj.product_status_android = enum_str
		if data.has("discountOffers") and data["discountOffers"] != null:
			var arr = []
			for item in data["discountOffers"]:
				if item is Dictionary:
					arr.append(DiscountOffer.from_dict(item))
				else:
					arr.append(item)
			obj.discount_offers = arr
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			var arr = []
			for item in data["subscriptionOffers"]:
				if item is Dictionary:
					arr.append(SubscriptionOffer.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offers = arr
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
		var dict = {}
		dict["id"] = id
		dict["title"] = title
		dict["description"] = description
		if PRODUCT_TYPE_VALUES.has(type):
			dict["type"] = PRODUCT_TYPE_VALUES[type]
		else:
			dict["type"] = type
		dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		dict["price"] = price
		dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["nameAndroid"] = name_android
		if PRODUCT_STATUS_ANDROID_VALUES.has(product_status_android):
			dict["productStatusAndroid"] = PRODUCT_STATUS_ANDROID_VALUES[product_status_android]
		else:
			dict["productStatusAndroid"] = product_status_android
		if discount_offers != null:
			var arr = []
			for item in discount_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["discountOffers"] = arr
		else:
			dict["discountOffers"] = null
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOffers"] = arr
		else:
			dict["subscriptionOffers"] = null
		if one_time_purchase_offer_details_android != null:
			var arr = []
			for item in one_time_purchase_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["oneTimePurchaseOfferDetailsAndroid"] = arr
		else:
			dict["oneTimePurchaseOfferDetailsAndroid"] = null
		if subscription_offer_details_android != null:
			var arr = []
			for item in subscription_offer_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOfferDetailsAndroid"] = arr
		else:
			dict["subscriptionOfferDetailsAndroid"] = null
		return dict

## Subscription offer details (Android). @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. @see https://openiap.dev/docs/types#subscription-offer
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
		var dict = {}
		dict["basePlanId"] = base_plan_id
		dict["offerId"] = offer_id
		dict["offerToken"] = offer_token
		dict["offerTags"] = offer_tags
		if pricing_phases != null and pricing_phases.has_method("to_dict"):
			dict["pricingPhases"] = pricing_phases.to_dict()
		else:
			dict["pricingPhases"] = pricing_phases
		return dict

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
	var type_ios: ProductTypeIOS
	## Standardized subscription offers.
	var subscription_offers: Array[SubscriptionOffer]
	## @deprecated Use subscriptionOffers instead for cross-platform compatibility.
	var subscription_info_ios: SubscriptionInfoIOS
	## @deprecated Use subscriptionOffers instead for cross-platform compatibility.
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
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
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
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("displayNameIOS") and data["displayNameIOS"] != null:
			obj.display_name_ios = data["displayNameIOS"]
		if data.has("isFamilyShareableIOS") and data["isFamilyShareableIOS"] != null:
			obj.is_family_shareable_ios = data["isFamilyShareableIOS"]
		if data.has("jsonRepresentationIOS") and data["jsonRepresentationIOS"] != null:
			obj.json_representation_ios = data["jsonRepresentationIOS"]
		if data.has("typeIOS") and data["typeIOS"] != null:
			var enum_str = data["typeIOS"]
			if enum_str is String and PRODUCT_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.type_ios = PRODUCT_TYPE_IOS_FROM_STRING[enum_str]
			else:
				obj.type_ios = enum_str
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			var arr = []
			for item in data["subscriptionOffers"]:
				if item is Dictionary:
					arr.append(SubscriptionOffer.from_dict(item))
				else:
					arr.append(item)
			obj.subscription_offers = arr
		if data.has("subscriptionInfoIOS") and data["subscriptionInfoIOS"] != null:
			if data["subscriptionInfoIOS"] is Dictionary:
				obj.subscription_info_ios = SubscriptionInfoIOS.from_dict(data["subscriptionInfoIOS"])
			else:
				obj.subscription_info_ios = data["subscriptionInfoIOS"]
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
			var enum_str = data["introductoryPricePaymentModeIOS"]
			if enum_str is String and PAYMENT_MODE_IOS_FROM_STRING.has(enum_str):
				obj.introductory_price_payment_mode_ios = PAYMENT_MODE_IOS_FROM_STRING[enum_str]
			else:
				obj.introductory_price_payment_mode_ios = enum_str
		if data.has("introductoryPriceNumberOfPeriodsIOS") and data["introductoryPriceNumberOfPeriodsIOS"] != null:
			obj.introductory_price_number_of_periods_ios = data["introductoryPriceNumberOfPeriodsIOS"]
		if data.has("introductoryPriceSubscriptionPeriodIOS") and data["introductoryPriceSubscriptionPeriodIOS"] != null:
			var enum_str = data["introductoryPriceSubscriptionPeriodIOS"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.introductory_price_subscription_period_ios = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			else:
				obj.introductory_price_subscription_period_ios = enum_str
		if data.has("subscriptionPeriodNumberIOS") and data["subscriptionPeriodNumberIOS"] != null:
			obj.subscription_period_number_ios = data["subscriptionPeriodNumberIOS"]
		if data.has("subscriptionPeriodUnitIOS") and data["subscriptionPeriodUnitIOS"] != null:
			var enum_str = data["subscriptionPeriodUnitIOS"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.subscription_period_unit_ios = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			else:
				obj.subscription_period_unit_ios = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["title"] = title
		dict["description"] = description
		if PRODUCT_TYPE_VALUES.has(type):
			dict["type"] = PRODUCT_TYPE_VALUES[type]
		else:
			dict["type"] = type
		dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		dict["price"] = price
		dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["displayNameIOS"] = display_name_ios
		dict["isFamilyShareableIOS"] = is_family_shareable_ios
		dict["jsonRepresentationIOS"] = json_representation_ios
		if PRODUCT_TYPE_IOS_VALUES.has(type_ios):
			dict["typeIOS"] = PRODUCT_TYPE_IOS_VALUES[type_ios]
		else:
			dict["typeIOS"] = type_ios
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOffers"] = arr
		else:
			dict["subscriptionOffers"] = null
		if subscription_info_ios != null and subscription_info_ios.has_method("to_dict"):
			dict["subscriptionInfoIOS"] = subscription_info_ios.to_dict()
		else:
			dict["subscriptionInfoIOS"] = subscription_info_ios
		if discounts_ios != null:
			var arr = []
			for item in discounts_ios:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["discountsIOS"] = arr
		else:
			dict["discountsIOS"] = null
		dict["introductoryPriceIOS"] = introductory_price_ios
		dict["introductoryPriceAsAmountIOS"] = introductory_price_as_amount_ios
		if PAYMENT_MODE_IOS_VALUES.has(introductory_price_payment_mode_ios):
			dict["introductoryPricePaymentModeIOS"] = PAYMENT_MODE_IOS_VALUES[introductory_price_payment_mode_ios]
		else:
			dict["introductoryPricePaymentModeIOS"] = introductory_price_payment_mode_ios
		dict["introductoryPriceNumberOfPeriodsIOS"] = introductory_price_number_of_periods_ios
		if SUBSCRIPTION_PERIOD_IOS_VALUES.has(introductory_price_subscription_period_ios):
			dict["introductoryPriceSubscriptionPeriodIOS"] = SUBSCRIPTION_PERIOD_IOS_VALUES[introductory_price_subscription_period_ios]
		else:
			dict["introductoryPriceSubscriptionPeriodIOS"] = introductory_price_subscription_period_ios
		dict["subscriptionPeriodNumberIOS"] = subscription_period_number_ios
		if SUBSCRIPTION_PERIOD_IOS_VALUES.has(subscription_period_unit_ios):
			dict["subscriptionPeriodUnitIOS"] = SUBSCRIPTION_PERIOD_IOS_VALUES[subscription_period_unit_ios]
		else:
			dict["subscriptionPeriodUnitIOS"] = subscription_period_unit_ios
		return dict

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
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			else:
				obj.store = enum_str
		if data.has("platform") and data["platform"] != null:
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			else:
				obj.purchase_state = enum_str
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
		var dict = {}
		dict["id"] = id
		dict["productId"] = product_id
		dict["ids"] = ids
		dict["transactionId"] = transaction_id
		dict["transactionDate"] = transaction_date
		dict["purchaseToken"] = purchase_token
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["quantity"] = quantity
		if PURCHASE_STATE_VALUES.has(purchase_state):
			dict["purchaseState"] = PURCHASE_STATE_VALUES[purchase_state]
		else:
			dict["purchaseState"] = purchase_state
		dict["isAutoRenewing"] = is_auto_renewing
		dict["currentPlanId"] = current_plan_id
		dict["dataAndroid"] = data_android
		dict["signatureAndroid"] = signature_android
		dict["autoRenewingAndroid"] = auto_renewing_android
		dict["isAcknowledgedAndroid"] = is_acknowledged_android
		dict["packageNameAndroid"] = package_name_android
		dict["developerPayloadAndroid"] = developer_payload_android
		dict["obfuscatedAccountIdAndroid"] = obfuscated_account_id_android
		dict["obfuscatedProfileIdAndroid"] = obfuscated_profile_id_android
		dict["isSuspendedAndroid"] = is_suspended_android
		return dict

class PurchaseError:
	var code: ErrorCode
	var message: String
	var product_id: String

	static func from_dict(data: Dictionary) -> PurchaseError:
		var obj = PurchaseError.new()
		if data.has("code") and data["code"] != null:
			var enum_str = data["code"]
			if enum_str is String and ERROR_CODE_FROM_STRING.has(enum_str):
				obj.code = ERROR_CODE_FROM_STRING[enum_str]
			else:
				obj.code = enum_str
		if data.has("message") and data["message"] != null:
			obj.message = data["message"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if ERROR_CODE_VALUES.has(code):
			dict["code"] = ERROR_CODE_VALUES[code]
		else:
			dict["code"] = code
		dict["message"] = message
		dict["productId"] = product_id
		return dict

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
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			else:
				obj.store = enum_str
		if data.has("platform") and data["platform"] != null:
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			else:
				obj.purchase_state = enum_str
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
		var dict = {}
		dict["id"] = id
		dict["productId"] = product_id
		dict["ids"] = ids
		dict["transactionDate"] = transaction_date
		dict["purchaseToken"] = purchase_token
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["quantity"] = quantity
		if PURCHASE_STATE_VALUES.has(purchase_state):
			dict["purchaseState"] = PURCHASE_STATE_VALUES[purchase_state]
		else:
			dict["purchaseState"] = purchase_state
		dict["isAutoRenewing"] = is_auto_renewing
		dict["currentPlanId"] = current_plan_id
		dict["transactionId"] = transaction_id
		dict["quantityIOS"] = quantity_ios
		dict["originalTransactionDateIOS"] = original_transaction_date_ios
		dict["originalTransactionIdentifierIOS"] = original_transaction_identifier_ios
		dict["appAccountToken"] = app_account_token
		dict["expirationDateIOS"] = expiration_date_ios
		dict["webOrderLineItemIdIOS"] = web_order_line_item_id_ios
		dict["environmentIOS"] = environment_ios
		dict["storefrontCountryCodeIOS"] = storefront_country_code_ios
		dict["appBundleIdIOS"] = app_bundle_id_ios
		dict["subscriptionGroupIdIOS"] = subscription_group_id_ios
		dict["isUpgradedIOS"] = is_upgraded_ios
		dict["ownershipTypeIOS"] = ownership_type_ios
		dict["reasonIOS"] = reason_ios
		dict["reasonStringRepresentationIOS"] = reason_string_representation_ios
		dict["transactionReasonIOS"] = transaction_reason_ios
		dict["revocationDateIOS"] = revocation_date_ios
		dict["revocationReasonIOS"] = revocation_reason_ios
		if offer_ios != null and offer_ios.has_method("to_dict"):
			dict["offerIOS"] = offer_ios.to_dict()
		else:
			dict["offerIOS"] = offer_ios
		dict["currencyCodeIOS"] = currency_code_ios
		dict["currencySymbolIOS"] = currency_symbol_ios
		dict["countryCodeIOS"] = country_code_ios
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			dict["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			dict["renewalInfoIOS"] = renewal_info_ios
		return dict

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
		var dict = {}
		dict["id"] = id
		dict["type"] = type
		dict["paymentMode"] = payment_mode
		return dict

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
		var dict = {}
		dict["status"] = status
		dict["message"] = message
		return dict

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
		var dict = {}
		dict["jsonRepresentation"] = json_representation
		dict["willAutoRenew"] = will_auto_renew
		dict["autoRenewPreference"] = auto_renew_preference
		dict["expirationReason"] = expiration_reason
		dict["gracePeriodExpirationDate"] = grace_period_expiration_date
		dict["isInBillingRetry"] = is_in_billing_retry
		dict["pendingUpgradeProductId"] = pending_upgrade_product_id
		dict["priceIncreaseStatus"] = price_increase_status
		dict["renewalDate"] = renewal_date
		dict["renewalOfferId"] = renewal_offer_id
		dict["renewalOfferType"] = renewal_offer_type
		return dict

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
		var dict = {}
		dict["rentalPeriod"] = rental_period
		dict["rentalExpirationPeriod"] = rental_expiration_period
		return dict

class RequestVerifyPurchaseWithIapkitResult:
	var store: IapStore
	## Whether the purchase is valid (not falsified).
	var is_valid: bool
	## The current state of the purchase.
	var state: IapkitPurchaseState

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitResult:
		var obj = RequestVerifyPurchaseWithIapkitResult.new()
		if data.has("store") and data["store"] != null:
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			else:
				obj.store = enum_str
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
		if data.has("state") and data["state"] != null:
			var enum_str = data["state"]
			if enum_str is String and IAPKIT_PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.state = IAPKIT_PURCHASE_STATE_FROM_STRING[enum_str]
			else:
				obj.state = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		dict["isValid"] = is_valid
		if IAPKIT_PURCHASE_STATE_VALUES.has(state):
			dict["state"] = IAPKIT_PURCHASE_STATE_VALUES[state]
		else:
			dict["state"] = state
		return dict

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
		var dict = {}
		if introductory_offer != null and introductory_offer.has_method("to_dict"):
			dict["introductoryOffer"] = introductory_offer.to_dict()
		else:
			dict["introductoryOffer"] = introductory_offer
		if promotional_offers != null:
			var arr = []
			for item in promotional_offers:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["promotionalOffers"] = arr
		else:
			dict["promotionalOffers"] = null
		dict["subscriptionGroupId"] = subscription_group_id
		if subscription_period != null and subscription_period.has_method("to_dict"):
			dict["subscriptionPeriod"] = subscription_period.to_dict()
		else:
			dict["subscriptionPeriod"] = subscription_period
		return dict

## Standardized subscription discount/promotional offer. Provides a unified interface for subscription offers across iOS and Android.  Both platforms support subscription offers with different implementations: - iOS: Introductory offers, promotional offers with server-side signatures - Android: Offer tokens with pricing phases  @see https://openiap.dev/docs/types/ios#discount-offer @see https://openiap.dev/docs/types/android#subscription-offer
class SubscriptionOffer:
	## Unique identifier for the offer.
	var id: String
	## Formatted display price string (e.g., "$9.99/month")
	var display_price: String
	## Numeric price value
	var price: float
	## Currency code (ISO 4217, e.g., "USD")
	var currency: String
	## Type of subscription offer (Introductory or Promotional)
	var type: DiscountOfferType
	## Subscription period for this offer
	var period: SubscriptionPeriod
	## Number of periods the offer applies
	var period_count: int
	## Payment mode during the offer period
	var payment_mode: PaymentMode
	## [iOS] Key identifier for signature validation.
	var key_identifier_ios: String
	## [iOS] Cryptographic nonce (UUID) for signature validation.
	var nonce_ios: String
	## [iOS] Server-generated signature for promotional offer validation.
	var signature_ios: String
	## [iOS] Timestamp when the signature was generated.
	var timestamp_ios: float
	## [iOS] Number of billing periods for this discount.
	var number_of_periods_ios: int
	## [iOS] Localized price string.
	var localized_price_ios: String
	## [Android] Base plan identifier.
	var base_plan_id_android: String
	## [Android] Offer token required for purchase.
	var offer_token_android: String
	## [Android] List of tags associated with this offer.
	var offer_tags_android: Array[String]
	## [Android] Pricing phases for this subscription offer.
	var pricing_phases_android: PricingPhasesAndroid

	static func from_dict(data: Dictionary) -> SubscriptionOffer:
		var obj = SubscriptionOffer.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("currency") and data["currency"] != null:
			obj.currency = data["currency"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and DISCOUNT_OFFER_TYPE_FROM_STRING.has(enum_str):
				obj.type = DISCOUNT_OFFER_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
		if data.has("period") and data["period"] != null:
			if data["period"] is Dictionary:
				obj.period = SubscriptionPeriod.from_dict(data["period"])
			else:
				obj.period = data["period"]
		if data.has("periodCount") and data["periodCount"] != null:
			obj.period_count = data["periodCount"]
		if data.has("paymentMode") and data["paymentMode"] != null:
			var enum_str = data["paymentMode"]
			if enum_str is String and PAYMENT_MODE_FROM_STRING.has(enum_str):
				obj.payment_mode = PAYMENT_MODE_FROM_STRING[enum_str]
			else:
				obj.payment_mode = enum_str
		if data.has("keyIdentifierIOS") and data["keyIdentifierIOS"] != null:
			obj.key_identifier_ios = data["keyIdentifierIOS"]
		if data.has("nonceIOS") and data["nonceIOS"] != null:
			obj.nonce_ios = data["nonceIOS"]
		if data.has("signatureIOS") and data["signatureIOS"] != null:
			obj.signature_ios = data["signatureIOS"]
		if data.has("timestampIOS") and data["timestampIOS"] != null:
			obj.timestamp_ios = data["timestampIOS"]
		if data.has("numberOfPeriodsIOS") and data["numberOfPeriodsIOS"] != null:
			obj.number_of_periods_ios = data["numberOfPeriodsIOS"]
		if data.has("localizedPriceIOS") and data["localizedPriceIOS"] != null:
			obj.localized_price_ios = data["localizedPriceIOS"]
		if data.has("basePlanIdAndroid") and data["basePlanIdAndroid"] != null:
			obj.base_plan_id_android = data["basePlanIdAndroid"]
		if data.has("offerTokenAndroid") and data["offerTokenAndroid"] != null:
			obj.offer_token_android = data["offerTokenAndroid"]
		if data.has("offerTagsAndroid") and data["offerTagsAndroid"] != null:
			obj.offer_tags_android = data["offerTagsAndroid"]
		if data.has("pricingPhasesAndroid") and data["pricingPhasesAndroid"] != null:
			if data["pricingPhasesAndroid"] is Dictionary:
				obj.pricing_phases_android = PricingPhasesAndroid.from_dict(data["pricingPhasesAndroid"])
			else:
				obj.pricing_phases_android = data["pricingPhasesAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["displayPrice"] = display_price
		dict["price"] = price
		dict["currency"] = currency
		if DISCOUNT_OFFER_TYPE_VALUES.has(type):
			dict["type"] = DISCOUNT_OFFER_TYPE_VALUES[type]
		else:
			dict["type"] = type
		if period != null and period.has_method("to_dict"):
			dict["period"] = period.to_dict()
		else:
			dict["period"] = period
		dict["periodCount"] = period_count
		if PAYMENT_MODE_VALUES.has(payment_mode):
			dict["paymentMode"] = PAYMENT_MODE_VALUES[payment_mode]
		else:
			dict["paymentMode"] = payment_mode
		dict["keyIdentifierIOS"] = key_identifier_ios
		dict["nonceIOS"] = nonce_ios
		dict["signatureIOS"] = signature_ios
		dict["timestampIOS"] = timestamp_ios
		dict["numberOfPeriodsIOS"] = number_of_periods_ios
		dict["localizedPriceIOS"] = localized_price_ios
		dict["basePlanIdAndroid"] = base_plan_id_android
		dict["offerTokenAndroid"] = offer_token_android
		dict["offerTagsAndroid"] = offer_tags_android
		if pricing_phases_android != null and pricing_phases_android.has_method("to_dict"):
			dict["pricingPhasesAndroid"] = pricing_phases_android.to_dict()
		else:
			dict["pricingPhasesAndroid"] = pricing_phases_android
		return dict

## iOS subscription offer details. @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. @see https://openiap.dev/docs/types#subscription-offer
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
			var enum_str = data["paymentMode"]
			if enum_str is String and PAYMENT_MODE_IOS_FROM_STRING.has(enum_str):
				obj.payment_mode = PAYMENT_MODE_IOS_FROM_STRING[enum_str]
			else:
				obj.payment_mode = enum_str
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
			var enum_str = data["type"]
			if enum_str is String and SUBSCRIPTION_OFFER_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.type = SUBSCRIPTION_OFFER_TYPE_IOS_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["displayPrice"] = display_price
		dict["id"] = id
		if PAYMENT_MODE_IOS_VALUES.has(payment_mode):
			dict["paymentMode"] = PAYMENT_MODE_IOS_VALUES[payment_mode]
		else:
			dict["paymentMode"] = payment_mode
		if period != null and period.has_method("to_dict"):
			dict["period"] = period.to_dict()
		else:
			dict["period"] = period
		dict["periodCount"] = period_count
		dict["price"] = price
		if SUBSCRIPTION_OFFER_TYPE_IOS_VALUES.has(type):
			dict["type"] = SUBSCRIPTION_OFFER_TYPE_IOS_VALUES[type]
		else:
			dict["type"] = type
		return dict

## Subscription period value combining unit and count.
class SubscriptionPeriod:
	## The period unit (day, week, month, year)
	var unit: SubscriptionPeriodUnit
	## The number of units (e.g., 1 for monthly, 3 for quarterly)
	var value: int

	static func from_dict(data: Dictionary) -> SubscriptionPeriod:
		var obj = SubscriptionPeriod.new()
		if data.has("unit") and data["unit"] != null:
			var enum_str = data["unit"]
			if enum_str is String and SUBSCRIPTION_PERIOD_UNIT_FROM_STRING.has(enum_str):
				obj.unit = SUBSCRIPTION_PERIOD_UNIT_FROM_STRING[enum_str]
			else:
				obj.unit = enum_str
		if data.has("value") and data["value"] != null:
			obj.value = data["value"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if SUBSCRIPTION_PERIOD_UNIT_VALUES.has(unit):
			dict["unit"] = SUBSCRIPTION_PERIOD_UNIT_VALUES[unit]
		else:
			dict["unit"] = unit
		dict["value"] = value
		return dict

class SubscriptionPeriodValueIOS:
	var unit: SubscriptionPeriodIOS
	var value: int

	static func from_dict(data: Dictionary) -> SubscriptionPeriodValueIOS:
		var obj = SubscriptionPeriodValueIOS.new()
		if data.has("unit") and data["unit"] != null:
			var enum_str = data["unit"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.unit = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			else:
				obj.unit = enum_str
		if data.has("value") and data["value"] != null:
			obj.value = data["value"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if SUBSCRIPTION_PERIOD_IOS_VALUES.has(unit):
			dict["unit"] = SUBSCRIPTION_PERIOD_IOS_VALUES[unit]
		else:
			dict["unit"] = unit
		dict["value"] = value
		return dict

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
		var dict = {}
		dict["state"] = state
		if renewal_info != null and renewal_info.has_method("to_dict"):
			dict["renewalInfo"] = renewal_info.to_dict()
		else:
			dict["renewalInfo"] = renewal_info
		return dict

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
		var dict = {}
		dict["externalTransactionToken"] = external_transaction_token
		dict["products"] = products
		return dict

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
		var dict = {}
		dict["startTimeMillis"] = start_time_millis
		dict["endTimeMillis"] = end_time_millis
		return dict

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
		var dict = {}
		dict["autoRenewing"] = auto_renewing
		dict["betaProduct"] = beta_product
		dict["cancelDate"] = cancel_date
		dict["cancelReason"] = cancel_reason
		dict["deferredDate"] = deferred_date
		dict["deferredSku"] = deferred_sku
		dict["freeTrialEndDate"] = free_trial_end_date
		dict["gracePeriodEndDate"] = grace_period_end_date
		dict["parentProductId"] = parent_product_id
		dict["productId"] = product_id
		dict["productType"] = product_type
		dict["purchaseDate"] = purchase_date
		dict["quantity"] = quantity
		dict["receiptId"] = receipt_id
		dict["renewalDate"] = renewal_date
		dict["term"] = term
		dict["termSku"] = term_sku
		dict["testTransaction"] = test_transaction
		return dict

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
		var dict = {}
		dict["success"] = success
		dict["grantTime"] = grant_time
		return dict

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
		var dict = {}
		dict["isValid"] = is_valid
		dict["receiptData"] = receipt_data
		dict["jwsRepresentation"] = jws_representation
		dict["latestTransaction"] = latest_transaction
		return dict

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
		var dict = {}
		dict["message"] = message
		dict["code"] = code
		return dict

class VerifyPurchaseWithProviderResult:
	var provider: PurchaseVerificationProvider
	## IAPKit verification result
	var iapkit: RequestVerifyPurchaseWithIapkitResult
	## Error details if verification failed
	var errors: Array[VerifyPurchaseWithProviderError]

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderResult:
		var obj = VerifyPurchaseWithProviderResult.new()
		if data.has("provider") and data["provider"] != null:
			var enum_str = data["provider"]
			if enum_str is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(enum_str):
				obj.provider = PURCHASE_VERIFICATION_PROVIDER_FROM_STRING[enum_str]
			else:
				obj.provider = enum_str
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
		var dict = {}
		if PURCHASE_VERIFICATION_PROVIDER_VALUES.has(provider):
			dict["provider"] = PURCHASE_VERIFICATION_PROVIDER_VALUES[provider]
		else:
			dict["provider"] = provider
		if iapkit != null and iapkit.has_method("to_dict"):
			dict["iapkit"] = iapkit.to_dict()
		else:
			dict["iapkit"] = iapkit
		if errors != null:
			var arr = []
			for item in errors:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["errors"] = arr
		else:
			dict["errors"] = null
		return dict

class VoidResult:
	var success: bool

	static func from_dict(data: Dictionary) -> VoidResult:
		var obj = VoidResult.new()
		if data.has("success") and data["success"] != null:
			obj.success = data["success"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["success"] = success
		return dict

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
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		if offer_token != null:
			dict["offerToken"] = offer_token
		return dict

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
		var dict = {}
		if sku_android != null:
			dict["skuAndroid"] = sku_android
		if package_name_android != null:
			dict["packageNameAndroid"] = package_name_android
		return dict

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
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			else:
				obj.billing_program = enum_str
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		if data.has("launchMode") and data["launchMode"] != null:
			var enum_str = data["launchMode"]
			if enum_str is String and DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.launch_mode = DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.launch_mode = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if billing_program != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
				dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
			else:
				dict["billingProgram"] = billing_program
		if link_uri != null:
			dict["linkUri"] = link_uri
		if launch_mode != null:
			if DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES.has(launch_mode):
				dict["launchMode"] = DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES[launch_mode]
			else:
				dict["launchMode"] = launch_mode
		return dict

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
		var dict = {}
		if identifier != null:
			dict["identifier"] = identifier
		if key_identifier != null:
			dict["keyIdentifier"] = key_identifier
		if nonce != null:
			dict["nonce"] = nonce
		if signature != null:
			dict["signature"] = signature
		if timestamp != null:
			dict["timestamp"] = timestamp
		return dict

## Connection initialization configuration
class InitConnectionConfig:
	## Alternative billing mode for Android
	var alternative_billing_mode_android: AlternativeBillingModeAndroid
	## Enable a specific billing program for Android (7.0+)
	var enable_billing_program_android: BillingProgramAndroid

	static func from_dict(data: Dictionary) -> InitConnectionConfig:
		var obj = InitConnectionConfig.new()
		if data.has("alternativeBillingModeAndroid") and data["alternativeBillingModeAndroid"] != null:
			var enum_str = data["alternativeBillingModeAndroid"]
			if enum_str is String and ALTERNATIVE_BILLING_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.alternative_billing_mode_android = ALTERNATIVE_BILLING_MODE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.alternative_billing_mode_android = enum_str
		if data.has("enableBillingProgramAndroid") and data["enableBillingProgramAndroid"] != null:
			var enum_str = data["enableBillingProgramAndroid"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.enable_billing_program_android = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			else:
				obj.enable_billing_program_android = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if alternative_billing_mode_android != null:
			if ALTERNATIVE_BILLING_MODE_ANDROID_VALUES.has(alternative_billing_mode_android):
				dict["alternativeBillingModeAndroid"] = ALTERNATIVE_BILLING_MODE_ANDROID_VALUES[alternative_billing_mode_android]
			else:
				dict["alternativeBillingModeAndroid"] = alternative_billing_mode_android
		if enable_billing_program_android != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(enable_billing_program_android):
				dict["enableBillingProgramAndroid"] = BILLING_PROGRAM_ANDROID_VALUES[enable_billing_program_android]
			else:
				dict["enableBillingProgramAndroid"] = enable_billing_program_android
		return dict

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
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			else:
				obj.billing_program = enum_str
		if data.has("launchMode") and data["launchMode"] != null:
			var enum_str = data["launchMode"]
			if enum_str is String and EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.launch_mode = EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.launch_mode = enum_str
		if data.has("linkType") and data["linkType"] != null:
			var enum_str = data["linkType"]
			if enum_str is String and EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING.has(enum_str):
				obj.link_type = EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.link_type = enum_str
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if billing_program != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
				dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
			else:
				dict["billingProgram"] = billing_program
		if launch_mode != null:
			if EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES.has(launch_mode):
				dict["launchMode"] = EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES[launch_mode]
			else:
				dict["launchMode"] = launch_mode
		if link_type != null:
			if EXTERNAL_LINK_TYPE_ANDROID_VALUES.has(link_type):
				dict["linkType"] = EXTERNAL_LINK_TYPE_ANDROID_VALUES[link_type]
			else:
				dict["linkType"] = link_type
		if link_uri != null:
			dict["linkUri"] = link_uri
		return dict

class ProductRequest:
	var skus: Array[String]
	var type: ProductQueryType

	static func from_dict(data: Dictionary) -> ProductRequest:
		var obj = ProductRequest.new()
		if data.has("skus") and data["skus"] != null:
			obj.skus = data["skus"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_QUERY_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_QUERY_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if skus != null:
			dict["skus"] = skus
		if type != null:
			if PRODUCT_QUERY_TYPE_VALUES.has(type):
				dict["type"] = PRODUCT_QUERY_TYPE_VALUES[type]
			else:
				dict["type"] = type
		return dict

## JWS promotional offer input for iOS 15+ (StoreKit 2, WWDC 2025). New signature format using compact JWS string for promotional offers. This provides a simpler alternative to the legacy signature-based promotional offers. Back-deployed to iOS 15.
class PromotionalOfferJWSInputIOS:
	## The promotional offer identifier from App Store Connect
	var offer_id: String
	## Compact JWS string signed by your server.
	var jws: String

	static func from_dict(data: Dictionary) -> PromotionalOfferJWSInputIOS:
		var obj = PromotionalOfferJWSInputIOS.new()
		if data.has("offerId") and data["offerId"] != null:
			obj.offer_id = data["offerId"]
		if data.has("jws") and data["jws"] != null:
			obj.jws = data["jws"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if offer_id != null:
			dict["offerId"] = offer_id
		if jws != null:
			dict["jws"] = jws
		return dict

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
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			else:
				obj.store = enum_str
		if data.has("platform") and data["platform"] != null:
			var enum_str = data["platform"]
			if enum_str is String and IAP_PLATFORM_FROM_STRING.has(enum_str):
				obj.platform = IAP_PLATFORM_FROM_STRING[enum_str]
			else:
				obj.platform = enum_str
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			else:
				obj.purchase_state = enum_str
		if data.has("isAutoRenewing") and data["isAutoRenewing"] != null:
			obj.is_auto_renewing = data["isAutoRenewing"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if id != null:
			dict["id"] = id
		if product_id != null:
			dict["productId"] = product_id
		if ids != null:
			dict["ids"] = ids
		if transaction_date != null:
			dict["transactionDate"] = transaction_date
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		if store != null:
			if IAP_STORE_VALUES.has(store):
				dict["store"] = IAP_STORE_VALUES[store]
			else:
				dict["store"] = store
		if platform != null:
			if IAP_PLATFORM_VALUES.has(platform):
				dict["platform"] = IAP_PLATFORM_VALUES[platform]
			else:
				dict["platform"] = platform
		if quantity != null:
			dict["quantity"] = quantity
		if purchase_state != null:
			if PURCHASE_STATE_VALUES.has(purchase_state):
				dict["purchaseState"] = PURCHASE_STATE_VALUES[purchase_state]
			else:
				dict["purchaseState"] = purchase_state
		if is_auto_renewing != null:
			dict["isAutoRenewing"] = is_auto_renewing
		return dict

class PurchaseOptions:
	## Also emit results through the iOS event listeners
	var also_publish_to_event_listener_ios: bool
	## Limit to currently active items on iOS
	var only_include_active_items_ios: bool
	## Include suspended subscriptions in the result (Android 8.1+).
	var include_suspended_android: bool

	static func from_dict(data: Dictionary) -> PurchaseOptions:
		var obj = PurchaseOptions.new()
		if data.has("alsoPublishToEventListenerIOS") and data["alsoPublishToEventListenerIOS"] != null:
			obj.also_publish_to_event_listener_ios = data["alsoPublishToEventListenerIOS"]
		if data.has("onlyIncludeActiveItemsIOS") and data["onlyIncludeActiveItemsIOS"] != null:
			obj.only_include_active_items_ios = data["onlyIncludeActiveItemsIOS"]
		if data.has("includeSuspendedAndroid") and data["includeSuspendedAndroid"] != null:
			obj.include_suspended_android = data["includeSuspendedAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if also_publish_to_event_listener_ios != null:
			dict["alsoPublishToEventListenerIOS"] = also_publish_to_event_listener_ios
		if only_include_active_items_ios != null:
			dict["onlyIncludeActiveItemsIOS"] = only_include_active_items_ios
		if include_suspended_android != null:
			dict["includeSuspendedAndroid"] = include_suspended_android
		return dict

class RequestPurchaseAndroidProps:
	## List of product SKUs
	var skus: Array[String]
	## Obfuscated account ID
	var obfuscated_account_id: String
	## Obfuscated profile ID
	var obfuscated_profile_id: String
	## Personalized offer flag.
	var is_offer_personalized: bool
	## Offer token for one-time purchase discounts (7.0+).
	var offer_token: String
	## Developer billing option parameters for external payments flow (8.3.0+).
	var developer_billing_option: DeveloperBillingOptionParamsAndroid

	static func from_dict(data: Dictionary) -> RequestPurchaseAndroidProps:
		var obj = RequestPurchaseAndroidProps.new()
		if data.has("skus") and data["skus"] != null:
			obj.skus = data["skus"]
		if data.has("obfuscatedAccountId") and data["obfuscatedAccountId"] != null:
			obj.obfuscated_account_id = data["obfuscatedAccountId"]
		if data.has("obfuscatedProfileId") and data["obfuscatedProfileId"] != null:
			obj.obfuscated_profile_id = data["obfuscatedProfileId"]
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null:
			obj.is_offer_personalized = data["isOfferPersonalized"]
		if data.has("offerToken") and data["offerToken"] != null:
			obj.offer_token = data["offerToken"]
		if data.has("developerBillingOption") and data["developerBillingOption"] != null:
			if data["developerBillingOption"] is Dictionary:
				obj.developer_billing_option = DeveloperBillingOptionParamsAndroid.from_dict(data["developerBillingOption"])
			else:
				obj.developer_billing_option = data["developerBillingOption"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if skus != null:
			dict["skus"] = skus
		if obfuscated_account_id != null:
			dict["obfuscatedAccountId"] = obfuscated_account_id
		if obfuscated_profile_id != null:
			dict["obfuscatedProfileId"] = obfuscated_profile_id
		if is_offer_personalized != null:
			dict["isOfferPersonalized"] = is_offer_personalized
		if offer_token != null:
			dict["offerToken"] = offer_token
		if developer_billing_option != null:
			if developer_billing_option.has_method("to_dict"):
				dict["developerBillingOption"] = developer_billing_option.to_dict()
			else:
				dict["developerBillingOption"] = developer_billing_option
		return dict

class RequestPurchaseIosProps:
	## Product SKU
	var sku: String
	## Auto-finish transaction (dangerous)
	var and_dangerously_finish_transaction_automatically: bool
	## App account token for user tracking
	var app_account_token: String
	## Purchase quantity
	var quantity: int
	## Promotional offer to apply (subscriptions only, ignored for one-time purchases).
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
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		if and_dangerously_finish_transaction_automatically != null:
			dict["andDangerouslyFinishTransactionAutomatically"] = and_dangerously_finish_transaction_automatically
		if app_account_token != null:
			dict["appAccountToken"] = app_account_token
		if quantity != null:
			dict["quantity"] = quantity
		if with_offer != null:
			if with_offer.has_method("to_dict"):
				dict["withOffer"] = with_offer.to_dict()
			else:
				dict["withOffer"] = with_offer
		if advanced_commerce_data != null:
			dict["advancedCommerceData"] = advanced_commerce_data
		return dict

class RequestPurchaseProps:
	## Per-platform purchase request props
	var request: RequestPurchasePropsByPlatforms
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
				obj.request = RequestPurchasePropsByPlatforms.from_dict(data["requestPurchase"])
			else:
				obj.request = data["requestPurchase"]
		if data.has("requestSubscription") and data["requestSubscription"] != null:
			if data["requestSubscription"] is Dictionary:
				obj.request_subscription = RequestSubscriptionPropsByPlatforms.from_dict(data["requestSubscription"])
			else:
				obj.request_subscription = data["requestSubscription"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_QUERY_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_QUERY_TYPE_FROM_STRING[enum_str]
			else:
				obj.type = enum_str
		if data.has("useAlternativeBilling") and data["useAlternativeBilling"] != null:
			obj.use_alternative_billing = data["useAlternativeBilling"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if request != null:
			if request.has_method("to_dict"):
				dict["requestPurchase"] = request.to_dict()
			else:
				dict["requestPurchase"] = request
		if request_subscription != null:
			if request_subscription.has_method("to_dict"):
				dict["requestSubscription"] = request_subscription.to_dict()
			else:
				dict["requestSubscription"] = request_subscription
		if type != null:
			if PRODUCT_QUERY_TYPE_VALUES.has(type):
				dict["type"] = PRODUCT_QUERY_TYPE_VALUES[type]
			else:
				dict["type"] = type
		if use_alternative_billing != null:
			dict["useAlternativeBilling"] = use_alternative_billing
		return dict

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
		var dict = {}
		if apple != null:
			if apple.has_method("to_dict"):
				dict["apple"] = apple.to_dict()
			else:
				dict["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				dict["google"] = google.to_dict()
			else:
				dict["google"] = google
		if ios != null:
			if ios.has_method("to_dict"):
				dict["ios"] = ios.to_dict()
			else:
				dict["ios"] = ios
		if android != null:
			if android.has_method("to_dict"):
				dict["android"] = android.to_dict()
			else:
				dict["android"] = android
		return dict

class RequestSubscriptionAndroidProps:
	## List of subscription SKUs
	var skus: Array[String]
	## Obfuscated account ID
	var obfuscated_account_id: String
	## Obfuscated profile ID
	var obfuscated_profile_id: String
	## Personalized offer flag.
	var is_offer_personalized: bool
	## Purchase token for upgrades/downgrades
	var purchase_token: String
	## Replacement mode for subscription changes
	var replacement_mode: int
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
		if data.has("obfuscatedAccountId") and data["obfuscatedAccountId"] != null:
			obj.obfuscated_account_id = data["obfuscatedAccountId"]
		if data.has("obfuscatedProfileId") and data["obfuscatedProfileId"] != null:
			obj.obfuscated_profile_id = data["obfuscatedProfileId"]
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null:
			obj.is_offer_personalized = data["isOfferPersonalized"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("replacementMode") and data["replacementMode"] != null:
			obj.replacement_mode = data["replacementMode"]
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
		var dict = {}
		if skus != null:
			dict["skus"] = skus
		if obfuscated_account_id != null:
			dict["obfuscatedAccountId"] = obfuscated_account_id
		if obfuscated_profile_id != null:
			dict["obfuscatedProfileId"] = obfuscated_profile_id
		if is_offer_personalized != null:
			dict["isOfferPersonalized"] = is_offer_personalized
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		if replacement_mode != null:
			dict["replacementMode"] = replacement_mode
		if subscription_offers != null:
			var arr = []
			for item in subscription_offers:
				if item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["subscriptionOffers"] = arr
		if subscription_product_replacement_params != null:
			if subscription_product_replacement_params.has_method("to_dict"):
				dict["subscriptionProductReplacementParams"] = subscription_product_replacement_params.to_dict()
			else:
				dict["subscriptionProductReplacementParams"] = subscription_product_replacement_params
		if developer_billing_option != null:
			if developer_billing_option.has_method("to_dict"):
				dict["developerBillingOption"] = developer_billing_option.to_dict()
			else:
				dict["developerBillingOption"] = developer_billing_option
		return dict

class RequestSubscriptionIosProps:
	var sku: String
	var and_dangerously_finish_transaction_automatically: bool
	var app_account_token: String
	var quantity: int
	## Promotional offer to apply for subscription purchases.
	var with_offer: DiscountOfferInputIOS
	## Win-back offer to apply (iOS 18+)
	var win_back_offer: WinBackOfferInputIOS
	## JWS promotional offer (iOS 15+, WWDC 2025).
	var promotional_offer_jws: PromotionalOfferJWSInputIOS
	## Override introductory offer eligibility (iOS 15+, WWDC 2025).
	var introductory_offer_eligibility: bool
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
		if data.has("winBackOffer") and data["winBackOffer"] != null:
			if data["winBackOffer"] is Dictionary:
				obj.win_back_offer = WinBackOfferInputIOS.from_dict(data["winBackOffer"])
			else:
				obj.win_back_offer = data["winBackOffer"]
		if data.has("promotionalOfferJWS") and data["promotionalOfferJWS"] != null:
			if data["promotionalOfferJWS"] is Dictionary:
				obj.promotional_offer_jws = PromotionalOfferJWSInputIOS.from_dict(data["promotionalOfferJWS"])
			else:
				obj.promotional_offer_jws = data["promotionalOfferJWS"]
		if data.has("introductoryOfferEligibility") and data["introductoryOfferEligibility"] != null:
			obj.introductory_offer_eligibility = data["introductoryOfferEligibility"]
		if data.has("advancedCommerceData") and data["advancedCommerceData"] != null:
			obj.advanced_commerce_data = data["advancedCommerceData"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		if and_dangerously_finish_transaction_automatically != null:
			dict["andDangerouslyFinishTransactionAutomatically"] = and_dangerously_finish_transaction_automatically
		if app_account_token != null:
			dict["appAccountToken"] = app_account_token
		if quantity != null:
			dict["quantity"] = quantity
		if with_offer != null:
			if with_offer.has_method("to_dict"):
				dict["withOffer"] = with_offer.to_dict()
			else:
				dict["withOffer"] = with_offer
		if win_back_offer != null:
			if win_back_offer.has_method("to_dict"):
				dict["winBackOffer"] = win_back_offer.to_dict()
			else:
				dict["winBackOffer"] = win_back_offer
		if promotional_offer_jws != null:
			if promotional_offer_jws.has_method("to_dict"):
				dict["promotionalOfferJWS"] = promotional_offer_jws.to_dict()
			else:
				dict["promotionalOfferJWS"] = promotional_offer_jws
		if introductory_offer_eligibility != null:
			dict["introductoryOfferEligibility"] = introductory_offer_eligibility
		if advanced_commerce_data != null:
			dict["advancedCommerceData"] = advanced_commerce_data
		return dict

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
		var dict = {}
		if apple != null:
			if apple.has_method("to_dict"):
				dict["apple"] = apple.to_dict()
			else:
				dict["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				dict["google"] = google.to_dict()
			else:
				dict["google"] = google
		if ios != null:
			if ios.has_method("to_dict"):
				dict["ios"] = ios.to_dict()
			else:
				dict["ios"] = ios
		if android != null:
			if android.has_method("to_dict"):
				dict["android"] = android.to_dict()
			else:
				dict["android"] = android
		return dict

class RequestVerifyPurchaseWithIapkitAppleProps:
	## The JWS token returned with the purchase response.
	var jws: String

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitAppleProps:
		var obj = RequestVerifyPurchaseWithIapkitAppleProps.new()
		if data.has("jws") and data["jws"] != null:
			obj.jws = data["jws"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if jws != null:
			dict["jws"] = jws
		return dict

class RequestVerifyPurchaseWithIapkitGoogleProps:
	## The token provided to the user's device when the product or subscription was purchased.
	var purchase_token: String

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitGoogleProps:
		var obj = RequestVerifyPurchaseWithIapkitGoogleProps.new()
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		return dict

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
		var dict = {}
		if api_key != null:
			dict["apiKey"] = api_key
		if apple != null:
			if apple.has_method("to_dict"):
				dict["apple"] = apple.to_dict()
			else:
				dict["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				dict["google"] = google.to_dict()
			else:
				dict["google"] = google
		return dict

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
			var enum_str = data["replacementMode"]
			if enum_str is String and SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.replacement_mode = SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING[enum_str]
			else:
				obj.replacement_mode = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if old_product_id != null:
			dict["oldProductId"] = old_product_id
		if replacement_mode != null:
			if SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES.has(replacement_mode):
				dict["replacementMode"] = SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES[replacement_mode]
			else:
				dict["replacementMode"] = replacement_mode
		return dict

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
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		return dict

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
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		if package_name != null:
			dict["packageName"] = package_name
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		if access_token != null:
			dict["accessToken"] = access_token
		if is_sub != null:
			dict["isSub"] = is_sub
		return dict

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
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		if user_id != null:
			dict["userId"] = user_id
		if access_token != null:
			dict["accessToken"] = access_token
		return dict

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
		var dict = {}
		if apple != null:
			if apple.has_method("to_dict"):
				dict["apple"] = apple.to_dict()
			else:
				dict["apple"] = apple
		if google != null:
			if google.has_method("to_dict"):
				dict["google"] = google.to_dict()
			else:
				dict["google"] = google
		if horizon != null:
			if horizon.has_method("to_dict"):
				dict["horizon"] = horizon.to_dict()
			else:
				dict["horizon"] = horizon
		return dict

class VerifyPurchaseWithProviderProps:
	var provider: PurchaseVerificationProvider
	var iapkit: RequestVerifyPurchaseWithIapkitProps

	static func from_dict(data: Dictionary) -> VerifyPurchaseWithProviderProps:
		var obj = VerifyPurchaseWithProviderProps.new()
		if data.has("provider") and data["provider"] != null:
			var enum_str = data["provider"]
			if enum_str is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(enum_str):
				obj.provider = PURCHASE_VERIFICATION_PROVIDER_FROM_STRING[enum_str]
			else:
				obj.provider = enum_str
		if data.has("iapkit") and data["iapkit"] != null:
			if data["iapkit"] is Dictionary:
				obj.iapkit = RequestVerifyPurchaseWithIapkitProps.from_dict(data["iapkit"])
			else:
				obj.iapkit = data["iapkit"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if provider != null:
			if PURCHASE_VERIFICATION_PROVIDER_VALUES.has(provider):
				dict["provider"] = PURCHASE_VERIFICATION_PROVIDER_VALUES[provider]
			else:
				dict["provider"] = provider
		if iapkit != null:
			if iapkit.has_method("to_dict"):
				dict["iapkit"] = iapkit.to_dict()
			else:
				dict["iapkit"] = iapkit
		return dict

## Win-back offer input for iOS 18+ (StoreKit 2) Win-back offers are used to re-engage churned subscribers. The offer is automatically presented via StoreKit Message when eligible, or can be applied programmatically during purchase.
class WinBackOfferInputIOS:
	## The win-back offer ID from App Store Connect
	var offer_id: String

	static func from_dict(data: Dictionary) -> WinBackOfferInputIOS:
		var obj = WinBackOfferInputIOS.new()
		if data.has("offerId") and data["offerId"] != null:
			obj.offer_id = data["offerId"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if offer_id != null:
			dict["offerId"] = offer_id
		return dict

# ============================================================================
# Enum String Helpers
# ============================================================================

const ALTERNATIVE_BILLING_MODE_ANDROID_VALUES = {
	AlternativeBillingModeAndroid.NONE: "none",
	AlternativeBillingModeAndroid.USER_CHOICE: "user-choice",
	AlternativeBillingModeAndroid.ALTERNATIVE_ONLY: "alternative-only"
}

const BILLING_PROGRAM_ANDROID_VALUES = {
	BillingProgramAndroid.UNSPECIFIED: "unspecified",
	BillingProgramAndroid.USER_CHOICE_BILLING: "user-choice-billing",
	BillingProgramAndroid.EXTERNAL_CONTENT_LINK: "external-content-link",
	BillingProgramAndroid.EXTERNAL_OFFER: "external-offer",
	BillingProgramAndroid.EXTERNAL_PAYMENTS: "external-payments"
}

const DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES = {
	DeveloperBillingLaunchModeAndroid.UNSPECIFIED: "unspecified",
	DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP: "launch-in-external-browser-or-app",
	DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK: "caller-will-launch-link"
}

const DISCOUNT_OFFER_TYPE_VALUES = {
	DiscountOfferType.INTRODUCTORY: "introductory",
	DiscountOfferType.PROMOTIONAL: "promotional",
	DiscountOfferType.ONE_TIME: "one-time"
}

const ERROR_CODE_VALUES = {
	ErrorCode.UNKNOWN: "unknown",
	ErrorCode.USER_CANCELLED: "user-cancelled",
	ErrorCode.USER_ERROR: "user-error",
	ErrorCode.ITEM_UNAVAILABLE: "item-unavailable",
	ErrorCode.REMOTE_ERROR: "remote-error",
	ErrorCode.NETWORK_ERROR: "network-error",
	ErrorCode.SERVICE_ERROR: "service-error",
	ErrorCode.RECEIPT_FAILED: "receipt-failed",
	ErrorCode.RECEIPT_FINISHED: "receipt-finished",
	ErrorCode.RECEIPT_FINISHED_FAILED: "receipt-finished-failed",
	ErrorCode.PURCHASE_VERIFICATION_FAILED: "purchase-verification-failed",
	ErrorCode.PURCHASE_VERIFICATION_FINISHED: "purchase-verification-finished",
	ErrorCode.PURCHASE_VERIFICATION_FINISH_FAILED: "purchase-verification-finish-failed",
	ErrorCode.NOT_PREPARED: "not-prepared",
	ErrorCode.NOT_ENDED: "not-ended",
	ErrorCode.ALREADY_OWNED: "already-owned",
	ErrorCode.DEVELOPER_ERROR: "developer-error",
	ErrorCode.BILLING_RESPONSE_JSON_PARSE_ERROR: "billing-response-json-parse-error",
	ErrorCode.DEFERRED_PAYMENT: "deferred-payment",
	ErrorCode.INTERRUPTED: "interrupted",
	ErrorCode.IAP_NOT_AVAILABLE: "iap-not-available",
	ErrorCode.PURCHASE_ERROR: "purchase-error",
	ErrorCode.SYNC_ERROR: "sync-error",
	ErrorCode.TRANSACTION_VALIDATION_FAILED: "transaction-validation-failed",
	ErrorCode.ACTIVITY_UNAVAILABLE: "activity-unavailable",
	ErrorCode.ALREADY_PREPARED: "already-prepared",
	ErrorCode.PENDING: "pending",
	ErrorCode.CONNECTION_CLOSED: "connection-closed",
	ErrorCode.INIT_CONNECTION: "init-connection",
	ErrorCode.SERVICE_DISCONNECTED: "service-disconnected",
	ErrorCode.QUERY_PRODUCT: "query-product",
	ErrorCode.SKU_NOT_FOUND: "sku-not-found",
	ErrorCode.SKU_OFFER_MISMATCH: "sku-offer-mismatch",
	ErrorCode.ITEM_NOT_OWNED: "item-not-owned",
	ErrorCode.BILLING_UNAVAILABLE: "billing-unavailable",
	ErrorCode.FEATURE_NOT_SUPPORTED: "feature-not-supported",
	ErrorCode.EMPTY_SKU_LIST: "empty-sku-list"
}

const EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES = {
	ExternalLinkLaunchModeAndroid.UNSPECIFIED: "unspecified",
	ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP: "launch-in-external-browser-or-app",
	ExternalLinkLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK: "caller-will-launch-link"
}

const EXTERNAL_LINK_TYPE_ANDROID_VALUES = {
	ExternalLinkTypeAndroid.UNSPECIFIED: "unspecified",
	ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER: "link-to-digital-content-offer",
	ExternalLinkTypeAndroid.LINK_TO_APP_DOWNLOAD: "link-to-app-download"
}

const EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES = {
	ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER: "browser"
}

const EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES = {
	ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION: "acquisition",
	ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES: "services"
}

const EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES = {
	ExternalPurchaseNoticeAction.CONTINUE: "continue",
	ExternalPurchaseNoticeAction.DISMISSED: "dismissed"
}

const IAP_EVENT_VALUES = {
	IapEvent.PURCHASE_UPDATED: "purchase-updated",
	IapEvent.PURCHASE_ERROR: "purchase-error",
	IapEvent.PROMOTED_PRODUCT_IOS: "promoted-product-ios",
	IapEvent.USER_CHOICE_BILLING_ANDROID: "user-choice-billing-android",
	IapEvent.DEVELOPER_PROVIDED_BILLING_ANDROID: "developer-provided-billing-android"
}

const IAPKIT_PURCHASE_STATE_VALUES = {
	IapkitPurchaseState.ENTITLED: "entitled",
	IapkitPurchaseState.PENDING_ACKNOWLEDGMENT: "pending-acknowledgment",
	IapkitPurchaseState.PENDING: "pending",
	IapkitPurchaseState.CANCELED: "canceled",
	IapkitPurchaseState.EXPIRED: "expired",
	IapkitPurchaseState.READY_TO_CONSUME: "ready-to-consume",
	IapkitPurchaseState.CONSUMED: "consumed",
	IapkitPurchaseState.UNKNOWN: "unknown",
	IapkitPurchaseState.INAUTHENTIC: "inauthentic"
}

const IAP_PLATFORM_VALUES = {
	IapPlatform.IOS: "ios",
	IapPlatform.ANDROID: "android"
}

const IAP_STORE_VALUES = {
	IapStore.UNKNOWN: "unknown",
	IapStore.APPLE: "apple",
	IapStore.GOOGLE: "google",
	IapStore.HORIZON: "horizon"
}

const PAYMENT_MODE_VALUES = {
	PaymentMode.FREE_TRIAL: "free-trial",
	PaymentMode.PAY_AS_YOU_GO: "pay-as-you-go",
	PaymentMode.PAY_UP_FRONT: "pay-up-front",
	PaymentMode.UNKNOWN: "unknown"
}

const PAYMENT_MODE_IOS_VALUES = {
	PaymentModeIOS.EMPTY: "empty",
	PaymentModeIOS.FREE_TRIAL: "free-trial",
	PaymentModeIOS.PAY_AS_YOU_GO: "pay-as-you-go",
	PaymentModeIOS.PAY_UP_FRONT: "pay-up-front"
}

const PRODUCT_QUERY_TYPE_VALUES = {
	ProductQueryType.IN_APP: "in-app",
	ProductQueryType.SUBS: "subs",
	ProductQueryType.ALL: "all"
}

const PRODUCT_STATUS_ANDROID_VALUES = {
	ProductStatusAndroid.OK: "ok",
	ProductStatusAndroid.NOT_FOUND: "not-found",
	ProductStatusAndroid.NO_OFFERS_AVAILABLE: "no-offers-available",
	ProductStatusAndroid.UNKNOWN: "unknown"
}

const PRODUCT_TYPE_VALUES = {
	ProductType.IN_APP: "in-app",
	ProductType.SUBS: "subs"
}

const PRODUCT_TYPE_IOS_VALUES = {
	ProductTypeIOS.CONSUMABLE: "consumable",
	ProductTypeIOS.NON_CONSUMABLE: "non-consumable",
	ProductTypeIOS.AUTO_RENEWABLE_SUBSCRIPTION: "auto-renewable-subscription",
	ProductTypeIOS.NON_RENEWING_SUBSCRIPTION: "non-renewing-subscription"
}

const PURCHASE_STATE_VALUES = {
	PurchaseState.PENDING: "pending",
	PurchaseState.PURCHASED: "purchased",
	PurchaseState.UNKNOWN: "unknown"
}

const PURCHASE_VERIFICATION_PROVIDER_VALUES = {
	PurchaseVerificationProvider.IAPKIT: "iapkit"
}

const SUB_RESPONSE_CODE_ANDROID_VALUES = {
	SubResponseCodeAndroid.NO_APPLICABLE_SUB_RESPONSE_CODE: "no-applicable-sub-response-code",
	SubResponseCodeAndroid.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS: "payment-declined-due-to-insufficient-funds",
	SubResponseCodeAndroid.USER_INELIGIBLE: "user-ineligible"
}

const SUBSCRIPTION_OFFER_TYPE_IOS_VALUES = {
	SubscriptionOfferTypeIOS.INTRODUCTORY: "introductory",
	SubscriptionOfferTypeIOS.PROMOTIONAL: "promotional",
	SubscriptionOfferTypeIOS.WIN_BACK: "win-back"
}

const SUBSCRIPTION_PERIOD_IOS_VALUES = {
	SubscriptionPeriodIOS.DAY: "day",
	SubscriptionPeriodIOS.WEEK: "week",
	SubscriptionPeriodIOS.MONTH: "month",
	SubscriptionPeriodIOS.YEAR: "year",
	SubscriptionPeriodIOS.EMPTY: "empty"
}

const SUBSCRIPTION_PERIOD_UNIT_VALUES = {
	SubscriptionPeriodUnit.DAY: "day",
	SubscriptionPeriodUnit.WEEK: "week",
	SubscriptionPeriodUnit.MONTH: "month",
	SubscriptionPeriodUnit.YEAR: "year",
	SubscriptionPeriodUnit.UNKNOWN: "unknown"
}

const SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES = {
	SubscriptionReplacementModeAndroid.UNKNOWN_REPLACEMENT_MODE: "unknown-replacement-mode",
	SubscriptionReplacementModeAndroid.WITH_TIME_PRORATION: "with-time-proration",
	SubscriptionReplacementModeAndroid.CHARGE_PRORATED_PRICE: "charge-prorated-price",
	SubscriptionReplacementModeAndroid.CHARGE_FULL_PRICE: "charge-full-price",
	SubscriptionReplacementModeAndroid.WITHOUT_PRORATION: "without-proration",
	SubscriptionReplacementModeAndroid.DEFERRED: "deferred",
	SubscriptionReplacementModeAndroid.KEEP_EXISTING: "keep-existing"
}

# ============================================================================
# Enum Reverse Lookup (string -> enum for deserialization)
# ============================================================================

const ALTERNATIVE_BILLING_MODE_ANDROID_FROM_STRING = {
	"none": AlternativeBillingModeAndroid.NONE,
	"user-choice": AlternativeBillingModeAndroid.USER_CHOICE,
	"alternative-only": AlternativeBillingModeAndroid.ALTERNATIVE_ONLY
}

const BILLING_PROGRAM_ANDROID_FROM_STRING = {
	"unspecified": BillingProgramAndroid.UNSPECIFIED,
	"user-choice-billing": BillingProgramAndroid.USER_CHOICE_BILLING,
	"external-content-link": BillingProgramAndroid.EXTERNAL_CONTENT_LINK,
	"external-offer": BillingProgramAndroid.EXTERNAL_OFFER,
	"external-payments": BillingProgramAndroid.EXTERNAL_PAYMENTS
}

const DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING = {
	"unspecified": DeveloperBillingLaunchModeAndroid.UNSPECIFIED,
	"launch-in-external-browser-or-app": DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP,
	"caller-will-launch-link": DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK
}

const DISCOUNT_OFFER_TYPE_FROM_STRING = {
	"introductory": DiscountOfferType.INTRODUCTORY,
	"promotional": DiscountOfferType.PROMOTIONAL,
	"one-time": DiscountOfferType.ONE_TIME
}

const ERROR_CODE_FROM_STRING = {
	"unknown": ErrorCode.UNKNOWN,
	"user-cancelled": ErrorCode.USER_CANCELLED,
	"user-error": ErrorCode.USER_ERROR,
	"item-unavailable": ErrorCode.ITEM_UNAVAILABLE,
	"remote-error": ErrorCode.REMOTE_ERROR,
	"network-error": ErrorCode.NETWORK_ERROR,
	"service-error": ErrorCode.SERVICE_ERROR,
	"receipt-failed": ErrorCode.RECEIPT_FAILED,
	"receipt-finished": ErrorCode.RECEIPT_FINISHED,
	"receipt-finished-failed": ErrorCode.RECEIPT_FINISHED_FAILED,
	"purchase-verification-failed": ErrorCode.PURCHASE_VERIFICATION_FAILED,
	"purchase-verification-finished": ErrorCode.PURCHASE_VERIFICATION_FINISHED,
	"purchase-verification-finish-failed": ErrorCode.PURCHASE_VERIFICATION_FINISH_FAILED,
	"not-prepared": ErrorCode.NOT_PREPARED,
	"not-ended": ErrorCode.NOT_ENDED,
	"already-owned": ErrorCode.ALREADY_OWNED,
	"developer-error": ErrorCode.DEVELOPER_ERROR,
	"billing-response-json-parse-error": ErrorCode.BILLING_RESPONSE_JSON_PARSE_ERROR,
	"deferred-payment": ErrorCode.DEFERRED_PAYMENT,
	"interrupted": ErrorCode.INTERRUPTED,
	"iap-not-available": ErrorCode.IAP_NOT_AVAILABLE,
	"purchase-error": ErrorCode.PURCHASE_ERROR,
	"sync-error": ErrorCode.SYNC_ERROR,
	"transaction-validation-failed": ErrorCode.TRANSACTION_VALIDATION_FAILED,
	"activity-unavailable": ErrorCode.ACTIVITY_UNAVAILABLE,
	"already-prepared": ErrorCode.ALREADY_PREPARED,
	"pending": ErrorCode.PENDING,
	"connection-closed": ErrorCode.CONNECTION_CLOSED,
	"init-connection": ErrorCode.INIT_CONNECTION,
	"service-disconnected": ErrorCode.SERVICE_DISCONNECTED,
	"query-product": ErrorCode.QUERY_PRODUCT,
	"sku-not-found": ErrorCode.SKU_NOT_FOUND,
	"sku-offer-mismatch": ErrorCode.SKU_OFFER_MISMATCH,
	"item-not-owned": ErrorCode.ITEM_NOT_OWNED,
	"billing-unavailable": ErrorCode.BILLING_UNAVAILABLE,
	"feature-not-supported": ErrorCode.FEATURE_NOT_SUPPORTED,
	"empty-sku-list": ErrorCode.EMPTY_SKU_LIST
}

const EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING = {
	"unspecified": ExternalLinkLaunchModeAndroid.UNSPECIFIED,
	"launch-in-external-browser-or-app": ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP,
	"caller-will-launch-link": ExternalLinkLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK
}

const EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING = {
	"unspecified": ExternalLinkTypeAndroid.UNSPECIFIED,
	"link-to-digital-content-offer": ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER,
	"link-to-app-download": ExternalLinkTypeAndroid.LINK_TO_APP_DOWNLOAD
}

const EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_FROM_STRING = {
	"browser": ExternalPurchaseCustomLinkNoticeTypeIOS.BROWSER
}

const EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_FROM_STRING = {
	"acquisition": ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION,
	"services": ExternalPurchaseCustomLinkTokenTypeIOS.SERVICES
}

const EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING = {
	"continue": ExternalPurchaseNoticeAction.CONTINUE,
	"dismissed": ExternalPurchaseNoticeAction.DISMISSED
}

const IAP_EVENT_FROM_STRING = {
	"purchase-updated": IapEvent.PURCHASE_UPDATED,
	"purchase-error": IapEvent.PURCHASE_ERROR,
	"promoted-product-ios": IapEvent.PROMOTED_PRODUCT_IOS,
	"user-choice-billing-android": IapEvent.USER_CHOICE_BILLING_ANDROID,
	"developer-provided-billing-android": IapEvent.DEVELOPER_PROVIDED_BILLING_ANDROID
}

const IAPKIT_PURCHASE_STATE_FROM_STRING = {
	"entitled": IapkitPurchaseState.ENTITLED,
	"pending-acknowledgment": IapkitPurchaseState.PENDING_ACKNOWLEDGMENT,
	"pending": IapkitPurchaseState.PENDING,
	"canceled": IapkitPurchaseState.CANCELED,
	"expired": IapkitPurchaseState.EXPIRED,
	"ready-to-consume": IapkitPurchaseState.READY_TO_CONSUME,
	"consumed": IapkitPurchaseState.CONSUMED,
	"unknown": IapkitPurchaseState.UNKNOWN,
	"inauthentic": IapkitPurchaseState.INAUTHENTIC
}

const IAP_PLATFORM_FROM_STRING = {
	"ios": IapPlatform.IOS,
	"android": IapPlatform.ANDROID
}

const IAP_STORE_FROM_STRING = {
	"unknown": IapStore.UNKNOWN,
	"apple": IapStore.APPLE,
	"google": IapStore.GOOGLE,
	"horizon": IapStore.HORIZON
}

const PAYMENT_MODE_FROM_STRING = {
	"free-trial": PaymentMode.FREE_TRIAL,
	"pay-as-you-go": PaymentMode.PAY_AS_YOU_GO,
	"pay-up-front": PaymentMode.PAY_UP_FRONT,
	"unknown": PaymentMode.UNKNOWN
}

const PAYMENT_MODE_IOS_FROM_STRING = {
	"empty": PaymentModeIOS.EMPTY,
	"free-trial": PaymentModeIOS.FREE_TRIAL,
	"pay-as-you-go": PaymentModeIOS.PAY_AS_YOU_GO,
	"pay-up-front": PaymentModeIOS.PAY_UP_FRONT
}

const PRODUCT_QUERY_TYPE_FROM_STRING = {
	"in-app": ProductQueryType.IN_APP,
	"subs": ProductQueryType.SUBS,
	"all": ProductQueryType.ALL
}

const PRODUCT_STATUS_ANDROID_FROM_STRING = {
	"ok": ProductStatusAndroid.OK,
	"not-found": ProductStatusAndroid.NOT_FOUND,
	"no-offers-available": ProductStatusAndroid.NO_OFFERS_AVAILABLE,
	"unknown": ProductStatusAndroid.UNKNOWN
}

const PRODUCT_TYPE_FROM_STRING = {
	"in-app": ProductType.IN_APP,
	"subs": ProductType.SUBS
}

const PRODUCT_TYPE_IOS_FROM_STRING = {
	"consumable": ProductTypeIOS.CONSUMABLE,
	"non-consumable": ProductTypeIOS.NON_CONSUMABLE,
	"auto-renewable-subscription": ProductTypeIOS.AUTO_RENEWABLE_SUBSCRIPTION,
	"non-renewing-subscription": ProductTypeIOS.NON_RENEWING_SUBSCRIPTION
}

const PURCHASE_STATE_FROM_STRING = {
	"pending": PurchaseState.PENDING,
	"purchased": PurchaseState.PURCHASED,
	"unknown": PurchaseState.UNKNOWN
}

const PURCHASE_VERIFICATION_PROVIDER_FROM_STRING = {
	"iapkit": PurchaseVerificationProvider.IAPKIT
}

const SUB_RESPONSE_CODE_ANDROID_FROM_STRING = {
	"no-applicable-sub-response-code": SubResponseCodeAndroid.NO_APPLICABLE_SUB_RESPONSE_CODE,
	"payment-declined-due-to-insufficient-funds": SubResponseCodeAndroid.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS,
	"user-ineligible": SubResponseCodeAndroid.USER_INELIGIBLE
}

const SUBSCRIPTION_OFFER_TYPE_IOS_FROM_STRING = {
	"introductory": SubscriptionOfferTypeIOS.INTRODUCTORY,
	"promotional": SubscriptionOfferTypeIOS.PROMOTIONAL,
	"win-back": SubscriptionOfferTypeIOS.WIN_BACK
}

const SUBSCRIPTION_PERIOD_IOS_FROM_STRING = {
	"day": SubscriptionPeriodIOS.DAY,
	"week": SubscriptionPeriodIOS.WEEK,
	"month": SubscriptionPeriodIOS.MONTH,
	"year": SubscriptionPeriodIOS.YEAR,
	"empty": SubscriptionPeriodIOS.EMPTY
}

const SUBSCRIPTION_PERIOD_UNIT_FROM_STRING = {
	"day": SubscriptionPeriodUnit.DAY,
	"week": SubscriptionPeriodUnit.WEEK,
	"month": SubscriptionPeriodUnit.MONTH,
	"year": SubscriptionPeriodUnit.YEAR,
	"unknown": SubscriptionPeriodUnit.UNKNOWN
}

const SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING = {
	"unknown-replacement-mode": SubscriptionReplacementModeAndroid.UNKNOWN_REPLACEMENT_MODE,
	"with-time-proration": SubscriptionReplacementModeAndroid.WITH_TIME_PRORATION,
	"charge-prorated-price": SubscriptionReplacementModeAndroid.CHARGE_PRORATED_PRICE,
	"charge-full-price": SubscriptionReplacementModeAndroid.CHARGE_FULL_PRICE,
	"without-proration": SubscriptionReplacementModeAndroid.WITHOUT_PRORATION,
	"deferred": SubscriptionReplacementModeAndroid.DEFERRED,
	"keep-existing": SubscriptionReplacementModeAndroid.KEEP_EXISTING
}

# ============================================================================
# Query Types
# ============================================================================

class Query:
	class _placeholderField:
		const name = "_placeholder"
		const snake_name = "_placeholder"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Retrieve products or subscriptions from the store
	class fetchProductsField:
		const name = "fetchProducts"
		const snake_name = "fetch_products"
		class Args:
			var params: ProductRequest

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["params"] = params
				return dict
		const return_type = "FetchProductsResult"
		const is_array = false

	## Get all available purchases for the current user
	class getAvailablePurchasesField:
		const name = "getAvailablePurchases"
		const snake_name = "get_available_purchases"
		class Args:
			var options: PurchaseOptions

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "Purchase"
		const is_array = true

	## Get active subscriptions (filters by subscriptionIds when provided)
	class getActiveSubscriptionsField:
		const name = "getActiveSubscriptions"
		const snake_name = "get_active_subscriptions"
		class Args:
			var subscription_ids: Array[String]

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("subscriptionIds") and data["subscriptionIds"] != null:
					obj.subscription_ids = data["subscriptionIds"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["subscriptionIds"] = subscription_ids
				return dict
		const return_type = "ActiveSubscription"
		const is_array = true

	## Check whether the user has active subscriptions
	class hasActiveSubscriptionsField:
		const name = "hasActiveSubscriptions"
		const snake_name = "has_active_subscriptions"
		class Args:
			var subscription_ids: Array[String]

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("subscriptionIds") and data["subscriptionIds"] != null:
					obj.subscription_ids = data["subscriptionIds"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["subscriptionIds"] = subscription_ids
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Get the current storefront country code
	class getStorefrontField:
		const name = "getStorefront"
		const snake_name = "get_storefront"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Get the current App Store storefront country code
	class getStorefrontIOSField:
		const name = "getStorefrontIOS"
		const snake_name = "get_storefront_ios"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Get the currently promoted product (iOS 11+)
	class getPromotedProductIOSField:
		const name = "getPromotedProductIOS"
		const snake_name = "get_promoted_product_ios"
		class Args:
			pass
		const return_type = "ProductIOS"
		const is_array = false

	## Check if external purchase notice sheet can be presented (iOS 17.4+)
	class canPresentExternalPurchaseNoticeIOSField:
		const name = "canPresentExternalPurchaseNoticeIOS"
		const snake_name = "can_present_external_purchase_notice_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
	class isEligibleForExternalPurchaseCustomLinkIOSField:
		const name = "isEligibleForExternalPurchaseCustomLinkIOS"
		const snake_name = "is_eligible_for_external_purchase_custom_link_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Get external purchase token for reporting to Apple (iOS 18.1+).
	class getExternalPurchaseCustomLinkTokenIOSField:
		const name = "getExternalPurchaseCustomLinkTokenIOS"
		const snake_name = "get_external_purchase_custom_link_token_ios"
		class Args:
			## Token type: acquisition (new customers) or services (existing customers)
			var token_type: ExternalPurchaseCustomLinkTokenTypeIOS

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("tokenType") and data["tokenType"] != null:
					var enum_str = data["tokenType"]
					if enum_str is String and EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_FROM_STRING.has(enum_str):
						obj.token_type = EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_FROM_STRING[enum_str]
					else:
						obj.token_type = enum_str
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES.has(token_type):
					dict["tokenType"] = EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES[token_type]
				else:
					dict["tokenType"] = token_type
				return dict
		const return_type = "ExternalPurchaseCustomLinkTokenResultIOS"
		const is_array = false

	## Retrieve all pending transactions in the StoreKit queue
	class getPendingTransactionsIOSField:
		const name = "getPendingTransactionsIOS"
		const snake_name = "get_pending_transactions_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = true

	## Check introductory offer eligibility for a subscription group
	class isEligibleForIntroOfferIOSField:
		const name = "isEligibleForIntroOfferIOS"
		const snake_name = "is_eligible_for_intro_offer_ios"
		class Args:
			var group_id: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("groupID") and data["groupID"] != null:
					obj.group_id = data["groupID"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["groupID"] = group_id
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Get StoreKit 2 subscription status details (iOS 15+)
	class subscriptionStatusIOSField:
		const name = "subscriptionStatusIOS"
		const snake_name = "subscription_status_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "SubscriptionStatusIOS"
		const is_array = true

	## Get current StoreKit 2 entitlements (iOS 15+)
	class currentEntitlementIOSField:
		const name = "currentEntitlementIOS"
		const snake_name = "current_entitlement_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "PurchaseIOS"
		const is_array = false

	## Get the latest transaction for a product using StoreKit 2
	class latestTransactionIOSField:
		const name = "latestTransactionIOS"
		const snake_name = "latest_transaction_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "PurchaseIOS"
		const is_array = false

	## Verify a StoreKit 2 transaction signature
	class isTransactionVerifiedIOSField:
		const name = "isTransactionVerifiedIOS"
		const snake_name = "is_transaction_verified_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Get the transaction JWS (StoreKit 2)
	class getTransactionJwsIOSField:
		const name = "getTransactionJwsIOS"
		const snake_name = "get_transaction_jws_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "String"
		const is_array = false

	## Get base64-encoded receipt data for validation
	class getReceiptDataIOSField:
		const name = "getReceiptDataIOS"
		const snake_name = "get_receipt_data_ios"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Fetch the current app transaction (iOS 16+)
	class getAppTransactionIOSField:
		const name = "getAppTransactionIOS"
		const snake_name = "get_app_transaction_ios"
		class Args:
			pass
		const return_type = "AppTransaction"
		const is_array = false

	## Validate a receipt for a specific product
	class validateReceiptIOSField:
		const name = "validateReceiptIOS"
		const snake_name = "validate_receipt_ios"
		class Args:
			var options: VerifyPurchaseProps

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "VerifyPurchaseResultIOS"
		const is_array = false


# ============================================================================
# Mutation Types
# ============================================================================

class Mutation:
	class _placeholderField:
		const name = "_placeholder"
		const snake_name = "_placeholder"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Establish the platform billing connection
	class initConnectionField:
		const name = "initConnection"
		const snake_name = "init_connection"
		class Args:
			var config: InitConnectionConfig

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("config") and data["config"] != null:
					obj.config = data["config"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["config"] = config
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Close the platform billing connection
	class endConnectionField:
		const name = "endConnection"
		const snake_name = "end_connection"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Initiate a purchase flow; rely on events for final state
	class requestPurchaseField:
		const name = "requestPurchase"
		const snake_name = "request_purchase"
		class Args:
			var params: RequestPurchaseProps

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["params"] = params
				return dict
		const return_type = "RequestPurchaseResult"
		const is_array = false

	## Finish a transaction after validating receipts
	class finishTransactionField:
		const name = "finishTransaction"
		const snake_name = "finish_transaction"
		class Args:
			var purchase: PurchaseInput
			var is_consumable: bool

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("purchase") and data["purchase"] != null:
					obj.purchase = data["purchase"]
				if data.has("isConsumable") and data["isConsumable"] != null:
					obj.is_consumable = data["isConsumable"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["purchase"] = purchase
				dict["isConsumable"] = is_consumable
				return dict
		const return_type = "VoidResult"
		const is_array = false

	## Restore completed purchases across platforms
	class restorePurchasesField:
		const name = "restorePurchases"
		const snake_name = "restore_purchases"
		class Args:
			pass
		const return_type = "VoidResult"
		const is_array = false

	## Open the native subscription management surface
	class deepLinkToSubscriptionsField:
		const name = "deepLinkToSubscriptions"
		const snake_name = "deep_link_to_subscriptions"
		class Args:
			var options: DeepLinkOptions

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "VoidResult"
		const is_array = false

	## Validate purchase receipts with the configured providers
	class validateReceiptField:
		const name = "validateReceipt"
		const snake_name = "validate_receipt"
		class Args:
			var options: VerifyPurchaseProps

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "VerifyPurchaseResult"
		const is_array = false

	## Verify purchases with the configured providers
	class verifyPurchaseField:
		const name = "verifyPurchase"
		const snake_name = "verify_purchase"
		class Args:
			var options: VerifyPurchaseProps

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "VerifyPurchaseResult"
		const is_array = false

	## Verify purchases with a specific provider (e.g., IAPKit)
	class verifyPurchaseWithProviderField:
		const name = "verifyPurchaseWithProvider"
		const snake_name = "verify_purchase_with_provider"
		class Args:
			var options: VerifyPurchaseWithProviderProps

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["options"] = options
				return dict
		const return_type = "VerifyPurchaseWithProviderResult"
		const is_array = false

	## Clear pending transactions from the StoreKit payment queue
	class clearTransactionIOSField:
		const name = "clearTransactionIOS"
		const snake_name = "clear_transaction_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Purchase the promoted product surfaced by the App Store.
	class requestPurchaseOnPromotedProductIOSField:
		const name = "requestPurchaseOnPromotedProductIOS"
		const snake_name = "request_purchase_on_promoted_product_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Open subscription management UI and return changed purchases (iOS 15+)
	class showManageSubscriptionsIOSField:
		const name = "showManageSubscriptionsIOS"
		const snake_name = "show_manage_subscriptions_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = true

	## Initiate a refund request for a product (iOS 15+)
	class beginRefundRequestIOSField:
		const name = "beginRefundRequestIOS"
		const snake_name = "begin_refund_request_ios"
		class Args:
			var sku: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("sku") and data["sku"] != null:
					obj.sku = data["sku"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["sku"] = sku
				return dict
		const return_type = "String"
		const is_array = false

	## Force a StoreKit sync for transactions (iOS 15+)
	class syncIOSField:
		const name = "syncIOS"
		const snake_name = "sync_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Present the App Store code redemption sheet
	class presentCodeRedemptionSheetIOSField:
		const name = "presentCodeRedemptionSheetIOS"
		const snake_name = "present_code_redemption_sheet_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Present external purchase notice sheet (iOS 17.4+).
	class presentExternalPurchaseNoticeSheetIOSField:
		const name = "presentExternalPurchaseNoticeSheetIOS"
		const snake_name = "present_external_purchase_notice_sheet_ios"
		class Args:
			pass
		const return_type = "ExternalPurchaseNoticeResultIOS"
		const is_array = false

	## Present external purchase custom link with StoreKit UI
	class presentExternalPurchaseLinkIOSField:
		const name = "presentExternalPurchaseLinkIOS"
		const snake_name = "present_external_purchase_link_ios"
		class Args:
			var url: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("url") and data["url"] != null:
					obj.url = data["url"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["url"] = url
				return dict
		const return_type = "ExternalPurchaseLinkResultIOS"
		const is_array = false

	## Show ExternalPurchaseCustomLink notice sheet (iOS 18.1+).
	class showExternalPurchaseCustomLinkNoticeIOSField:
		const name = "showExternalPurchaseCustomLinkNoticeIOS"
		const snake_name = "show_external_purchase_custom_link_notice_ios"
		class Args:
			## Notice type determining the style of disclosure
			var notice_type: ExternalPurchaseCustomLinkNoticeTypeIOS

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("noticeType") and data["noticeType"] != null:
					var enum_str = data["noticeType"]
					if enum_str is String and EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_FROM_STRING.has(enum_str):
						obj.notice_type = EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_FROM_STRING[enum_str]
					else:
						obj.notice_type = enum_str
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES.has(notice_type):
					dict["noticeType"] = EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES[notice_type]
				else:
					dict["noticeType"] = notice_type
				return dict
		const return_type = "ExternalPurchaseCustomLinkNoticeResultIOS"
		const is_array = false

	## Acknowledge a non-consumable purchase or subscription
	class acknowledgePurchaseAndroidField:
		const name = "acknowledgePurchaseAndroid"
		const snake_name = "acknowledge_purchase_android"
		class Args:
			var purchase_token: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("purchaseToken") and data["purchaseToken"] != null:
					obj.purchase_token = data["purchaseToken"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["purchaseToken"] = purchase_token
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Consume a purchase token so it can be repurchased
	class consumePurchaseAndroidField:
		const name = "consumePurchaseAndroid"
		const snake_name = "consume_purchase_android"
		class Args:
			var purchase_token: String

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("purchaseToken") and data["purchaseToken"] != null:
					obj.purchase_token = data["purchaseToken"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["purchaseToken"] = purchase_token
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Check if alternative billing is available for this user/device
	class checkAlternativeBillingAvailabilityAndroidField:
		const name = "checkAlternativeBillingAvailabilityAndroid"
		const snake_name = "check_alternative_billing_availability_android"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Show alternative billing information dialog to user
	class showAlternativeBillingDialogAndroidField:
		const name = "showAlternativeBillingDialogAndroid"
		const snake_name = "show_alternative_billing_dialog_android"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Create external transaction token for Google Play reporting
	class createAlternativeBillingTokenAndroidField:
		const name = "createAlternativeBillingTokenAndroid"
		const snake_name = "create_alternative_billing_token_android"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Check if a billing program is available for the current user
	class isBillingProgramAvailableAndroidField:
		const name = "isBillingProgramAvailableAndroid"
		const snake_name = "is_billing_program_available_android"
		class Args:
			var program: BillingProgramAndroid

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("program") and data["program"] != null:
					var enum_str = data["program"]
					if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
						obj.program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
					else:
						obj.program = enum_str
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if BILLING_PROGRAM_ANDROID_VALUES.has(program):
					dict["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]
				else:
					dict["program"] = program
				return dict
		const return_type = "BillingProgramAvailabilityResultAndroid"
		const is_array = false

	## Create reporting details for a billing program
	class createBillingProgramReportingDetailsAndroidField:
		const name = "createBillingProgramReportingDetailsAndroid"
		const snake_name = "create_billing_program_reporting_details_android"
		class Args:
			var program: BillingProgramAndroid

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("program") and data["program"] != null:
					var enum_str = data["program"]
					if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
						obj.program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
					else:
						obj.program = enum_str
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if BILLING_PROGRAM_ANDROID_VALUES.has(program):
					dict["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]
				else:
					dict["program"] = program
				return dict
		const return_type = "BillingProgramReportingDetailsAndroid"
		const is_array = false

	## Launch external link flow for external billing programs
	class launchExternalLinkAndroidField:
		const name = "launchExternalLinkAndroid"
		const snake_name = "launch_external_link_android"
		class Args:
			var params: LaunchExternalLinkParamsAndroid

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["params"] = params
				return dict
		const return_type = "Boolean"
		const is_array = false


# ============================================================================
# API Wrapper Functions
# These typed functions can be used by godot-iap wrapper
# ============================================================================

# Query API helpers

## Retrieve products or subscriptions from the store
static func fetch_products_args(params: ProductRequest) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## Get all available purchases for the current user
static func get_available_purchases_args(options: PurchaseOptions) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Get active subscriptions (filters by subscriptionIds when provided)
static func get_active_subscriptions_args(subscription_ids: Array[String]) -> Dictionary:
	var args = {}
	args["subscriptionIds"] = subscription_ids
	return args

## Check whether the user has active subscriptions
static func has_active_subscriptions_args(subscription_ids: Array[String]) -> Dictionary:
	var args = {}
	args["subscriptionIds"] = subscription_ids
	return args

## Get the current storefront country code
static func get_storefront_args() -> Dictionary:
	return {}

## Get the current App Store storefront country code
static func get_storefront_ios_args() -> Dictionary:
	return {}

## Get the currently promoted product (iOS 11+)
static func get_promoted_product_ios_args() -> Dictionary:
	return {}

## Check if external purchase notice sheet can be presented (iOS 17.4+)
static func can_present_external_purchase_notice_ios_args() -> Dictionary:
	return {}

## Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
static func is_eligible_for_external_purchase_custom_link_ios_args() -> Dictionary:
	return {}

## Get external purchase token for reporting to Apple (iOS 18.1+).
static func get_external_purchase_custom_link_token_ios_args(token_type: ExternalPurchaseCustomLinkTokenTypeIOS) -> Dictionary:
	var args = {}
	args["tokenType"] = token_type
	return args

## Retrieve all pending transactions in the StoreKit queue
static func get_pending_transactions_ios_args() -> Dictionary:
	return {}

## Check introductory offer eligibility for a subscription group
static func is_eligible_for_intro_offer_ios_args(group_id: String) -> Dictionary:
	var args = {}
	args["groupID"] = group_id
	return args

## Get StoreKit 2 subscription status details (iOS 15+)
static func subscription_status_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get current StoreKit 2 entitlements (iOS 15+)
static func current_entitlement_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get the latest transaction for a product using StoreKit 2
static func latest_transaction_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Verify a StoreKit 2 transaction signature
static func is_transaction_verified_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get the transaction JWS (StoreKit 2)
static func get_transaction_jws_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get base64-encoded receipt data for validation
static func get_receipt_data_ios_args() -> Dictionary:
	return {}

## Fetch the current app transaction (iOS 16+)
static func get_app_transaction_ios_args() -> Dictionary:
	return {}

## Validate a receipt for a specific product
static func validate_receipt_ios_args(options: VerifyPurchaseProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

# Mutation API helpers

## Establish the platform billing connection
static func init_connection_args(config: InitConnectionConfig) -> Dictionary:
	var args = {}
	if config != null:
		if config.has_method("to_dict"):
			args["config"] = config.to_dict()
		else:
			args["config"] = config
	return args

## Close the platform billing connection
static func end_connection_args() -> Dictionary:
	return {}

## Initiate a purchase flow; rely on events for final state
static func request_purchase_args(params: RequestPurchaseProps) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## Finish a transaction after validating receipts
static func finish_transaction_args(purchase: PurchaseInput, is_consumable: bool) -> Dictionary:
	var args = {}
	if purchase != null:
		if purchase.has_method("to_dict"):
			args["purchase"] = purchase.to_dict()
		else:
			args["purchase"] = purchase
	args["isConsumable"] = is_consumable
	return args

## Restore completed purchases across platforms
static func restore_purchases_args() -> Dictionary:
	return {}

## Open the native subscription management surface
static func deep_link_to_subscriptions_args(options: DeepLinkOptions) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Validate purchase receipts with the configured providers
static func validate_receipt_args(options: VerifyPurchaseProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Verify purchases with the configured providers
static func verify_purchase_args(options: VerifyPurchaseProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Verify purchases with a specific provider (e.g., IAPKit)
static func verify_purchase_with_provider_args(options: VerifyPurchaseWithProviderProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Clear pending transactions from the StoreKit payment queue
static func clear_transaction_ios_args() -> Dictionary:
	return {}

## Purchase the promoted product surfaced by the App Store.
static func request_purchase_on_promoted_product_ios_args() -> Dictionary:
	return {}

## Open subscription management UI and return changed purchases (iOS 15+)
static func show_manage_subscriptions_ios_args() -> Dictionary:
	return {}

## Initiate a refund request for a product (iOS 15+)
static func begin_refund_request_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Force a StoreKit sync for transactions (iOS 15+)
static func sync_ios_args() -> Dictionary:
	return {}

## Present the App Store code redemption sheet
static func present_code_redemption_sheet_ios_args() -> Dictionary:
	return {}

## Present external purchase notice sheet (iOS 17.4+).
static func present_external_purchase_notice_sheet_ios_args() -> Dictionary:
	return {}

## Present external purchase custom link with StoreKit UI
static func present_external_purchase_link_ios_args(url: String) -> Dictionary:
	var args = {}
	args["url"] = url
	return args

## Show ExternalPurchaseCustomLink notice sheet (iOS 18.1+).
static func show_external_purchase_custom_link_notice_ios_args(notice_type: ExternalPurchaseCustomLinkNoticeTypeIOS) -> Dictionary:
	var args = {}
	args["noticeType"] = notice_type
	return args

## Acknowledge a non-consumable purchase or subscription
static func acknowledge_purchase_android_args(purchase_token: String) -> Dictionary:
	var args = {}
	args["purchaseToken"] = purchase_token
	return args

## Consume a purchase token so it can be repurchased
static func consume_purchase_android_args(purchase_token: String) -> Dictionary:
	var args = {}
	args["purchaseToken"] = purchase_token
	return args

## Check if alternative billing is available for this user/device
static func check_alternative_billing_availability_android_args() -> Dictionary:
	return {}

## Show alternative billing information dialog to user
static func show_alternative_billing_dialog_android_args() -> Dictionary:
	return {}

## Create external transaction token for Google Play reporting
static func create_alternative_billing_token_android_args() -> Dictionary:
	return {}

## Check if a billing program is available for the current user
static func is_billing_program_available_android_args(program: BillingProgramAndroid) -> Dictionary:
	var args = {}
	args["program"] = program
	return args

## Create reporting details for a billing program
static func create_billing_program_reporting_details_android_args(program: BillingProgramAndroid) -> Dictionary:
	var args = {}
	args["program"] = program
	return args

## Launch external link flow for external billing programs
static func launch_external_link_android_args(params: LaunchExternalLinkParamsAndroid) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args
