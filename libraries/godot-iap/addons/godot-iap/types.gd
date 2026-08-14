# ============================================================================
# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
# Refresh this file with the generated-types workflow documented for your checkout.
# ============================================================================
# Generated from OpenIAP GraphQL schema (https://openiap.dev)
# Usage: const Types = preload("types.gd")
#        var store: Types.IapStore = Types.IapStore.APPLE
# ============================================================================

# ============================================================================
# Enums
# ============================================================================

## Play Billing choice image layout (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
enum BillingChoiceImageLayoutAndroid {
	## Rectangular image with a 4:1 aspect ratio.
	RECTANGULAR_FOUR_BY_ONE = 0,
	## Rectangular image with a 3:1 aspect ratio.
	RECTANGULAR_THREE_BY_ONE = 1,
	## Rectangular image with a 2:2 aspect ratio.
	RECTANGULAR_TWO_BY_TWO = 2,
}

## Choice screen renderer for Billing Choice availability (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
enum BillingChoiceScreenTypeAndroid {
	## Unspecified choice screen type.
	UNSPECIFIED = 0,
	## Choice screen is rendered by the developer app.
	DEVELOPER_RENDERED = 1,
	## Choice screen is rendered by Google Play.
	GOOGLE_RENDERED = 2,
}

## Billing program types for Google Play Billing Programs (Android) Available in Google Play Billing Library 8.2.0 (External Offer and External Content Link integrations require 8.2.1+), EXTERNAL_PAYMENTS added in 8.3.0, BILLING_CHOICE added in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
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
	## Billing Choice program. Allows presenting Google Play Billing alongside an alternative in-app billing system or external web link. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
	BILLING_CHOICE = 5,
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

## Developer-provided billing destination type for Billing Program reporting details (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
enum DeveloperBillingTypeAndroid {
	## Unspecified developer billing type. Do not use.
	DEVELOPER_BILLING_TYPE_UNSPECIFIED = 0,
	## Developer-provided billing via native in-app experience.
	IN_APP = 1,
	## Developer-provided billing via external link or embedded web browsing.
	EXTERNAL_LINK = 2,
}

## Discount offer type enumeration. Categorizes the type of discount or promotional offer.
enum DiscountOfferType {
	## Introductory offer for new subscribers (first-time purchase discount)
	INTRODUCTORY = 0,
	## Promotional offer for existing or returning subscribers
	PROMOTIONAL = 1,
	## One-time product discount (Android only, Google Play Billing 8.0+)
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
	PURCHASE_VERIFICATION_FAILED = 7,
	PURCHASE_VERIFICATION_FINISHED = 8,
	PURCHASE_VERIFICATION_FINISH_FAILED = 9,
	NOT_PREPARED = 10,
	NOT_ENDED = 11,
	ALREADY_OWNED = 12,
	DEVELOPER_ERROR = 13,
	BILLING_RESPONSE_JSON_PARSE_ERROR = 14,
	DEFERRED_PAYMENT = 15,
	INTERRUPTED = 16,
	IAP_NOT_AVAILABLE = 17,
	PURCHASE_ERROR = 18,
	SYNC_ERROR = 19,
	TRANSACTION_VALIDATION_FAILED = 20,
	ACTIVITY_UNAVAILABLE = 21,
	ALREADY_PREPARED = 22,
	PENDING = 23,
	CONNECTION_CLOSED = 24,
	INIT_CONNECTION = 25,
	SERVICE_DISCONNECTED = 26,
	SERVICE_TIMEOUT = 27,
	QUERY_PRODUCT = 28,
	SKU_NOT_FOUND = 29,
	SKU_OFFER_MISMATCH = 30,
	ITEM_NOT_OWNED = 31,
	BILLING_UNAVAILABLE = 32,
	FEATURE_NOT_SUPPORTED = 33,
	EMPTY_SKU_LIST = 34,
	DUPLICATE_PURCHASE = 35,
}

## Launch mode for external link flow (Android) Determines how the external URL is launched Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link integrations require 8.2.1+ and fresh details immediately before every redirect session.
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
	## Fired for External Payments (8.3.0+) and Google-rendered Billing Choice developer billing selections on Android. Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
	DEVELOPER_PROVIDED_BILLING_ANDROID = 4,
	## Fired when a subscription enters a billing-issue state that requires user attention. A StoreKit billing-retry subscription may no longer be a current entitlement. Cross-platform unification of StoreKit 2 Message.billingIssue (iOS 16.4+, Mac Catalyst 16.4+, visionOS 1.0+) and Play Billing 8.1+ isSuspended. NOT emitted by Amazon Appstore or the Horizon flavor, whose Billing Compatibility SDK implements only Play Billing 7.0.
	SUBSCRIPTION_BILLING_ISSUE = 5,
}

## Serialization format of a public IAPKit product client payload.
enum IapkitClientPayloadFormat {
	TOML = 0,
	JSON = 1,
	TEXT = 2,
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
	AMAZON = 4,
}

## High-level in-app message category (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0).
enum InAppMessageCategoryAndroid {
	## Unknown in-app message category.
	UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID = 0,
	## Transactional billing messages, such as payment issues or pending price-change confirmations.
	TRANSACTIONAL = 1,
}

## Response code from Play billing in-app messages (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0).
enum InAppMessageResponseCodeAndroid {
	## Flow finished and no developer action is needed.
	NO_ACTION_NEEDED = 0,
	## Subscription status changed and the purchase token should be checked.
	SUBSCRIPTION_STATUS_UPDATED = 1,
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
	## A group of independently purchasable subscriptions sold together (Apple 27+ beta).
	SUBSCRIPTION_BUNDLE = 4,
	## A group of subscriptions that are available only as one suite (Apple 27+ beta).
	SUBSCRIPTION_SUITE = 5,
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

enum SubscriptionBillingPlanTypeIOS {
	## Unknown or unsupported billing plan type.
	UNKNOWN = 0,
	## Monthly billing with a 12-month commitment.
	MONTHLY = 1,
	## Up-front billing for the full subscription period.
	UP_FRONT = 2,
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
	var product_id: String = ""
	var is_active: bool = false
	var expiration_date_ios: Variant = null
	var auto_renewing_android: Variant = null
	var environment_ios: Variant = null
	var days_until_expiration_ios: Variant = null
	var transaction_id: String = ""
	var purchase_token: Variant = null
	## Unix timestamp in milliseconds since January 1, 1970 UTC.
	var transaction_date: float = 0.0
	var base_plan_id_android: Variant = null
	## Required for subscription upgrade/downgrade on Android
	var purchase_token_android: Variant = null
	## The current plan identifier. This is: - On Android: the basePlanId (e.g., "premium", "premium-year") - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly") This provides a unified way to identify which specific plan/tier the user is subscribed to.
	var current_plan_id: Variant = null
	## Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status, pending upgrades/downgrades, and auto-renewal preferences.
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
		if expiration_date_ios != null:
			dict["expirationDateIOS"] = expiration_date_ios
		if auto_renewing_android != null:
			dict["autoRenewingAndroid"] = auto_renewing_android
		if environment_ios != null:
			dict["environmentIOS"] = environment_ios
		if days_until_expiration_ios != null:
			dict["daysUntilExpirationIOS"] = days_until_expiration_ios
		dict["transactionId"] = transaction_id
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		dict["transactionDate"] = transaction_date
		if base_plan_id_android != null:
			dict["basePlanIdAndroid"] = base_plan_id_android
		if purchase_token_android != null:
			dict["purchaseTokenAndroid"] = purchase_token_android
		if current_plan_id != null:
			dict["currentPlanId"] = current_plan_id
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			dict["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			dict["renewalInfoIOS"] = renewal_info_ios
		return dict

## Advanced Commerce metadata from a transaction (iOS 18.4+). Contains item details, tax information, and refund data for purchases made through the Advanced Commerce API using generic SKUs. Only present for transactions that use the Advanced Commerce API.
class AdvancedCommerceInfoIOS:
	## The items purchased as part of this transaction
	var items: Array[AdvancedCommerceItemIOS] = []
	## Subscription period for this transaction. Available in OpenIAP Spec 3.1.0 / openiap-apple 3.1.0 (requires iOS 18.4+, macOS 15.4+, tvOS 18.4+, watchOS 11.4+, or visionOS 2.4+).
	var period: SubscriptionPeriodValueIOS
	## Request reference identifier for tracking
	var request_reference_id: Variant = null
	## Tax code for the transaction
	var tax_code: Variant = null
	## Price excluding tax (decimal string)
	var tax_exclusive_price: Variant = null
	## Estimated tax amount (decimal string)
	var estimated_tax: Variant = null
	## Tax rate applied (decimal string)
	var tax_rate: Variant = null
	## Optional display name
	var display_name: Variant = null
	## Optional description
	var description: Variant = null

	static func from_dict(data: Dictionary) -> AdvancedCommerceInfoIOS:
		var obj = AdvancedCommerceInfoIOS.new()
		if data.has("items") and data["items"] != null:
			if data["items"] is Array:
				var arr: Array[AdvancedCommerceItemIOS] = []
				for item in data["items"]:
					if item is Dictionary:
						arr.append(AdvancedCommerceItemIOS.from_dict(item))
					elif item is AdvancedCommerceItemIOS:
						arr.append(item)
					else:
						push_error("Invalid AdvancedCommerceItemIOS list value for items")
						return null
				obj.items = arr
		if data.has("period") and data["period"] != null:
			if data["period"] is Dictionary:
				obj.period = SubscriptionPeriodValueIOS.from_dict_or_null(data["period"])
		if data.has("requestReferenceId") and data["requestReferenceId"] != null:
			obj.request_reference_id = data["requestReferenceId"]
		if data.has("taxCode") and data["taxCode"] != null:
			obj.tax_code = data["taxCode"]
		if data.has("taxExclusivePrice") and data["taxExclusivePrice"] != null:
			obj.tax_exclusive_price = data["taxExclusivePrice"]
		if data.has("estimatedTax") and data["estimatedTax"] != null:
			obj.estimated_tax = data["estimatedTax"]
		if data.has("taxRate") and data["taxRate"] != null:
			obj.tax_rate = data["taxRate"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if items != null:
			var arr = []
			for item in items:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["items"] = arr
		else:
			dict["items"] = null
		if period != null and period.has_method("to_dict"):
			dict["period"] = period.to_dict()
		else:
			dict["period"] = period
		if request_reference_id != null:
			dict["requestReferenceId"] = request_reference_id
		if tax_code != null:
			dict["taxCode"] = tax_code
		if tax_exclusive_price != null:
			dict["taxExclusivePrice"] = tax_exclusive_price
		if estimated_tax != null:
			dict["estimatedTax"] = estimated_tax
		if tax_rate != null:
			dict["taxRate"] = tax_rate
		if display_name != null:
			dict["displayName"] = display_name
		if description != null:
			dict["description"] = description
		return dict

## Details of an Advanced Commerce item (iOS 18.4+).
class AdvancedCommerceItemDetailsIOS:
	## JSON representation of the item details
	var json_representation: Variant = null

	static func from_dict(data: Dictionary) -> AdvancedCommerceItemDetailsIOS:
		var obj = AdvancedCommerceItemDetailsIOS.new()
		if data.has("jsonRepresentation") and data["jsonRepresentation"] != null:
			obj.json_representation = data["jsonRepresentation"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if json_representation != null:
			dict["jsonRepresentation"] = json_representation
		return dict

## An item purchased through the Advanced Commerce API (iOS 18.4+). Represents a developer-defined product within a generic SKU transaction.
class AdvancedCommerceItemIOS:
	## The item's detail information
	var details: AdvancedCommerceItemDetailsIOS
	## Refunds issued for this item, if any
	var refunds: Array[AdvancedCommerceRefundIOS] = []
	## Date access to this item was revoked (milliseconds since epoch)
	var revocation_date: Variant = null

	static func from_dict(data: Dictionary) -> AdvancedCommerceItemIOS:
		var obj = AdvancedCommerceItemIOS.new()
		if data.has("details") and data["details"] != null:
			if data["details"] is Dictionary:
				obj.details = AdvancedCommerceItemDetailsIOS.from_dict(data["details"])
			else:
				obj.details = data["details"]
		if data.has("refunds") and data["refunds"] != null:
			if data["refunds"] is Array:
				var arr: Array[AdvancedCommerceRefundIOS] = []
				for item in data["refunds"]:
					if item is Dictionary:
						arr.append(AdvancedCommerceRefundIOS.from_dict(item))
					elif item is AdvancedCommerceRefundIOS:
						arr.append(item)
					else:
						push_error("Invalid AdvancedCommerceRefundIOS list value for refunds")
						return null
				obj.refunds = arr
		if data.has("revocationDate") and data["revocationDate"] != null:
			obj.revocation_date = data["revocationDate"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if details != null and details.has_method("to_dict"):
			dict["details"] = details.to_dict()
		else:
			dict["details"] = details
		if refunds != null:
			var arr = []
			for item in refunds:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["refunds"] = arr
		else:
			dict["refunds"] = null
		if revocation_date != null:
			dict["revocationDate"] = revocation_date
		return dict

## Refund information for an Advanced Commerce item (iOS 18.4+).
class AdvancedCommerceRefundIOS:
	## JSON representation of the refund details
	var json_representation: Variant = null

	static func from_dict(data: Dictionary) -> AdvancedCommerceRefundIOS:
		var obj = AdvancedCommerceRefundIOS.new()
		if data.has("jsonRepresentation") and data["jsonRepresentation"] != null:
			obj.json_representation = data["jsonRepresentation"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if json_representation != null:
			dict["jsonRepresentation"] = json_representation
		return dict

class AppTransaction:
	var bundle_id: String = ""
	var app_version: String = ""
	var original_app_version: String = ""
	var original_purchase_date: float = 0.0
	var device_verification: String = ""
	var device_verification_nonce: String = ""
	var environment: String = ""
	var signed_date: float = 0.0
	var app_id: float = 0.0
	var app_version_id: float = 0.0
	var preorder_date: Variant = null
	## Date the app-acquisition transaction was revoked (epoch milliseconds). Available through the Xcode 27 SDK and back-deployed to Apple 16+.
	var revocation_date: Variant = null
	var app_transaction_id: Variant = null
	## Original App Store platform raw value. Xcode 27 adds the back-deployed managed acquisition-platform value.
	var original_platform: Variant = null
	## Store channel of the original app purchase: consumer, education, enterprise, or another future StoreKit value (Apple 27+ beta).
	var store_type: Variant = null

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
		if data.has("revocationDate") and data["revocationDate"] != null:
			obj.revocation_date = data["revocationDate"]
		if data.has("appTransactionId") and data["appTransactionId"] != null:
			obj.app_transaction_id = data["appTransactionId"]
		if data.has("originalPlatform") and data["originalPlatform"] != null:
			obj.original_platform = data["originalPlatform"]
		if data.has("storeType") and data["storeType"] != null:
			obj.store_type = data["storeType"]
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
		if preorder_date != null:
			dict["preorderDate"] = preorder_date
		if revocation_date != null:
			dict["revocationDate"] = revocation_date
		if app_transaction_id != null:
			dict["appTransactionId"] = app_transaction_id
		if original_platform != null:
			dict["originalPlatform"] = original_platform
		if store_type != null:
			dict["storeType"] = store_type
		return dict

## Display information for developer-rendered Billing Choice screens (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
class BillingChoiceInfoAndroid:
	## URL for the Play Billing choice image matching the requested layout.
	var play_billing_choice_image_url: String = ""
	## Play Loyalty information for the user.
	var play_billing_loyalty_info: Variant = null

	static func from_dict(data: Dictionary) -> BillingChoiceInfoAndroid:
		var obj = BillingChoiceInfoAndroid.new()
		if data.has("playBillingChoiceImageUrl") and data["playBillingChoiceImageUrl"] != null:
			obj.play_billing_choice_image_url = data["playBillingChoiceImageUrl"]
		if data.has("playBillingLoyaltyInfo") and data["playBillingLoyaltyInfo"] != null:
			obj.play_billing_loyalty_info = data["playBillingLoyaltyInfo"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["playBillingChoiceImageUrl"] = play_billing_choice_image_url
		if play_billing_loyalty_info != null:
			dict["playBillingLoyaltyInfo"] = play_billing_loyalty_info
		return dict

## Result of checking billing program availability (Android) Available in Google Play Billing Library 8.2.0+
class BillingProgramAvailabilityResultAndroid:
	## Whether the billing program is available for the user
	var is_available: bool = false
	## The billing program that was checked
	var billing_program: BillingProgramAndroid
	## Billing Choice screen renderer. Populated only for available BILLING_CHOICE results. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
	var choice_screen_type: Variant = null
	## Whether external-link payment is available for Billing Choice. Populated only for available BILLING_CHOICE results. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
	var is_external_link_available: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> BillingProgramAvailabilityResultAndroid:
		if not data.has("billingProgram") or not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid BillingProgramAvailabilityResultAndroid.billingProgram enum value")
			return null
		var obj = BillingProgramAvailabilityResultAndroid.new()
		if data.has("isAvailable") and data["isAvailable"] != null:
			obj.is_available = data["isAvailable"]
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
			else:
				obj.billing_program = enum_str
		if data.has("choiceScreenType") and data["choiceScreenType"] != null:
			var enum_str = data["choiceScreenType"]
			if enum_str is String and BILLING_CHOICE_SCREEN_TYPE_ANDROID_FROM_STRING.has(enum_str):
				obj.choice_screen_type = BILLING_CHOICE_SCREEN_TYPE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES.has(enum_str):
				obj.choice_screen_type = enum_str
			else:
				obj.choice_screen_type = enum_str
		if data.has("isExternalLinkAvailable") and data["isExternalLinkAvailable"] != null:
			obj.is_external_link_available = data["isExternalLinkAvailable"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["isAvailable"] = is_available
		if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
			dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
		else:
			dict["billingProgram"] = billing_program
		if choice_screen_type != null:
			if BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES.has(choice_screen_type):
				dict["choiceScreenType"] = BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES[choice_screen_type]
			else:
				dict["choiceScreenType"] = choice_screen_type
		if is_external_link_available != null:
			dict["isExternalLinkAvailable"] = is_external_link_available
		return dict

## Reporting details for transactions made outside of Google Play Billing (Android) Contains the external transaction token needed for reporting Available in Google Play Billing Library 8.2.0+
class BillingProgramReportingDetailsAndroid:
	## The billing program that the reporting details are associated with
	var billing_program: BillingProgramAndroid
	## External transaction token used to report transactions made outside of Google Play Billing. Do not cache it for a later redirect session. For External Offer, the same token may report multiple purchases made during the session that generated it.
	var external_transaction_token: String = ""

	static func from_dict(data: Dictionary, report_errors: bool = true) -> BillingProgramReportingDetailsAndroid:
		if not data.has("billingProgram") or not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid BillingProgramReportingDetailsAndroid.billingProgram enum value")
			return null
		var obj = BillingProgramReportingDetailsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
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
	var response_code: int = 0
	## Debug message from the billing library
	var debug_message: Variant = null
	## Sub-response code for more granular error information (8.0+). Provides additional context when responseCode indicates an error.
	var sub_response_code: Variant = null

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
			elif enum_str is int and SUB_RESPONSE_CODE_ANDROID_VALUES.has(enum_str):
				obj.sub_response_code = enum_str
			else:
				obj.sub_response_code = enum_str
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["responseCode"] = response_code
		if debug_message != null:
			dict["debugMessage"] = debug_message
		if sub_response_code != null:
			if SUB_RESPONSE_CODE_ANDROID_VALUES.has(sub_response_code):
				dict["subResponseCode"] = SUB_RESPONSE_CODE_ANDROID_VALUES[sub_response_code]
			else:
				dict["subResponseCode"] = sub_response_code
		return dict

## Metadata for one auto-renewable subscription included in an Apple subscription bundle (Apple 27+ beta).
class BundledSubscriptionIOS:
	var id: String = ""
	var display_name: String = ""
	var description: String = ""
	var price: float = 0.0
	var display_price: String = ""
	var is_family_shareable: bool = false
	var subscription_group_id: String = ""
	var subscription_group_level: int = 0
	var subscription_group_display_name: String = ""

	static func from_dict(data: Dictionary) -> BundledSubscriptionIOS:
		var obj = BundledSubscriptionIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("displayName") and data["displayName"] != null:
			obj.display_name = data["displayName"]
		if data.has("description") and data["description"] != null:
			obj.description = data["description"]
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("isFamilyShareable") and data["isFamilyShareable"] != null:
			obj.is_family_shareable = data["isFamilyShareable"]
		if data.has("subscriptionGroupId") and data["subscriptionGroupId"] != null:
			obj.subscription_group_id = data["subscriptionGroupId"]
		if data.has("subscriptionGroupLevel") and data["subscriptionGroupLevel"] != null:
			obj.subscription_group_level = data["subscriptionGroupLevel"]
		if data.has("subscriptionGroupDisplayName") and data["subscriptionGroupDisplayName"] != null:
			obj.subscription_group_display_name = data["subscriptionGroupDisplayName"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["displayName"] = display_name
		dict["description"] = description
		dict["price"] = price
		dict["displayPrice"] = display_price
		dict["isFamilyShareable"] = is_family_shareable
		dict["subscriptionGroupId"] = subscription_group_id
		dict["subscriptionGroupLevel"] = subscription_group_level
		dict["subscriptionGroupDisplayName"] = subscription_group_display_name
		return dict

## Details provided when user selects developer billing option (Android) Received via DeveloperProvidedBillingListener callback Available in Google Play Billing Library 8.3.0+
class DeveloperProvidedBillingDetailsAndroid:
	## External transaction token used to report transactions made through developer billing. Nullable for flows such as external payments where no token is returned.
	var external_transaction_token: Variant = null
	## URI to launch for an external-link Billing Choice flow, when provided by Google Play.
	var link_uri: Variant = null
	## Original external transaction ID when replacing a subscription that was purchased through developer billing.
	var original_external_transaction_id: Variant = null
	## Products selected for the developer billing flow.
	var products: Array[DeveloperProvidedBillingProductAndroid] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> DeveloperProvidedBillingDetailsAndroid:
		var obj = DeveloperProvidedBillingDetailsAndroid.new()
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		if data.has("originalExternalTransactionId") and data["originalExternalTransactionId"] != null:
			obj.original_external_transaction_id = data["originalExternalTransactionId"]
		if data.has("products") and data["products"] != null:
			if data["products"] is Array:
				var arr: Array[DeveloperProvidedBillingProductAndroid] = []
				for item in data["products"]:
					if item is Dictionary:
						var decoded_developer_provided_billing_product_android = DeveloperProvidedBillingProductAndroid.from_dict(item, report_errors)
						if decoded_developer_provided_billing_product_android == null:
							return null
						arr.append(decoded_developer_provided_billing_product_android)
					elif item is DeveloperProvidedBillingProductAndroid:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid DeveloperProvidedBillingProductAndroid list value for products")
						return null
				obj.products = arr
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if external_transaction_token != null:
			dict["externalTransactionToken"] = external_transaction_token
		if link_uri != null:
			dict["linkUri"] = link_uri
		if original_external_transaction_id != null:
			dict["originalExternalTransactionId"] = original_external_transaction_id
		if products != null:
			var arr = []
			for item in products:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["products"] = arr
		else:
			dict["products"] = null
		return dict

## Product selected for developer-provided billing (Android 9.0+).
class DeveloperProvidedBillingProductAndroid:
	## Product identifier.
	var id: String = ""
	## Google Play product type (in-app or subscription).
	var type: ProductType
	## Subscription offer token, when applicable.
	var offer_token: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> DeveloperProvidedBillingProductAndroid:
		if not data.has("type") or not ((data["type"] is String and PRODUCT_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and PRODUCT_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid DeveloperProvidedBillingProductAndroid.type enum value")
			return null
		var obj = DeveloperProvidedBillingProductAndroid.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_TYPE_FROM_STRING[enum_str]
			elif enum_str is int and PRODUCT_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
			else:
				obj.type = enum_str
		if data.has("offerToken") and data["offerToken"] != null:
			obj.offer_token = data["offerToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		if PRODUCT_TYPE_VALUES.has(type):
			dict["type"] = PRODUCT_TYPE_VALUES[type]
		else:
			dict["type"] = type
		if offer_token != null:
			dict["offerToken"] = offer_token
		return dict

## Discount amount details for one-time purchase offers (Android) Available in Google Play Billing Library 8.0+
class DiscountAmountAndroid:
	## Discount amount in micro-units (1,000,000 = 1 unit of currency)
	var discount_amount_micros: String = ""
	## Formatted discount amount with currency sign (e.g., "$4.99")
	var formatted_discount_amount: String = ""

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

## Discount display information for one-time purchase offers (Android) Available in Google Play Billing Library 8.0+
class DiscountDisplayInfoAndroid:
	## Percentage discount (e.g., 33 for 33% off) Only returned for percentage-based discounts
	var percentage_discount: Variant = null
	## Absolute discount amount details Only returned for fixed amount discounts
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
		if percentage_discount != null:
			dict["percentageDiscount"] = percentage_discount
		if discount_amount != null and discount_amount.has_method("to_dict"):
			dict["discountAmount"] = discount_amount.to_dict()
		else:
			dict["discountAmount"] = discount_amount
		return dict

## Standardized one-time product discount offer. Provides a platform-neutral OpenIAP shape for Google Play one-time product purchase options and offers. Currently populated only on Android (Google Play Billing 8.0+). iOS does not populate this type. @see https://openiap.dev/docs/types/discount-offer
class DiscountOffer:
	## Unique identifier for the offer. - iOS: Not applicable (one-time discounts not supported) - Android: offerId from the Google Play one-time purchase option
	var id: Variant = null
	## Formatted display price string (e.g., "$4.99")
	var display_price: String = ""
	## Numeric price value
	var price: float = 0.0
	## Currency code (ISO 4217, e.g., "USD")
	var currency: String = ""
	## Offer category. DiscountOffer currently represents Android one-time product offers and is populated as OneTime. Introductory and Promotional are used by SubscriptionOffer.
	var type: DiscountOfferType
	## [Android] Offer token required for purchase. Must be passed to requestPurchase() when purchasing with this offer.
	var offer_token_android: Variant = null
	## [Android] List of tags associated with this offer.
	var offer_tags_android: Array[String] = []
	## [Android] Original full price in micro-units before discount. Divide by 1,000,000 to get the actual price. Use for displaying strikethrough original price.
	var full_price_micros_android: Variant = null
	## [Android] Percentage discount (e.g., 33 for 33% off). Only present for percentage-based discounts.
	var percentage_discount_android: Variant = null
	## [Android] Fixed discount amount in micro-units. Only present for fixed amount discounts.
	var discount_amount_micros_android: Variant = null
	## [Android] Formatted discount amount including its currency sign (e.g., "$5.00").
	var formatted_discount_amount_android: Variant = null
	## [Android] Valid time window for the offer. Contains startTimeMillis and endTimeMillis.
	var valid_time_window_android: ValidTimeWindowAndroid
	## [Android] Limited quantity information. Contains maximumQuantity and remainingQuantity.
	var limited_quantity_info_android: LimitedQuantityInfoAndroid
	## [Android] Pre-order details if this is a pre-order offer. Available in Google Play Billing Library 8.1.0+
	var preorder_details_android: PreorderDetailsAndroid
	## [Android] Rental details if this is a rental offer.
	var rental_details_android: RentalDetailsAndroid
	## [Android] Purchase option ID for this offer. Used to identify which purchase option the user selected. Available in Google Play Billing Library 8.0+
	var purchase_option_id_android: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> DiscountOffer:
		if not data.has("type") or not ((data["type"] is String and DISCOUNT_OFFER_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and DISCOUNT_OFFER_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid DiscountOffer.type enum value")
			return null
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
			elif enum_str is int and DISCOUNT_OFFER_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
			else:
				obj.type = enum_str
		if data.has("offerTokenAndroid") and data["offerTokenAndroid"] != null:
			obj.offer_token_android = data["offerTokenAndroid"]
		if data.has("offerTagsAndroid") and data["offerTagsAndroid"] != null:
			if data["offerTagsAndroid"] is Array:
				var arr: Array[String] = []
				for item in data["offerTagsAndroid"]:
					if item is String:
						arr.append(str(item))
				obj.offer_tags_android = arr
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
		if data.has("purchaseOptionIdAndroid") and data["purchaseOptionIdAndroid"] != null:
			obj.purchase_option_id_android = data["purchaseOptionIdAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if id != null:
			dict["id"] = id
		dict["displayPrice"] = display_price
		dict["price"] = price
		dict["currency"] = currency
		if DISCOUNT_OFFER_TYPE_VALUES.has(type):
			dict["type"] = DISCOUNT_OFFER_TYPE_VALUES[type]
		else:
			dict["type"] = type
		if offer_token_android != null:
			dict["offerTokenAndroid"] = offer_token_android
		dict["offerTagsAndroid"] = offer_tags_android
		if full_price_micros_android != null:
			dict["fullPriceMicrosAndroid"] = full_price_micros_android
		if percentage_discount_android != null:
			dict["percentageDiscountAndroid"] = percentage_discount_android
		if discount_amount_micros_android != null:
			dict["discountAmountMicrosAndroid"] = discount_amount_micros_android
		if formatted_discount_amount_android != null:
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
		if purchase_option_id_android != null:
			dict["purchaseOptionIdAndroid"] = purchase_option_id_android
		return dict

class EntitlementIOS:
	var sku: String = ""
	var transaction_id: String = ""
	var json_representation: String = ""

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

## Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).
class ExternalPurchaseCustomLinkNoticeResultIOS:
	## Whether the user chose to continue to external purchase
	var continued: bool = false
	## Optional error message if the presentation failed
	var error: Variant = null

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
		if error != null:
			dict["error"] = error
		return dict

## Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).
class ExternalPurchaseCustomLinkTokenResultIOS:
	## The external purchase token string. Report this token to Apple's External Purchase Server API.
	var token: Variant = null
	## Optional error message if token retrieval failed
	var error: Variant = null

	static func from_dict(data: Dictionary) -> ExternalPurchaseCustomLinkTokenResultIOS:
		var obj = ExternalPurchaseCustomLinkTokenResultIOS.new()
		if data.has("token") and data["token"] != null:
			obj.token = data["token"]
		if data.has("error") and data["error"] != null:
			obj.error = data["error"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if token != null:
			dict["token"] = token
		if error != null:
			dict["error"] = error
		return dict

## Result of presenting an external purchase link
class ExternalPurchaseLinkResultIOS:
	## Whether the user completed the external purchase flow
	var success: bool = false
	## Optional error message if the presentation failed
	var error: Variant = null

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
		if error != null:
			dict["error"] = error
		return dict

## Result of presenting external purchase notice sheet (iOS 17.4+) Returns the token when user continues to external purchase.
class ExternalPurchaseNoticeResultIOS:
	## Notice result indicating user action
	var result: ExternalPurchaseNoticeAction
	## Optional error message if the presentation failed
	var error: Variant = null
	## External purchase token returned when user continues (iOS 17.4+). This token should be reported to Apple's External Purchase Server API. Only present when result is Continue.
	var external_purchase_token: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> ExternalPurchaseNoticeResultIOS:
		if not data.has("result") or not ((data["result"] is String and EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING.has(data["result"])) or (data["result"] is int and EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES.has(data["result"]))):
			if report_errors:
				push_error("Invalid ExternalPurchaseNoticeResultIOS.result enum value")
			return null
		var obj = ExternalPurchaseNoticeResultIOS.new()
		if data.has("result") and data["result"] != null:
			var enum_str = data["result"]
			if enum_str is String and EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING.has(enum_str):
				obj.result = EXTERNAL_PURCHASE_NOTICE_ACTION_FROM_STRING[enum_str]
			elif enum_str is int and EXTERNAL_PURCHASE_NOTICE_ACTION_VALUES.has(enum_str):
				obj.result = enum_str
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
		if error != null:
			dict["error"] = error
		if external_purchase_token != null:
			dict["externalPurchaseToken"] = external_purchase_token
		return dict

## Public app-facing data attached to one store product in IAPKit. Never place credentials, signing keys, or server-authoritative rules here.
class IapkitProductClientPayload:
	var format: IapkitClientPayloadFormat
	var body: String = ""
	var version: float = 0.0
	var updated_at: float = 0.0

	static func from_dict(data: Dictionary, report_errors: bool = true) -> IapkitProductClientPayload:
		if not data.has("format") or not ((data["format"] is String and IAPKIT_CLIENT_PAYLOAD_FORMAT_FROM_STRING.has(data["format"])) or (data["format"] is int and IAPKIT_CLIENT_PAYLOAD_FORMAT_VALUES.has(data["format"]))):
			if report_errors:
				push_error("Invalid IapkitProductClientPayload.format enum value")
			return null
		var obj = IapkitProductClientPayload.new()
		if data.has("format") and data["format"] != null:
			var enum_str = data["format"]
			if enum_str is String and IAPKIT_CLIENT_PAYLOAD_FORMAT_FROM_STRING.has(enum_str):
				obj.format = IAPKIT_CLIENT_PAYLOAD_FORMAT_FROM_STRING[enum_str]
			elif enum_str is int and IAPKIT_CLIENT_PAYLOAD_FORMAT_VALUES.has(enum_str):
				obj.format = enum_str
			else:
				obj.format = enum_str
		if data.has("body") and data["body"] != null:
			obj.body = data["body"]
		if data.has("version") and data["version"] != null:
			obj.version = data["version"]
		if data.has("updatedAt") and data["updatedAt"] != null:
			obj.updated_at = data["updatedAt"]
		return obj

	static func from_dict_or_null(data: Dictionary) -> Variant:
		return from_dict(data, false)

	func to_dict() -> Dictionary:
		var dict = {}
		if IAPKIT_CLIENT_PAYLOAD_FORMAT_VALUES.has(format):
			dict["format"] = IAPKIT_CLIENT_PAYLOAD_FORMAT_VALUES[format]
		else:
			dict["format"] = format
		dict["body"] = body
		dict["version"] = version
		dict["updatedAt"] = updated_at
		return dict

## Result from showing Play billing in-app messages (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0).
class InAppMessageResultAndroid:
	## Response code for the in-app messaging flow.
	var response_code: InAppMessageResponseCodeAndroid
	## Purchase token returned when a subscription status changed.
	var purchase_token: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> InAppMessageResultAndroid:
		if not data.has("responseCode") or not ((data["responseCode"] is String and IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_FROM_STRING.has(data["responseCode"])) or (data["responseCode"] is int and IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_VALUES.has(data["responseCode"]))):
			if report_errors:
				push_error("Invalid InAppMessageResultAndroid.responseCode enum value")
			return null
		var obj = InAppMessageResultAndroid.new()
		if data.has("responseCode") and data["responseCode"] != null:
			var enum_str = data["responseCode"]
			if enum_str is String and IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_FROM_STRING.has(enum_str):
				obj.response_code = IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_VALUES.has(enum_str):
				obj.response_code = enum_str
			else:
				obj.response_code = enum_str
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_VALUES.has(response_code):
			dict["responseCode"] = IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_VALUES[response_code]
		else:
			dict["responseCode"] = response_code
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		return dict

## Installment plan details for subscription offers (Android) Contains information about the installment plan commitment. Available in Google Play Billing Library 7.0+
class InstallmentPlanDetailsAndroid:
	## Committed payments count after a user signs up for this subscription plan. For example, for a monthly subscription with commitmentPaymentsCount of 12, users will be charged monthly for 12 months after signup.
	var commitment_payments_count: int = 0
	## Subsequent committed payments count after the subscription plan renews. For example, for a monthly subscription with subsequentCommitmentPaymentsCount of 12, users will be committed to another 12 monthly payments when the plan renews. Returns 0 if the installment plan has no subsequent commitment (reverts to normal plan).
	var subsequent_commitment_payments_count: int = 0

	static func from_dict(data: Dictionary) -> InstallmentPlanDetailsAndroid:
		var obj = InstallmentPlanDetailsAndroid.new()
		if data.has("commitmentPaymentsCount") and data["commitmentPaymentsCount"] != null:
			obj.commitment_payments_count = data["commitmentPaymentsCount"]
		if data.has("subsequentCommitmentPaymentsCount") and data["subsequentCommitmentPaymentsCount"] != null:
			obj.subsequent_commitment_payments_count = data["subsequentCommitmentPaymentsCount"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["commitmentPaymentsCount"] = commitment_payments_count
		dict["subsequentCommitmentPaymentsCount"] = subsequent_commitment_payments_count
		return dict

## Limited quantity information for one-time purchase offers (Android) Available in Google Play Billing Library 8.0+
class LimitedQuantityInfoAndroid:
	## Maximum quantity a user can purchase
	var maximum_quantity: int = 0
	## Remaining quantity the user can still purchase
	var remaining_quantity: int = 0

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

## Pending purchase update for subscription upgrades/downgrades (Android) When a user initiates a subscription change (upgrade/downgrade), the new purchase may be pending until the current billing period ends. This type contains the details of the pending change. Available in Google Play Billing Library 5.0+
class PendingPurchaseUpdateAndroid:
	## Product IDs for the pending purchase update. These are the new products the user is switching to.
	var products: Array[String] = []
	## Purchase token for the pending transaction. Use this token to track or manage the pending purchase update.
	var purchase_token: String = ""

	static func from_dict(data: Dictionary) -> PendingPurchaseUpdateAndroid:
		var obj = PendingPurchaseUpdateAndroid.new()
		if data.has("products") and data["products"] != null:
			if data["products"] is Array:
				var arr: Array[String] = []
				for item in data["products"]:
					if item is String:
						arr.append(str(item))
				obj.products = arr
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["products"] = products
		dict["purchaseToken"] = purchase_token
		return dict

## Pre-order details for one-time purchase products (Android) Available in Google Play Billing Library 8.1.0+
class PreorderDetailsAndroid:
	## Pre-order presale end time in milliseconds since epoch. This is when the presale period ends and the product will be released.
	var preorder_presale_end_time_millis: String = ""
	## Pre-order release time in milliseconds since epoch. This is when the product will be available to users who pre-ordered.
	var preorder_release_time_millis: String = ""

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
	var formatted_price: String = ""
	var price_currency_code: String = ""
	var billing_period: String = ""
	var billing_cycle_count: int = 0
	var price_amount_micros: String = ""
	var recurrence_mode: int = 0

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
	var pricing_phase_list: Array[PricingPhaseAndroid] = []

	static func from_dict(data: Dictionary) -> PricingPhasesAndroid:
		var obj = PricingPhasesAndroid.new()
		if data.has("pricingPhaseList") and data["pricingPhaseList"] != null:
			if data["pricingPhaseList"] is Array:
				var arr: Array[PricingPhaseAndroid] = []
				for item in data["pricingPhaseList"]:
					if item is Dictionary:
						arr.append(PricingPhaseAndroid.from_dict(item))
					elif item is PricingPhaseAndroid:
						arr.append(item)
					else:
						push_error("Invalid PricingPhaseAndroid list value for pricingPhaseList")
						return null
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
	var id: String = ""
	var title: String = ""
	var description: String = ""
	var type: ProductType = ProductType.IN_APP
	var display_name: Variant = null
	var display_price: String = ""
	var currency: String = ""
	var price: Variant = null
	var debug_description: Variant = null
	var platform: IapPlatform = IapPlatform.ANDROID
	var name_android: String = ""
	## Product-level status code indicating fetch result (Android 8.0+) OK = product fetched successfully NOT_FOUND = SKU doesn't exist NO_OFFERS_AVAILABLE = user not eligible for any offers Available in Google Play Billing Library 8.0.0+
	var product_status_android: Variant = null
	## Standardized Android one-time product purchase options and offers. Native metadata uses Android-suffixed fields. @see https://openiap.dev/docs/types/discount-offer
	var discount_offers: Array[DiscountOffer] = []
	## Standardized subscription offers. Cross-platform type with Android-specific fields using suffix. @see https://openiap.dev/docs/types/subscription-offer
	var subscription_offers: Array[SubscriptionOffer] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> ProductAndroid:
		if data.has("type") and data["type"] != null and not ((data["type"] is String and PRODUCT_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and PRODUCT_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid ProductAndroid.type enum value")
			return null
		if data.has("platform") and data["platform"] != null and not ((data["platform"] is String and IAP_PLATFORM_FROM_STRING.has(data["platform"])) or (data["platform"] is int and IAP_PLATFORM_VALUES.has(data["platform"]))):
			if report_errors:
				push_error("Invalid ProductAndroid.platform enum value")
			return null
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
			elif enum_str is int and PRODUCT_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
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
			elif enum_str is int and IAP_PLATFORM_VALUES.has(enum_str):
				obj.platform = enum_str
			else:
				obj.platform = enum_str
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("productStatusAndroid") and data["productStatusAndroid"] != null:
			var enum_str = data["productStatusAndroid"]
			if enum_str is String and PRODUCT_STATUS_ANDROID_FROM_STRING.has(enum_str):
				obj.product_status_android = PRODUCT_STATUS_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and PRODUCT_STATUS_ANDROID_VALUES.has(enum_str):
				obj.product_status_android = enum_str
			else:
				obj.product_status_android = ProductStatusAndroid.UNKNOWN
		if data.has("discountOffers") and data["discountOffers"] != null:
			if data["discountOffers"] is Array:
				var arr: Array[DiscountOffer] = []
				for item in data["discountOffers"]:
					if item is Dictionary:
						var decoded_discount_offer = DiscountOffer.from_dict(item, report_errors)
						if decoded_discount_offer == null:
							return null
						arr.append(decoded_discount_offer)
					elif item is DiscountOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid DiscountOffer list value for discountOffers")
						return null
				obj.discount_offers = arr
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[SubscriptionOffer] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)
						if decoded_subscription_offer == null:
							return null
						arr.append(decoded_subscription_offer)
					elif item is SubscriptionOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionOffer list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
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
		if display_name != null:
			dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		if price != null:
			dict["price"] = price
		if debug_description != null:
			dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["nameAndroid"] = name_android
		if product_status_android != null:
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
		return dict

class ProductIOS:
	var id: String = ""
	var title: String = ""
	var description: String = ""
	var type: ProductType = ProductType.IN_APP
	var display_name: Variant = null
	var display_price: String = ""
	var currency: String = ""
	var price: Variant = null
	var debug_description: Variant = null
	var platform: IapPlatform = IapPlatform.IOS
	var display_name_ios: String = ""
	var is_family_shareable_ios: bool = false
	var json_representation_ios: String = ""
	var type_ios: ProductTypeIOS
	## Standardized subscription offers. Cross-platform type with iOS-specific fields using suffix. Note: iOS does not support one-time product discounts. @see https://openiap.dev/docs/types/subscription-offer
	var subscription_offers: Array[SubscriptionOffer] = []
	## iOS 26.4+ subscription pricing terms, including billing plan metadata for monthly subscriptions with a 12-month commitment.
	var pricing_terms_ios: Array[SubscriptionPricingTermsIOS] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> ProductIOS:
		if data.has("type") and data["type"] != null and not ((data["type"] is String and PRODUCT_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and PRODUCT_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid ProductIOS.type enum value")
			return null
		if data.has("platform") and data["platform"] != null and not ((data["platform"] is String and IAP_PLATFORM_FROM_STRING.has(data["platform"])) or (data["platform"] is int and IAP_PLATFORM_VALUES.has(data["platform"]))):
			if report_errors:
				push_error("Invalid ProductIOS.platform enum value")
			return null
		if not data.has("typeIOS") or not ((data["typeIOS"] is String and PRODUCT_TYPE_IOS_FROM_STRING.has(data["typeIOS"])) or (data["typeIOS"] is int and PRODUCT_TYPE_IOS_VALUES.has(data["typeIOS"]))):
			if report_errors:
				push_error("Invalid ProductIOS.typeIOS enum value")
			return null
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
			elif enum_str is int and PRODUCT_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
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
			elif enum_str is int and IAP_PLATFORM_VALUES.has(enum_str):
				obj.platform = enum_str
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
			elif enum_str is int and PRODUCT_TYPE_IOS_VALUES.has(enum_str):
				obj.type_ios = enum_str
			else:
				obj.type_ios = enum_str
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[SubscriptionOffer] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)
						if decoded_subscription_offer == null:
							return null
						arr.append(decoded_subscription_offer)
					elif item is SubscriptionOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionOffer list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
		if data.has("pricingTermsIOS") and data["pricingTermsIOS"] != null:
			if data["pricingTermsIOS"] is Array:
				var arr: Array[SubscriptionPricingTermsIOS] = []
				for item in data["pricingTermsIOS"]:
					if item is Dictionary:
						var decoded_subscription_pricing_terms_ios = SubscriptionPricingTermsIOS.from_dict(item, report_errors)
						if decoded_subscription_pricing_terms_ios == null:
							return null
						arr.append(decoded_subscription_pricing_terms_ios)
					elif item is SubscriptionPricingTermsIOS:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionPricingTermsIOS list value for pricingTermsIOS")
						return null
				obj.pricing_terms_ios = arr
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
		if display_name != null:
			dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		if price != null:
			dict["price"] = price
		if debug_description != null:
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
		if pricing_terms_ios != null:
			var arr = []
			for item in pricing_terms_ios:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["pricingTermsIOS"] = arr
		else:
			dict["pricingTermsIOS"] = null
		return dict

class ProductSubscriptionAndroid:
	var id: String = ""
	var title: String = ""
	var description: String = ""
	var type: ProductType = ProductType.SUBS
	var display_name: Variant = null
	var display_price: String = ""
	var currency: String = ""
	var price: Variant = null
	var debug_description: Variant = null
	var platform: IapPlatform = IapPlatform.ANDROID
	var name_android: String = ""
	## Product-level status code indicating fetch result (Android 8.0+) OK = product fetched successfully NOT_FOUND = SKU doesn't exist NO_OFFERS_AVAILABLE = user not eligible for any offers Available in Google Play Billing Library 8.0.0+
	var product_status_android: Variant = null
	## Standardized subscription offers. Cross-platform type with Android-specific fields using suffix. @see https://openiap.dev/docs/types/subscription-offer
	var subscription_offers: Array[SubscriptionOffer] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> ProductSubscriptionAndroid:
		if data.has("type") and data["type"] != null and not ((data["type"] is String and PRODUCT_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and PRODUCT_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionAndroid.type enum value")
			return null
		if data.has("platform") and data["platform"] != null and not ((data["platform"] is String and IAP_PLATFORM_FROM_STRING.has(data["platform"])) or (data["platform"] is int and IAP_PLATFORM_VALUES.has(data["platform"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionAndroid.platform enum value")
			return null
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
			elif enum_str is int and PRODUCT_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
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
			elif enum_str is int and IAP_PLATFORM_VALUES.has(enum_str):
				obj.platform = enum_str
			else:
				obj.platform = enum_str
		if data.has("nameAndroid") and data["nameAndroid"] != null:
			obj.name_android = data["nameAndroid"]
		if data.has("productStatusAndroid") and data["productStatusAndroid"] != null:
			var enum_str = data["productStatusAndroid"]
			if enum_str is String and PRODUCT_STATUS_ANDROID_FROM_STRING.has(enum_str):
				obj.product_status_android = PRODUCT_STATUS_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and PRODUCT_STATUS_ANDROID_VALUES.has(enum_str):
				obj.product_status_android = enum_str
			else:
				obj.product_status_android = ProductStatusAndroid.UNKNOWN
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[SubscriptionOffer] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)
						if decoded_subscription_offer == null:
							return null
						arr.append(decoded_subscription_offer)
					elif item is SubscriptionOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionOffer list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
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
		if display_name != null:
			dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		if price != null:
			dict["price"] = price
		if debug_description != null:
			dict["debugDescription"] = debug_description
		if IAP_PLATFORM_VALUES.has(platform):
			dict["platform"] = IAP_PLATFORM_VALUES[platform]
		else:
			dict["platform"] = platform
		dict["nameAndroid"] = name_android
		if product_status_android != null:
			if PRODUCT_STATUS_ANDROID_VALUES.has(product_status_android):
				dict["productStatusAndroid"] = PRODUCT_STATUS_ANDROID_VALUES[product_status_android]
			else:
				dict["productStatusAndroid"] = product_status_android
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
		return dict

class ProductSubscriptionIOS:
	var id: String = ""
	var title: String = ""
	var description: String = ""
	var type: ProductType = ProductType.SUBS
	var display_name: Variant = null
	var display_price: String = ""
	var currency: String = ""
	var price: Variant = null
	var debug_description: Variant = null
	var platform: IapPlatform = IapPlatform.IOS
	var display_name_ios: String = ""
	var is_family_shareable_ios: bool = false
	var json_representation_ios: String = ""
	var type_ios: ProductTypeIOS
	## Standardized subscription offers. Cross-platform type with iOS-specific fields using suffix. @see https://openiap.dev/docs/types/subscription-offer
	var subscription_offers: Array[SubscriptionOffer] = []
	## iOS 26.4+ subscription pricing terms, including billing plan metadata for monthly subscriptions with a 12-month commitment.
	var pricing_terms_ios: Array[SubscriptionPricingTermsIOS] = []
	## Subscriptions included in this Apple subscription bundle. Empty or null for every other product type (Apple 27+ beta).
	var bundled_subscriptions_ios: Array[BundledSubscriptionIOS] = []
	## App Store subscription group identifier for intro-offer eligibility checks.
	var subscription_group_id_ios: Variant = null
	var introductory_price_ios: Variant = null
	var introductory_price_as_amount_ios: Variant = null
	var introductory_price_payment_mode_ios: PaymentModeIOS = PaymentModeIOS.EMPTY
	var introductory_price_number_of_periods_ios: Variant = null
	var introductory_price_subscription_period_ios: Variant = null
	var subscription_period_number_ios: Variant = null
	var subscription_period_unit_ios: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> ProductSubscriptionIOS:
		if data.has("type") and data["type"] != null and not ((data["type"] is String and PRODUCT_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and PRODUCT_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionIOS.type enum value")
			return null
		if data.has("platform") and data["platform"] != null and not ((data["platform"] is String and IAP_PLATFORM_FROM_STRING.has(data["platform"])) or (data["platform"] is int and IAP_PLATFORM_VALUES.has(data["platform"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionIOS.platform enum value")
			return null
		if not data.has("typeIOS") or not ((data["typeIOS"] is String and PRODUCT_TYPE_IOS_FROM_STRING.has(data["typeIOS"])) or (data["typeIOS"] is int and PRODUCT_TYPE_IOS_VALUES.has(data["typeIOS"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionIOS.typeIOS enum value")
			return null
		if data.has("introductoryPricePaymentModeIOS") and data["introductoryPricePaymentModeIOS"] != null and not ((data["introductoryPricePaymentModeIOS"] is String and PAYMENT_MODE_IOS_FROM_STRING.has(data["introductoryPricePaymentModeIOS"])) or (data["introductoryPricePaymentModeIOS"] is int and PAYMENT_MODE_IOS_VALUES.has(data["introductoryPricePaymentModeIOS"]))):
			if report_errors:
				push_error("Invalid ProductSubscriptionIOS.introductoryPricePaymentModeIOS enum value")
			return null
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
			elif enum_str is int and PRODUCT_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
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
			elif enum_str is int and IAP_PLATFORM_VALUES.has(enum_str):
				obj.platform = enum_str
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
			elif enum_str is int and PRODUCT_TYPE_IOS_VALUES.has(enum_str):
				obj.type_ios = enum_str
			else:
				obj.type_ios = enum_str
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[SubscriptionOffer] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)
						if decoded_subscription_offer == null:
							return null
						arr.append(decoded_subscription_offer)
					elif item is SubscriptionOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionOffer list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
		if data.has("pricingTermsIOS") and data["pricingTermsIOS"] != null:
			if data["pricingTermsIOS"] is Array:
				var arr: Array[SubscriptionPricingTermsIOS] = []
				for item in data["pricingTermsIOS"]:
					if item is Dictionary:
						var decoded_subscription_pricing_terms_ios = SubscriptionPricingTermsIOS.from_dict(item, report_errors)
						if decoded_subscription_pricing_terms_ios == null:
							return null
						arr.append(decoded_subscription_pricing_terms_ios)
					elif item is SubscriptionPricingTermsIOS:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionPricingTermsIOS list value for pricingTermsIOS")
						return null
				obj.pricing_terms_ios = arr
		if data.has("bundledSubscriptionsIOS") and data["bundledSubscriptionsIOS"] != null:
			if data["bundledSubscriptionsIOS"] is Array:
				var arr: Array[BundledSubscriptionIOS] = []
				for item in data["bundledSubscriptionsIOS"]:
					if item is Dictionary:
						arr.append(BundledSubscriptionIOS.from_dict(item))
					elif item is BundledSubscriptionIOS:
						arr.append(item)
					else:
						push_error("Invalid BundledSubscriptionIOS list value for bundledSubscriptionsIOS")
						return null
				obj.bundled_subscriptions_ios = arr
		if data.has("subscriptionGroupIdIOS") and data["subscriptionGroupIdIOS"] != null:
			obj.subscription_group_id_ios = data["subscriptionGroupIdIOS"]
		if data.has("introductoryPriceIOS") and data["introductoryPriceIOS"] != null:
			obj.introductory_price_ios = data["introductoryPriceIOS"]
		if data.has("introductoryPriceAsAmountIOS") and data["introductoryPriceAsAmountIOS"] != null:
			obj.introductory_price_as_amount_ios = data["introductoryPriceAsAmountIOS"]
		if data.has("introductoryPricePaymentModeIOS") and data["introductoryPricePaymentModeIOS"] != null:
			var enum_str = data["introductoryPricePaymentModeIOS"]
			if enum_str is String and PAYMENT_MODE_IOS_FROM_STRING.has(enum_str):
				obj.introductory_price_payment_mode_ios = PAYMENT_MODE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and PAYMENT_MODE_IOS_VALUES.has(enum_str):
				obj.introductory_price_payment_mode_ios = enum_str
			elif not enum_str is String:
				obj.introductory_price_payment_mode_ios = PaymentModeIOS.EMPTY
			else:
				push_error("Unknown PaymentModeIOS value: %s" % enum_str)
		if data.has("introductoryPriceNumberOfPeriodsIOS") and data["introductoryPriceNumberOfPeriodsIOS"] != null:
			obj.introductory_price_number_of_periods_ios = data["introductoryPriceNumberOfPeriodsIOS"]
		if data.has("introductoryPriceSubscriptionPeriodIOS") and data["introductoryPriceSubscriptionPeriodIOS"] != null:
			var enum_str = data["introductoryPriceSubscriptionPeriodIOS"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.introductory_price_subscription_period_ios = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_PERIOD_IOS_VALUES.has(enum_str):
				obj.introductory_price_subscription_period_ios = enum_str
			elif not enum_str is String:
				obj.introductory_price_subscription_period_ios = SubscriptionPeriodIOS.EMPTY
			else:
				push_error("Unknown SubscriptionPeriodIOS value: %s" % enum_str)
		if data.has("subscriptionPeriodNumberIOS") and data["subscriptionPeriodNumberIOS"] != null:
			obj.subscription_period_number_ios = data["subscriptionPeriodNumberIOS"]
		if data.has("subscriptionPeriodUnitIOS") and data["subscriptionPeriodUnitIOS"] != null:
			var enum_str = data["subscriptionPeriodUnitIOS"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.subscription_period_unit_ios = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_PERIOD_IOS_VALUES.has(enum_str):
				obj.subscription_period_unit_ios = enum_str
			elif not enum_str is String:
				obj.subscription_period_unit_ios = SubscriptionPeriodIOS.EMPTY
			else:
				push_error("Unknown SubscriptionPeriodIOS value: %s" % enum_str)
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
		if display_name != null:
			dict["displayName"] = display_name
		dict["displayPrice"] = display_price
		dict["currency"] = currency
		if price != null:
			dict["price"] = price
		if debug_description != null:
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
		if pricing_terms_ios != null:
			var arr = []
			for item in pricing_terms_ios:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["pricingTermsIOS"] = arr
		else:
			dict["pricingTermsIOS"] = null
		if bundled_subscriptions_ios != null:
			var arr = []
			for item in bundled_subscriptions_ios:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["bundledSubscriptionsIOS"] = arr
		else:
			dict["bundledSubscriptionsIOS"] = null
		if subscription_group_id_ios != null:
			dict["subscriptionGroupIdIOS"] = subscription_group_id_ios
		if introductory_price_ios != null:
			dict["introductoryPriceIOS"] = introductory_price_ios
		if introductory_price_as_amount_ios != null:
			dict["introductoryPriceAsAmountIOS"] = introductory_price_as_amount_ios
		if PAYMENT_MODE_IOS_VALUES.has(introductory_price_payment_mode_ios):
			dict["introductoryPricePaymentModeIOS"] = PAYMENT_MODE_IOS_VALUES[introductory_price_payment_mode_ios]
		else:
			dict["introductoryPricePaymentModeIOS"] = introductory_price_payment_mode_ios
		if introductory_price_number_of_periods_ios != null:
			dict["introductoryPriceNumberOfPeriodsIOS"] = introductory_price_number_of_periods_ios
		if introductory_price_subscription_period_ios != null:
			if SUBSCRIPTION_PERIOD_IOS_VALUES.has(introductory_price_subscription_period_ios):
				dict["introductoryPriceSubscriptionPeriodIOS"] = SUBSCRIPTION_PERIOD_IOS_VALUES[introductory_price_subscription_period_ios]
			else:
				dict["introductoryPriceSubscriptionPeriodIOS"] = introductory_price_subscription_period_ios
		if subscription_period_number_ios != null:
			dict["subscriptionPeriodNumberIOS"] = subscription_period_number_ios
		if subscription_period_unit_ios != null:
			if SUBSCRIPTION_PERIOD_IOS_VALUES.has(subscription_period_unit_ios):
				dict["subscriptionPeriodUnitIOS"] = SUBSCRIPTION_PERIOD_IOS_VALUES[subscription_period_unit_ios]
			else:
				dict["subscriptionPeriodUnitIOS"] = subscription_period_unit_ios
		return dict

class PurchaseAndroid:
	var id: String = ""
	var product_id: String = ""
	var ids: Array[String] = []
	var transaction_id: Variant = null
	## Unix timestamp in milliseconds since January 1, 1970 UTC.
	var transaction_date: float = 0.0
	var purchase_token: Variant = null
	## Store where purchase was made
	var store: IapStore = IapStore.UNKNOWN
	var quantity: int = 0
	var purchase_state: PurchaseState = PurchaseState.UNKNOWN
	var is_auto_renewing: bool = false
	var current_plan_id: Variant = null
	var data_android: Variant = null
	var signature_android: Variant = null
	var auto_renewing_android: Variant = null
	var is_acknowledged_android: Variant = null
	var package_name_android: Variant = null
	var developer_payload_android: Variant = null
	var obfuscated_account_id_android: Variant = null
	var obfuscated_profile_id_android: Variant = null
	## Whether the subscription is suspended (Android) A suspended subscription means the user's payment method failed and they need to fix it. Users should be directed to the subscription center to resolve the issue. Do NOT grant entitlements for suspended subscriptions. Available in Google Play Billing Library 8.1.0+
	var is_suspended_android: Variant = null
	## Pending purchase update for uncommitted subscription upgrade/downgrade (Android) Contains the new products and purchase token for the pending transaction. Returns null if no pending update exists. Available in Google Play Billing Library 5.0+
	var pending_purchase_update_android: PendingPurchaseUpdateAndroid
	## Amazon Appstore user id (PurchaseResponse.getUserData().getUserId()). Only populated on the Amazon flavor; required for server-side Amazon RVS receipt verification (userId + receiptId). Null on Google Play and Horizon.
	var user_id_amazon: Variant = null
	## Amazon Appstore marketplace (PurchaseResponse.getUserData().getMarketplace()), for example "US" or "FR". Only populated on the Amazon flavor.
	var user_marketplace_amazon: Variant = null

	static func from_dict(data: Dictionary) -> PurchaseAndroid:
		var obj = PurchaseAndroid.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			if data["ids"] is Array:
				var arr: Array[String] = []
				for item in data["ids"]:
					if item is String:
						arr.append(str(item))
				obj.ids = arr
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
			elif enum_str is int and IAP_STORE_VALUES.has(enum_str):
				obj.store = enum_str
			else:
				obj.store = IapStore.UNKNOWN
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			elif enum_str is int and PURCHASE_STATE_VALUES.has(enum_str):
				obj.purchase_state = enum_str
			else:
				obj.purchase_state = PurchaseState.UNKNOWN
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
		if data.has("pendingPurchaseUpdateAndroid") and data["pendingPurchaseUpdateAndroid"] != null:
			if data["pendingPurchaseUpdateAndroid"] is Dictionary:
				obj.pending_purchase_update_android = PendingPurchaseUpdateAndroid.from_dict(data["pendingPurchaseUpdateAndroid"])
			else:
				obj.pending_purchase_update_android = data["pendingPurchaseUpdateAndroid"]
		if data.has("userIdAmazon") and data["userIdAmazon"] != null:
			obj.user_id_amazon = data["userIdAmazon"]
		if data.has("userMarketplaceAmazon") and data["userMarketplaceAmazon"] != null:
			obj.user_marketplace_amazon = data["userMarketplaceAmazon"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["productId"] = product_id
		dict["ids"] = ids
		if transaction_id != null:
			dict["transactionId"] = transaction_id
		dict["transactionDate"] = transaction_date
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		dict["quantity"] = quantity
		if PURCHASE_STATE_VALUES.has(purchase_state):
			dict["purchaseState"] = PURCHASE_STATE_VALUES[purchase_state]
		else:
			dict["purchaseState"] = purchase_state
		dict["isAutoRenewing"] = is_auto_renewing
		if current_plan_id != null:
			dict["currentPlanId"] = current_plan_id
		if data_android != null:
			dict["dataAndroid"] = data_android
		if signature_android != null:
			dict["signatureAndroid"] = signature_android
		if auto_renewing_android != null:
			dict["autoRenewingAndroid"] = auto_renewing_android
		if is_acknowledged_android != null:
			dict["isAcknowledgedAndroid"] = is_acknowledged_android
		if package_name_android != null:
			dict["packageNameAndroid"] = package_name_android
		if developer_payload_android != null:
			dict["developerPayloadAndroid"] = developer_payload_android
		if obfuscated_account_id_android != null:
			dict["obfuscatedAccountIdAndroid"] = obfuscated_account_id_android
		if obfuscated_profile_id_android != null:
			dict["obfuscatedProfileIdAndroid"] = obfuscated_profile_id_android
		if is_suspended_android != null:
			dict["isSuspendedAndroid"] = is_suspended_android
		if pending_purchase_update_android != null and pending_purchase_update_android.has_method("to_dict"):
			dict["pendingPurchaseUpdateAndroid"] = pending_purchase_update_android.to_dict()
		else:
			dict["pendingPurchaseUpdateAndroid"] = pending_purchase_update_android
		if user_id_amazon != null:
			dict["userIdAmazon"] = user_id_amazon
		if user_marketplace_amazon != null:
			dict["userMarketplaceAmazon"] = user_marketplace_amazon
		return dict

class PurchaseError:
	var code: ErrorCode = ErrorCode.UNKNOWN
	var message: String = ""
	var product_id: Variant = null
	var debug_message: Variant = null
	var response_code: Variant = null
	var sub_response_code_android: Variant = null
	var product_ids: Array[String] = []
	var product_type: Variant = null
	var is_empty_product_list: Variant = null

	static func from_dict(data: Dictionary) -> PurchaseError:
		var obj = PurchaseError.new()
		if data.has("code") and data["code"] != null:
			var enum_str = data["code"]
			if enum_str is String and ERROR_CODE_FROM_STRING.has(enum_str):
				obj.code = ERROR_CODE_FROM_STRING[enum_str]
			elif enum_str is int and ERROR_CODE_VALUES.has(enum_str):
				obj.code = enum_str
			else:
				obj.code = ErrorCode.UNKNOWN
		if data.has("message") and data["message"] != null:
			obj.message = data["message"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("debugMessage") and data["debugMessage"] != null:
			obj.debug_message = data["debugMessage"]
		if data.has("responseCode") and data["responseCode"] != null:
			obj.response_code = data["responseCode"]
		if data.has("subResponseCodeAndroid") and data["subResponseCodeAndroid"] != null:
			var enum_str = data["subResponseCodeAndroid"]
			if enum_str is String and SUB_RESPONSE_CODE_ANDROID_FROM_STRING.has(enum_str):
				obj.sub_response_code_android = SUB_RESPONSE_CODE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and SUB_RESPONSE_CODE_ANDROID_VALUES.has(enum_str):
				obj.sub_response_code_android = enum_str
			else:
				obj.sub_response_code_android = enum_str
		if data.has("productIds") and data["productIds"] != null:
			if data["productIds"] is Array:
				var arr: Array[String] = []
				for item in data["productIds"]:
					if item is String:
						arr.append(str(item))
				obj.product_ids = arr
		if data.has("productType") and data["productType"] != null:
			obj.product_type = data["productType"]
		if data.has("isEmptyProductList") and data["isEmptyProductList"] != null:
			obj.is_empty_product_list = data["isEmptyProductList"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if ERROR_CODE_VALUES.has(code):
			dict["code"] = ERROR_CODE_VALUES[code]
		else:
			dict["code"] = code
		dict["message"] = message
		if product_id != null:
			dict["productId"] = product_id
		if debug_message != null:
			dict["debugMessage"] = debug_message
		if response_code != null:
			dict["responseCode"] = response_code
		if sub_response_code_android != null:
			if SUB_RESPONSE_CODE_ANDROID_VALUES.has(sub_response_code_android):
				dict["subResponseCodeAndroid"] = SUB_RESPONSE_CODE_ANDROID_VALUES[sub_response_code_android]
			else:
				dict["subResponseCodeAndroid"] = sub_response_code_android
		dict["productIds"] = product_ids
		if product_type != null:
			dict["productType"] = product_type
		if is_empty_product_list != null:
			dict["isEmptyProductList"] = is_empty_product_list
		return dict

class PurchaseIOS:
	var id: String = ""
	var product_id: String = ""
	var ids: Array[String] = []
	## Unix timestamp in milliseconds since January 1, 1970 UTC.
	var transaction_date: float = 0.0
	var purchase_token: Variant = null
	## Store where purchase was made
	var store: IapStore = IapStore.UNKNOWN
	var quantity: int = 0
	var purchase_state: PurchaseState = PurchaseState.UNKNOWN
	var is_auto_renewing: bool = false
	var current_plan_id: Variant = null
	var transaction_id: String = ""
	var quantity_ios: Variant = null
	var original_transaction_date_ios: Variant = null
	var original_transaction_identifier_ios: Variant = null
	var app_account_token: Variant = null
	var expiration_date_ios: Variant = null
	var web_order_line_item_id_ios: Variant = null
	var environment_ios: Variant = null
	var storefront_country_code_ios: Variant = null
	var app_bundle_id_ios: Variant = null
	var subscription_group_id_ios: Variant = null
	var is_upgraded_ios: Variant = null
	## StoreKit ownership raw value. Xcode 27 adds the back-deployed assigned value.
	var ownership_type_ios: Variant = null
	var reason_ios: Variant = null
	var reason_string_representation_ios: Variant = null
	var transaction_reason_ios: Variant = null
	var revocation_date_ios: Variant = null
	## Normalized StoreKit revocation reason, including upgraded_to_bundle.
	var revocation_reason_ios: Variant = null
	## StoreKit revocation type, including assignment-revocation on Apple 26.4+ when compiled with the Xcode 27 SDK.
	var revocation_type_ios: Variant = null
	var offer_ios: PurchaseOfferIOS
	var currency_code_ios: Variant = null
	var currency_symbol_ios: Variant = null
	var country_code_ios: Variant = null
	var renewal_info_ios: RenewalInfoIOS
	## iOS 26.4+ billing plan selected for this transaction.
	var billing_plan_type_ios: Variant = null
	## iOS 26.4+ progress information for monthly subscriptions with a 12-month commitment.
	var commitment_info_ios: TransactionCommitmentInfoIOS
	## Original transaction identifier for the subscription bundle that produced this transaction (Apple 27+ SDK; back-deployed by StoreKit).
	var bundle_original_transaction_id_ios: Variant = null
	## Product identifier of the subscription bundle that produced this transaction.
	var bundle_product_id_ios: Variant = null
	## Subscription-group identifier of the bundle that produced this transaction.
	var bundle_subscription_group_id_ios: Variant = null
	## Bundle transaction identifier associated with this component transaction.
	var bundle_transaction_id_ios: Variant = null
	## Original transaction identifier replaced when moving between a standalone subscription and a subscription bundle.
	var previous_original_transaction_id_ios: Variant = null
	## Advanced Commerce API metadata (iOS 18.4+). Present only for transactions that use the Advanced Commerce API. Contains item details, tax information, and refund data for generic SKU purchases.
	var advanced_commerce_info_ios: AdvancedCommerceInfoIOS

	static func from_dict(data: Dictionary) -> PurchaseIOS:
		var obj = PurchaseIOS.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			if data["ids"] is Array:
				var arr: Array[String] = []
				for item in data["ids"]:
					if item is String:
						arr.append(str(item))
				obj.ids = arr
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("store") and data["store"] != null:
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			elif enum_str is int and IAP_STORE_VALUES.has(enum_str):
				obj.store = enum_str
			else:
				obj.store = IapStore.UNKNOWN
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			elif enum_str is int and PURCHASE_STATE_VALUES.has(enum_str):
				obj.purchase_state = enum_str
			else:
				obj.purchase_state = PurchaseState.UNKNOWN
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
		if data.has("revocationTypeIOS") and data["revocationTypeIOS"] != null:
			obj.revocation_type_ios = data["revocationTypeIOS"]
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
		if data.has("billingPlanTypeIOS") and data["billingPlanTypeIOS"] != null:
			var enum_str = data["billingPlanTypeIOS"]
			if enum_str is String and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.billing_plan_type_ios = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(enum_str):
				obj.billing_plan_type_ios = enum_str
			else:
				obj.billing_plan_type_ios = SubscriptionBillingPlanTypeIOS.UNKNOWN
		if data.has("commitmentInfoIOS") and data["commitmentInfoIOS"] != null:
			if data["commitmentInfoIOS"] is Dictionary:
				obj.commitment_info_ios = TransactionCommitmentInfoIOS.from_dict(data["commitmentInfoIOS"])
			else:
				obj.commitment_info_ios = data["commitmentInfoIOS"]
		if data.has("bundleOriginalTransactionIdIOS") and data["bundleOriginalTransactionIdIOS"] != null:
			obj.bundle_original_transaction_id_ios = data["bundleOriginalTransactionIdIOS"]
		if data.has("bundleProductIdIOS") and data["bundleProductIdIOS"] != null:
			obj.bundle_product_id_ios = data["bundleProductIdIOS"]
		if data.has("bundleSubscriptionGroupIdIOS") and data["bundleSubscriptionGroupIdIOS"] != null:
			obj.bundle_subscription_group_id_ios = data["bundleSubscriptionGroupIdIOS"]
		if data.has("bundleTransactionIdIOS") and data["bundleTransactionIdIOS"] != null:
			obj.bundle_transaction_id_ios = data["bundleTransactionIdIOS"]
		if data.has("previousOriginalTransactionIdIOS") and data["previousOriginalTransactionIdIOS"] != null:
			obj.previous_original_transaction_id_ios = data["previousOriginalTransactionIdIOS"]
		if data.has("advancedCommerceInfoIOS") and data["advancedCommerceInfoIOS"] != null:
			if data["advancedCommerceInfoIOS"] is Dictionary:
				obj.advanced_commerce_info_ios = AdvancedCommerceInfoIOS.from_dict(data["advancedCommerceInfoIOS"])
			else:
				obj.advanced_commerce_info_ios = data["advancedCommerceInfoIOS"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["productId"] = product_id
		dict["ids"] = ids
		dict["transactionDate"] = transaction_date
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		dict["quantity"] = quantity
		if PURCHASE_STATE_VALUES.has(purchase_state):
			dict["purchaseState"] = PURCHASE_STATE_VALUES[purchase_state]
		else:
			dict["purchaseState"] = purchase_state
		dict["isAutoRenewing"] = is_auto_renewing
		if current_plan_id != null:
			dict["currentPlanId"] = current_plan_id
		dict["transactionId"] = transaction_id
		if quantity_ios != null:
			dict["quantityIOS"] = quantity_ios
		if original_transaction_date_ios != null:
			dict["originalTransactionDateIOS"] = original_transaction_date_ios
		if original_transaction_identifier_ios != null:
			dict["originalTransactionIdentifierIOS"] = original_transaction_identifier_ios
		if app_account_token != null:
			dict["appAccountToken"] = app_account_token
		if expiration_date_ios != null:
			dict["expirationDateIOS"] = expiration_date_ios
		if web_order_line_item_id_ios != null:
			dict["webOrderLineItemIdIOS"] = web_order_line_item_id_ios
		if environment_ios != null:
			dict["environmentIOS"] = environment_ios
		if storefront_country_code_ios != null:
			dict["storefrontCountryCodeIOS"] = storefront_country_code_ios
		if app_bundle_id_ios != null:
			dict["appBundleIdIOS"] = app_bundle_id_ios
		if subscription_group_id_ios != null:
			dict["subscriptionGroupIdIOS"] = subscription_group_id_ios
		if is_upgraded_ios != null:
			dict["isUpgradedIOS"] = is_upgraded_ios
		if ownership_type_ios != null:
			dict["ownershipTypeIOS"] = ownership_type_ios
		if reason_ios != null:
			dict["reasonIOS"] = reason_ios
		if reason_string_representation_ios != null:
			dict["reasonStringRepresentationIOS"] = reason_string_representation_ios
		if transaction_reason_ios != null:
			dict["transactionReasonIOS"] = transaction_reason_ios
		if revocation_date_ios != null:
			dict["revocationDateIOS"] = revocation_date_ios
		if revocation_reason_ios != null:
			dict["revocationReasonIOS"] = revocation_reason_ios
		if revocation_type_ios != null:
			dict["revocationTypeIOS"] = revocation_type_ios
		if offer_ios != null and offer_ios.has_method("to_dict"):
			dict["offerIOS"] = offer_ios.to_dict()
		else:
			dict["offerIOS"] = offer_ios
		if currency_code_ios != null:
			dict["currencyCodeIOS"] = currency_code_ios
		if currency_symbol_ios != null:
			dict["currencySymbolIOS"] = currency_symbol_ios
		if country_code_ios != null:
			dict["countryCodeIOS"] = country_code_ios
		if renewal_info_ios != null and renewal_info_ios.has_method("to_dict"):
			dict["renewalInfoIOS"] = renewal_info_ios.to_dict()
		else:
			dict["renewalInfoIOS"] = renewal_info_ios
		if billing_plan_type_ios != null:
			if SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(billing_plan_type_ios):
				dict["billingPlanTypeIOS"] = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES[billing_plan_type_ios]
			else:
				dict["billingPlanTypeIOS"] = billing_plan_type_ios
		if commitment_info_ios != null and commitment_info_ios.has_method("to_dict"):
			dict["commitmentInfoIOS"] = commitment_info_ios.to_dict()
		else:
			dict["commitmentInfoIOS"] = commitment_info_ios
		if bundle_original_transaction_id_ios != null:
			dict["bundleOriginalTransactionIdIOS"] = bundle_original_transaction_id_ios
		if bundle_product_id_ios != null:
			dict["bundleProductIdIOS"] = bundle_product_id_ios
		if bundle_subscription_group_id_ios != null:
			dict["bundleSubscriptionGroupIdIOS"] = bundle_subscription_group_id_ios
		if bundle_transaction_id_ios != null:
			dict["bundleTransactionIdIOS"] = bundle_transaction_id_ios
		if previous_original_transaction_id_ios != null:
			dict["previousOriginalTransactionIdIOS"] = previous_original_transaction_id_ios
		if advanced_commerce_info_ios != null and advanced_commerce_info_ios.has_method("to_dict"):
			dict["advancedCommerceInfoIOS"] = advanced_commerce_info_ios.to_dict()
		else:
			dict["advancedCommerceInfoIOS"] = advanced_commerce_info_ios
		return dict

class PurchaseOfferIOS:
	var id: String = ""
	var type: String = ""
	var payment_mode: String = ""

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
	var status: String = ""
	var message: Variant = null

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
		if message != null:
			dict["message"] = message
		return dict

class RenewalCommitmentInfoIOS:
	var commitment_auto_renew_product_id: String = ""
	var commitment_auto_renew_status: bool = false
	var commitment_renewal_billing_plan_type: SubscriptionBillingPlanTypeIOS = SubscriptionBillingPlanTypeIOS.UNKNOWN
	var commitment_renewal_date: float = 0.0
	var commitment_renewal_price: float = 0.0

	static func from_dict(data: Dictionary) -> RenewalCommitmentInfoIOS:
		var obj = RenewalCommitmentInfoIOS.new()
		if data.has("commitmentAutoRenewProductId") and data["commitmentAutoRenewProductId"] != null:
			obj.commitment_auto_renew_product_id = data["commitmentAutoRenewProductId"]
		if data.has("commitmentAutoRenewStatus") and data["commitmentAutoRenewStatus"] != null:
			obj.commitment_auto_renew_status = data["commitmentAutoRenewStatus"]
		if data.has("commitmentRenewalBillingPlanType") and data["commitmentRenewalBillingPlanType"] != null:
			var enum_str = data["commitmentRenewalBillingPlanType"]
			if enum_str is String and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.commitment_renewal_billing_plan_type = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(enum_str):
				obj.commitment_renewal_billing_plan_type = enum_str
			else:
				obj.commitment_renewal_billing_plan_type = SubscriptionBillingPlanTypeIOS.UNKNOWN
		if data.has("commitmentRenewalDate") and data["commitmentRenewalDate"] != null:
			obj.commitment_renewal_date = data["commitmentRenewalDate"]
		if data.has("commitmentRenewalPrice") and data["commitmentRenewalPrice"] != null:
			obj.commitment_renewal_price = data["commitmentRenewalPrice"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["commitmentAutoRenewProductId"] = commitment_auto_renew_product_id
		dict["commitmentAutoRenewStatus"] = commitment_auto_renew_status
		if SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(commitment_renewal_billing_plan_type):
			dict["commitmentRenewalBillingPlanType"] = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES[commitment_renewal_billing_plan_type]
		else:
			dict["commitmentRenewalBillingPlanType"] = commitment_renewal_billing_plan_type
		dict["commitmentRenewalDate"] = commitment_renewal_date
		dict["commitmentRenewalPrice"] = commitment_renewal_price
		return dict

## Subscription renewal information from Product.SubscriptionInfo.RenewalInfo https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
class RenewalInfoIOS:
	var json_representation: Variant = null
	var will_auto_renew: bool = false
	var auto_renew_preference: Variant = null
	## StoreKit's raw integer expiration-reason value represented as a string. Xcode 27 adds the back-deployed unbundled case. Preserve unknown future values.
	var expiration_reason: Variant = null
	## Grace period expiration date (milliseconds since epoch) When set, subscription is in grace period (billing issue but still has access)
	var grace_period_expiration_date: Variant = null
	## True if subscription failed to renew due to billing issue and is retrying StoreKit exposes this directly as RenewalInfo.isInBillingRetry.
	var is_in_billing_retry: Variant = null
	## Product ID that will be used on next renewal (when user upgrades/downgrades) If set and different from current productId, subscription will change on expiration
	var pending_upgrade_product_id: Variant = null
	## User's response to subscription price increase Possible values: "AGREED", "PENDING", null (no price increase)
	var price_increase_status: Variant = null
	## Expected renewal date (milliseconds since epoch) For active subscriptions, when the next renewal/charge will occur
	var renewal_date: Variant = null
	## Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)
	var renewal_offer_id: Variant = null
	## Type of offer applied to next renewal Possible values: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE", "WIN_BACK", etc.
	var renewal_offer_type: Variant = null
	## iOS 26.4+ billing plan that will renew after the current period.
	var renewal_billing_plan_type: Variant = null
	## iOS 26.4+ renewal commitment metadata for monthly subscriptions with a 12-month commitment.
	var commitment_info: RenewalCommitmentInfoIOS
	## Original transaction identifier for the bundle used by the next renewal.
	var bundle_original_transaction_id: Variant = null
	## Product identifier for the bundle used by the next renewal.
	var bundle_product_id: Variant = null
	## Subscription-group identifier for the bundle used by the next renewal.
	var bundle_subscription_group_id: Variant = null
	## Whether this subscription will leave its bundle and renew standalone.
	var will_unbundle: Variant = null

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
		if data.has("renewalBillingPlanType") and data["renewalBillingPlanType"] != null:
			var enum_str = data["renewalBillingPlanType"]
			if enum_str is String and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.renewal_billing_plan_type = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(enum_str):
				obj.renewal_billing_plan_type = enum_str
			else:
				obj.renewal_billing_plan_type = SubscriptionBillingPlanTypeIOS.UNKNOWN
		if data.has("commitmentInfo") and data["commitmentInfo"] != null:
			if data["commitmentInfo"] is Dictionary:
				obj.commitment_info = RenewalCommitmentInfoIOS.from_dict(data["commitmentInfo"])
			else:
				obj.commitment_info = data["commitmentInfo"]
		if data.has("bundleOriginalTransactionId") and data["bundleOriginalTransactionId"] != null:
			obj.bundle_original_transaction_id = data["bundleOriginalTransactionId"]
		if data.has("bundleProductId") and data["bundleProductId"] != null:
			obj.bundle_product_id = data["bundleProductId"]
		if data.has("bundleSubscriptionGroupId") and data["bundleSubscriptionGroupId"] != null:
			obj.bundle_subscription_group_id = data["bundleSubscriptionGroupId"]
		if data.has("willUnbundle") and data["willUnbundle"] != null:
			obj.will_unbundle = data["willUnbundle"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if json_representation != null:
			dict["jsonRepresentation"] = json_representation
		dict["willAutoRenew"] = will_auto_renew
		if auto_renew_preference != null:
			dict["autoRenewPreference"] = auto_renew_preference
		if expiration_reason != null:
			dict["expirationReason"] = expiration_reason
		if grace_period_expiration_date != null:
			dict["gracePeriodExpirationDate"] = grace_period_expiration_date
		if is_in_billing_retry != null:
			dict["isInBillingRetry"] = is_in_billing_retry
		if pending_upgrade_product_id != null:
			dict["pendingUpgradeProductId"] = pending_upgrade_product_id
		if price_increase_status != null:
			dict["priceIncreaseStatus"] = price_increase_status
		if renewal_date != null:
			dict["renewalDate"] = renewal_date
		if renewal_offer_id != null:
			dict["renewalOfferId"] = renewal_offer_id
		if renewal_offer_type != null:
			dict["renewalOfferType"] = renewal_offer_type
		if renewal_billing_plan_type != null:
			if SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(renewal_billing_plan_type):
				dict["renewalBillingPlanType"] = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES[renewal_billing_plan_type]
			else:
				dict["renewalBillingPlanType"] = renewal_billing_plan_type
		if commitment_info != null and commitment_info.has_method("to_dict"):
			dict["commitmentInfo"] = commitment_info.to_dict()
		else:
			dict["commitmentInfo"] = commitment_info
		if bundle_original_transaction_id != null:
			dict["bundleOriginalTransactionId"] = bundle_original_transaction_id
		if bundle_product_id != null:
			dict["bundleProductId"] = bundle_product_id
		if bundle_subscription_group_id != null:
			dict["bundleSubscriptionGroupId"] = bundle_subscription_group_id
		if will_unbundle != null:
			dict["willUnbundle"] = will_unbundle
		return dict

## Rental details for one-time purchase products that can be rented (Android) Available in Google Play Billing Library 8.0+
class RentalDetailsAndroid:
	## Rental period in ISO 8601 format (e.g., P7D for 7 days)
	var rental_period: String = ""
	## Rental expiration period in ISO 8601 format Time after rental period ends when user can still extend
	var rental_expiration_period: Variant = null

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
		if rental_expiration_period != null:
			dict["rentalExpirationPeriod"] = rental_expiration_period
		return dict

class RequestVerifyPurchaseWithIapkitResult:
	var store: IapStore = IapStore.UNKNOWN
	## Available in OpenIAP Spec 3.2.0 / openiap-apple 3.2.0 / openiap-google 3.3.0. Amazon RVS environment selected by IAPKit. Present as `Sandbox` or `Production` on handled Amazon verification results. Deliberately String, not an enum: the value space belongs to IAPKit and the stores behind it, and Apple's App Store Server alone also names `Xcode` and `LocalTesting`. SDKs must forward this value opaquely. Never reject a verification because the environment is unrecognised — that fails a purchase the store already confirmed.
	var environment: Variant = null
	## True when the purchase is valid and actionable. Only entitled, pending-acknowledgment, or ready-to-consume return true. Callers must still match productId and use the platform plus app-owned product type to choose the fulfillment path.
	var is_valid: bool = false
	## The current state of the purchase.
	var state: IapkitPurchaseState = IapkitPurchaseState.UNKNOWN
	## Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1. Store-verified product identifier when the provider returns one.
	var product_id: Variant = null
	## Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1. Public product payload when includeClientPayload was requested, the Apple or Google receipt is valid, and a payload exists for that product.
	var client_payload: IapkitProductClientPayload

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitResult:
		var obj = RequestVerifyPurchaseWithIapkitResult.new()
		if data.has("store") and data["store"] != null:
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			elif enum_str is int and IAP_STORE_VALUES.has(enum_str):
				obj.store = enum_str
			else:
				obj.store = IapStore.UNKNOWN
		if data.has("environment") and data["environment"] != null:
			obj.environment = data["environment"]
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
		if data.has("state") and data["state"] != null:
			var enum_str = data["state"]
			if enum_str is String and IAPKIT_PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.state = IAPKIT_PURCHASE_STATE_FROM_STRING[enum_str]
			elif enum_str is int and IAPKIT_PURCHASE_STATE_VALUES.has(enum_str):
				obj.state = enum_str
			else:
				obj.state = IapkitPurchaseState.UNKNOWN
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("clientPayload") and data["clientPayload"] != null:
			if data["clientPayload"] is Dictionary:
				obj.client_payload = IapkitProductClientPayload.from_dict_or_null(data["clientPayload"])
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if IAP_STORE_VALUES.has(store):
			dict["store"] = IAP_STORE_VALUES[store]
		else:
			dict["store"] = store
		if environment != null:
			dict["environment"] = environment
		dict["isValid"] = is_valid
		if IAPKIT_PURCHASE_STATE_VALUES.has(state):
			dict["state"] = IAPKIT_PURCHASE_STATE_VALUES[state]
		else:
			dict["state"] = state
		if product_id != null:
			dict["productId"] = product_id
		if client_payload != null and client_payload.has_method("to_dict"):
			dict["clientPayload"] = client_payload.to_dict()
		else:
			dict["clientPayload"] = client_payload
		return dict

class SubscriptionCommitmentInfoIOS:
	var display_price: String = ""
	var period: SubscriptionPeriodValueIOS
	var price: float = 0.0

	static func from_dict(data: Dictionary, report_errors: bool = true) -> SubscriptionCommitmentInfoIOS:
		var obj = SubscriptionCommitmentInfoIOS.new()
		if data.has("displayPrice") and data["displayPrice"] != null:
			obj.display_price = data["displayPrice"]
		if data.has("period") and data["period"] != null:
			if data["period"] is Dictionary:
				var decoded_period = SubscriptionPeriodValueIOS.from_dict(data["period"], report_errors)
				if decoded_period == null:
					if report_errors:
						push_error("Invalid required SubscriptionPeriodValueIOS value for period")
					return null
				obj.period = decoded_period
			else:
				if report_errors:
					push_error("Expected period to be a SubscriptionPeriodValueIOS dictionary")
				return null
		else:
			if report_errors:
				push_error("Missing required period value")
			return null
		if data.has("price") and data["price"] != null:
			obj.price = data["price"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["displayPrice"] = display_price
		if period != null and period.has_method("to_dict"):
			dict["period"] = period.to_dict()
		else:
			dict["period"] = period
		dict["price"] = price
		return dict

## Standardized subscription discount/promotional offer. Provides a unified interface for subscription offers across iOS and Android. Both platforms support subscription offers with different implementations: - iOS: Introductory offers, promotional offers with server-side signatures - Android: Offer tokens with pricing phases @see https://openiap.dev/docs/types/subscription-offer
class SubscriptionOffer:
	## Unique identifier for the offer. - iOS: Discount identifier from App Store Connect - Android: offerId from the Google Play subscription offer
	var id: String = ""
	## Formatted display price string (e.g., "$9.99/month")
	var display_price: String = ""
	## Numeric price value
	var price: float = 0.0
	## Currency code (ISO 4217, e.g., "USD")
	var currency: Variant = null
	## Type of subscription offer (Introductory or Promotional)
	var type: DiscountOfferType
	## Subscription period for this offer
	var period: SubscriptionPeriod
	## Number of periods the offer applies
	var period_count: Variant = null
	## Payment mode during the offer period
	var payment_mode: Variant = null
	## [iOS] Key identifier for signature validation. Used with server-side signature generation for promotional offers.
	var key_identifier_ios: Variant = null
	## [iOS] Cryptographic nonce (UUID) for signature validation. Must be generated server-side for each purchase attempt.
	var nonce_ios: Variant = null
	## [iOS] Server-generated signature for promotional offer validation. Required when applying promotional offers on iOS.
	var signature_ios: Variant = null
	## [iOS] Timestamp when the signature was generated. Used for signature validation.
	var timestamp_ios: Variant = null
	## [iOS] Number of billing periods for this discount.
	var number_of_periods_ios: Variant = null
	## [iOS] Localized price string.
	var localized_price_ios: Variant = null
	## [Android] Base plan identifier. Identifies which base plan this offer belongs to.
	var base_plan_id_android: Variant = null
	## [Android] Offer token required for purchase. Must be passed to requestPurchase() when purchasing with this offer.
	var offer_token_android: Variant = null
	## [Android] List of tags associated with this offer.
	var offer_tags_android: Array[String] = []
	## [Android] Pricing phases for this subscription offer. Contains detailed pricing information for each phase (trial, intro, regular).
	var pricing_phases_android: PricingPhasesAndroid
	## [Android] Installment plan details for this subscription offer. Only set for installment subscription plans; null for non-installment plans. Available in Google Play Billing Library 7.0+
	var installment_plan_details_android: InstallmentPlanDetailsAndroid

	static func from_dict(data: Dictionary, report_errors: bool = true) -> SubscriptionOffer:
		if not data.has("type") or not ((data["type"] is String and DISCOUNT_OFFER_TYPE_FROM_STRING.has(data["type"])) or (data["type"] is int and DISCOUNT_OFFER_TYPE_VALUES.has(data["type"]))):
			if report_errors:
				push_error("Invalid SubscriptionOffer.type enum value")
			return null
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
			elif enum_str is int and DISCOUNT_OFFER_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
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
			elif enum_str is int and PAYMENT_MODE_VALUES.has(enum_str):
				obj.payment_mode = enum_str
			else:
				obj.payment_mode = PaymentMode.UNKNOWN
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
			if data["offerTagsAndroid"] is Array:
				var arr: Array[String] = []
				for item in data["offerTagsAndroid"]:
					if item is String:
						arr.append(str(item))
				obj.offer_tags_android = arr
		if data.has("pricingPhasesAndroid") and data["pricingPhasesAndroid"] != null:
			if data["pricingPhasesAndroid"] is Dictionary:
				obj.pricing_phases_android = PricingPhasesAndroid.from_dict(data["pricingPhasesAndroid"])
			else:
				obj.pricing_phases_android = data["pricingPhasesAndroid"]
		if data.has("installmentPlanDetailsAndroid") and data["installmentPlanDetailsAndroid"] != null:
			if data["installmentPlanDetailsAndroid"] is Dictionary:
				obj.installment_plan_details_android = InstallmentPlanDetailsAndroid.from_dict(data["installmentPlanDetailsAndroid"])
			else:
				obj.installment_plan_details_android = data["installmentPlanDetailsAndroid"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["id"] = id
		dict["displayPrice"] = display_price
		dict["price"] = price
		if currency != null:
			dict["currency"] = currency
		if DISCOUNT_OFFER_TYPE_VALUES.has(type):
			dict["type"] = DISCOUNT_OFFER_TYPE_VALUES[type]
		else:
			dict["type"] = type
		if period != null and period.has_method("to_dict"):
			dict["period"] = period.to_dict()
		else:
			dict["period"] = period
		if period_count != null:
			dict["periodCount"] = period_count
		if payment_mode != null:
			if PAYMENT_MODE_VALUES.has(payment_mode):
				dict["paymentMode"] = PAYMENT_MODE_VALUES[payment_mode]
			else:
				dict["paymentMode"] = payment_mode
		if key_identifier_ios != null:
			dict["keyIdentifierIOS"] = key_identifier_ios
		if nonce_ios != null:
			dict["nonceIOS"] = nonce_ios
		if signature_ios != null:
			dict["signatureIOS"] = signature_ios
		if timestamp_ios != null:
			dict["timestampIOS"] = timestamp_ios
		if number_of_periods_ios != null:
			dict["numberOfPeriodsIOS"] = number_of_periods_ios
		if localized_price_ios != null:
			dict["localizedPriceIOS"] = localized_price_ios
		if base_plan_id_android != null:
			dict["basePlanIdAndroid"] = base_plan_id_android
		if offer_token_android != null:
			dict["offerTokenAndroid"] = offer_token_android
		dict["offerTagsAndroid"] = offer_tags_android
		if pricing_phases_android != null and pricing_phases_android.has_method("to_dict"):
			dict["pricingPhasesAndroid"] = pricing_phases_android.to_dict()
		else:
			dict["pricingPhasesAndroid"] = pricing_phases_android
		if installment_plan_details_android != null and installment_plan_details_android.has_method("to_dict"):
			dict["installmentPlanDetailsAndroid"] = installment_plan_details_android.to_dict()
		else:
			dict["installmentPlanDetailsAndroid"] = installment_plan_details_android
		return dict

## Subscription period value combining unit and count.
class SubscriptionPeriod:
	## The period unit (day, week, month, year)
	var unit: SubscriptionPeriodUnit = SubscriptionPeriodUnit.UNKNOWN
	## The number of units (e.g., 1 for monthly, 3 for quarterly)
	var value: int = 0

	static func from_dict(data: Dictionary) -> SubscriptionPeriod:
		var obj = SubscriptionPeriod.new()
		if data.has("unit") and data["unit"] != null:
			var enum_str = data["unit"]
			if enum_str is String and SUBSCRIPTION_PERIOD_UNIT_FROM_STRING.has(enum_str):
				obj.unit = SUBSCRIPTION_PERIOD_UNIT_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_PERIOD_UNIT_VALUES.has(enum_str):
				obj.unit = enum_str
			else:
				obj.unit = SubscriptionPeriodUnit.UNKNOWN
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
	var unit: SubscriptionPeriodIOS = SubscriptionPeriodIOS.EMPTY
	var value: int = 0

	static func from_dict(data: Dictionary, report_errors: bool = true) -> SubscriptionPeriodValueIOS:
		if data.has("unit") and data["unit"] != null and not ((data["unit"] is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(data["unit"])) or (data["unit"] is int and SUBSCRIPTION_PERIOD_IOS_VALUES.has(data["unit"]))):
			if report_errors:
				push_error("Invalid SubscriptionPeriodValueIOS.unit enum value")
			return null
		var obj = SubscriptionPeriodValueIOS.new()
		if data.has("unit") and data["unit"] != null:
			var enum_str = data["unit"]
			if enum_str is String and SUBSCRIPTION_PERIOD_IOS_FROM_STRING.has(enum_str):
				obj.unit = SUBSCRIPTION_PERIOD_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_PERIOD_IOS_VALUES.has(enum_str):
				obj.unit = enum_str
			elif not enum_str is String:
				obj.unit = SubscriptionPeriodIOS.EMPTY
			else:
				push_error("Unknown SubscriptionPeriodIOS value: %s" % enum_str)
		if data.has("value") and data["value"] != null:
			obj.value = data["value"]
		return obj

	static func from_dict_or_null(data: Dictionary) -> Variant:
		return from_dict(data, false)

	func to_dict() -> Dictionary:
		var dict = {}
		if SUBSCRIPTION_PERIOD_IOS_VALUES.has(unit):
			dict["unit"] = SUBSCRIPTION_PERIOD_IOS_VALUES[unit]
		else:
			dict["unit"] = unit
		dict["value"] = value
		return dict

class SubscriptionPricingTermsIOS:
	var billing_display_price: String = ""
	var billing_period: SubscriptionPeriodValueIOS
	var billing_plan_type: SubscriptionBillingPlanTypeIOS = SubscriptionBillingPlanTypeIOS.UNKNOWN
	var billing_price: float = 0.0
	var commitment_info: SubscriptionCommitmentInfoIOS
	var subscription_offers: Array[SubscriptionOffer] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> SubscriptionPricingTermsIOS:
		var obj = SubscriptionPricingTermsIOS.new()
		if data.has("billingDisplayPrice") and data["billingDisplayPrice"] != null:
			obj.billing_display_price = data["billingDisplayPrice"]
		if data.has("billingPeriod") and data["billingPeriod"] != null:
			if data["billingPeriod"] is Dictionary:
				var decoded_billing_period = SubscriptionPeriodValueIOS.from_dict(data["billingPeriod"], report_errors)
				if decoded_billing_period == null:
					if report_errors:
						push_error("Invalid required SubscriptionPeriodValueIOS value for billingPeriod")
					return null
				obj.billing_period = decoded_billing_period
			else:
				if report_errors:
					push_error("Expected billingPeriod to be a SubscriptionPeriodValueIOS dictionary")
				return null
		else:
			if report_errors:
				push_error("Missing required billingPeriod value")
			return null
		if data.has("billingPlanType") and data["billingPlanType"] != null:
			var enum_str = data["billingPlanType"]
			if enum_str is String and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.billing_plan_type = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(enum_str):
				obj.billing_plan_type = enum_str
			else:
				obj.billing_plan_type = SubscriptionBillingPlanTypeIOS.UNKNOWN
		if data.has("billingPrice") and data["billingPrice"] != null:
			obj.billing_price = data["billingPrice"]
		if data.has("commitmentInfo") and data["commitmentInfo"] != null:
			if data["commitmentInfo"] is Dictionary:
				var decoded_commitment_info = SubscriptionCommitmentInfoIOS.from_dict(data["commitmentInfo"], report_errors)
				if decoded_commitment_info == null:
					if report_errors:
						push_error("Invalid required SubscriptionCommitmentInfoIOS value for commitmentInfo")
					return null
				obj.commitment_info = decoded_commitment_info
			else:
				if report_errors:
					push_error("Expected commitmentInfo to be a SubscriptionCommitmentInfoIOS dictionary")
				return null
		else:
			if report_errors:
				push_error("Missing required commitmentInfo value")
			return null
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[SubscriptionOffer] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)
						if decoded_subscription_offer == null:
							return null
						arr.append(decoded_subscription_offer)
					elif item is SubscriptionOffer:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid SubscriptionOffer list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["billingDisplayPrice"] = billing_display_price
		if billing_period != null and billing_period.has_method("to_dict"):
			dict["billingPeriod"] = billing_period.to_dict()
		else:
			dict["billingPeriod"] = billing_period
		if SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(billing_plan_type):
			dict["billingPlanType"] = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES[billing_plan_type]
		else:
			dict["billingPlanType"] = billing_plan_type
		dict["billingPrice"] = billing_price
		if commitment_info != null and commitment_info.has_method("to_dict"):
			dict["commitmentInfo"] = commitment_info.to_dict()
		else:
			dict["commitmentInfo"] = commitment_info
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
		return dict

class SubscriptionStatusIOS:
	var state: String = ""
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

class TransactionCommitmentInfoIOS:
	var billing_period_number: int = 0
	var commitment_expires_date: float = 0.0
	var commitment_price: float = 0.0
	var total_billing_periods: int = 0

	static func from_dict(data: Dictionary) -> TransactionCommitmentInfoIOS:
		var obj = TransactionCommitmentInfoIOS.new()
		if data.has("billingPeriodNumber") and data["billingPeriodNumber"] != null:
			obj.billing_period_number = data["billingPeriodNumber"]
		if data.has("commitmentExpiresDate") and data["commitmentExpiresDate"] != null:
			obj.commitment_expires_date = data["commitmentExpiresDate"]
		if data.has("commitmentPrice") and data["commitmentPrice"] != null:
			obj.commitment_price = data["commitmentPrice"]
		if data.has("totalBillingPeriods") and data["totalBillingPeriods"] != null:
			obj.total_billing_periods = data["totalBillingPeriods"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["billingPeriodNumber"] = billing_period_number
		dict["commitmentExpiresDate"] = commitment_expires_date
		dict["commitmentPrice"] = commitment_price
		dict["totalBillingPeriods"] = total_billing_periods
		return dict

## User Choice Billing event details (Android) Fired when a user selects alternative billing in the User Choice Billing dialog
class UserChoiceBillingDetails:
	## Token that must be reported to Google Play within 24 hours
	var external_transaction_token: String = ""
	## External transaction ID of the originating subscription when the user is upgrading or downgrading a developer-billed subscription. Available in OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).
	var original_external_transaction_id: Variant = null
	## List of product IDs selected by the user
	var products: Array[String] = []
	## Structured product details selected in the user-choice flow, including the product type and offer token. Legacy payloads may omit this field; use products as the product-ID fallback. Available in OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).
	var product_details_android: Array[DeveloperProvidedBillingProductAndroid] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> UserChoiceBillingDetails:
		var obj = UserChoiceBillingDetails.new()
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		if data.has("originalExternalTransactionId") and data["originalExternalTransactionId"] != null:
			obj.original_external_transaction_id = data["originalExternalTransactionId"]
		if data.has("products") and data["products"] != null:
			if data["products"] is Array:
				var arr: Array[String] = []
				for item in data["products"]:
					if item is String:
						arr.append(str(item))
				obj.products = arr
		if data.has("productDetailsAndroid") and data["productDetailsAndroid"] != null:
			if data["productDetailsAndroid"] is Array:
				var arr: Array[DeveloperProvidedBillingProductAndroid] = []
				for item in data["productDetailsAndroid"]:
					if item is Dictionary:
						var decoded_developer_provided_billing_product_android = DeveloperProvidedBillingProductAndroid.from_dict(item, report_errors)
						if decoded_developer_provided_billing_product_android == null:
							return null
						arr.append(decoded_developer_provided_billing_product_android)
					elif item is DeveloperProvidedBillingProductAndroid:
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid DeveloperProvidedBillingProductAndroid list value for productDetailsAndroid")
						return null
				obj.product_details_android = arr
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["externalTransactionToken"] = external_transaction_token
		if original_external_transaction_id != null:
			dict["originalExternalTransactionId"] = original_external_transaction_id
		dict["products"] = products
		if product_details_android != null:
			var arr = []
			for item in product_details_android:
				if item != null and item.has_method("to_dict"):
					arr.append(item.to_dict())
				else:
					arr.append(item)
			dict["productDetailsAndroid"] = arr
		else:
			dict["productDetailsAndroid"] = null
		return dict

## Valid time window for when an offer is available (Android) Available in Google Play Billing Library 8.0+
class ValidTimeWindowAndroid:
	## Start time in milliseconds since epoch
	var start_time_millis: String = ""
	## End time in milliseconds since epoch
	var end_time_millis: String = ""

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
	## Whether the purchase is valid. Uniform across every VerifyPurchaseResult variant so callers can gate entitlement without inspecting the concrete type.
	var is_valid: bool = false
	var auto_renewing: bool = false
	var beta_product: bool = false
	var cancel_date: Variant = null
	var cancel_reason: Variant = null
	var deferred_date: Variant = null
	var deferred_sku: Variant = null
	var free_trial_end_date: float = 0.0
	var grace_period_end_date: float = 0.0
	var parent_product_id: String = ""
	var product_id: String = ""
	var product_type: String = ""
	var purchase_date: float = 0.0
	var quantity: int = 0
	var receipt_id: String = ""
	var renewal_date: float = 0.0
	var term: String = ""
	var term_sku: String = ""
	var test_transaction: bool = false

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultAndroid:
		var obj = VerifyPurchaseResultAndroid.new()
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
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
		dict["isValid"] = is_valid
		dict["autoRenewing"] = auto_renewing
		dict["betaProduct"] = beta_product
		if cancel_date != null:
			dict["cancelDate"] = cancel_date
		if cancel_reason != null:
			dict["cancelReason"] = cancel_reason
		if deferred_date != null:
			dict["deferredDate"] = deferred_date
		if deferred_sku != null:
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
	## Whether the purchase is valid. Uniform across every VerifyPurchaseResult variant so callers can gate entitlement without inspecting the concrete type.
	var is_valid: bool = false
	## Whether the entitlement verification succeeded. @deprecated Renamed to isValid so every VerifyPurchaseResult variant answers validity the same way. Scheduled for removal in OpenIAP 4.0.
	var success: bool = false
	## Unix timestamp (seconds) when the entitlement was granted.
	var grant_time: Variant = null

	static func from_dict(data: Dictionary) -> VerifyPurchaseResultHorizon:
		var obj = VerifyPurchaseResultHorizon.new()
		if data.has("isValid") and data["isValid"] != null:
			obj.is_valid = data["isValid"]
		if data.has("success") and data["success"] != null:
			obj.success = data["success"]
		if data.has("grantTime") and data["grantTime"] != null:
			obj.grant_time = data["grantTime"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		dict["isValid"] = is_valid
		dict["success"] = success
		if grant_time != null:
			dict["grantTime"] = grant_time
		return dict

class VerifyPurchaseResultIOS:
	## Whether the receipt is valid
	var is_valid: bool = false
	## Receipt data string
	var receipt_data: String = ""
	## JWS representation
	var jws_representation: String = ""
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
	var message: String = ""
	var code: Variant = null

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
		if code != null:
			dict["code"] = code
		return dict

class VerifyPurchaseWithProviderResult:
	var provider: PurchaseVerificationProvider
	## IAPKit verification result
	var iapkit: RequestVerifyPurchaseWithIapkitResult
	## Error details if verification failed
	var errors: Array[VerifyPurchaseWithProviderError] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> VerifyPurchaseWithProviderResult:
		if not data.has("provider") or not ((data["provider"] is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(data["provider"])) or (data["provider"] is int and PURCHASE_VERIFICATION_PROVIDER_VALUES.has(data["provider"]))):
			if report_errors:
				push_error("Invalid VerifyPurchaseWithProviderResult.provider enum value")
			return null
		var obj = VerifyPurchaseWithProviderResult.new()
		if data.has("provider") and data["provider"] != null:
			var enum_str = data["provider"]
			if enum_str is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(enum_str):
				obj.provider = PURCHASE_VERIFICATION_PROVIDER_FROM_STRING[enum_str]
			elif enum_str is int and PURCHASE_VERIFICATION_PROVIDER_VALUES.has(enum_str):
				obj.provider = enum_str
			else:
				obj.provider = enum_str
		if data.has("iapkit") and data["iapkit"] != null:
			if data["iapkit"] is Dictionary:
				obj.iapkit = RequestVerifyPurchaseWithIapkitResult.from_dict(data["iapkit"])
			else:
				obj.iapkit = data["iapkit"]
		if data.has("errors") and data["errors"] != null:
			if data["errors"] is Array:
				var arr: Array[VerifyPurchaseWithProviderError] = []
				for item in data["errors"]:
					if item is Dictionary:
						arr.append(VerifyPurchaseWithProviderError.from_dict(item))
					elif item is VerifyPurchaseWithProviderError:
						arr.append(item)
					else:
						push_error("Invalid VerifyPurchaseWithProviderError list value for errors")
						return null
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
	var success: bool = false

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
	var sku: String = ""
	## Offer token
	var offer_token: String = ""

	static func from_dict(data: Dictionary) -> AndroidSubscriptionOfferInput:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required AndroidSubscriptionOfferInput.sku value")
			return null
		if not data.has("offerToken") or not data["offerToken"] is String:
			push_error("Invalid required AndroidSubscriptionOfferInput.offerToken value")
			return null
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

## Parameters for showing a billing program information dialog (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
class BillingProgramInformationDialogParamsAndroid:
	## Billing program. Currently only BILLING_CHOICE is supported.
	var billing_program: BillingProgramAndroid = BillingProgramAndroid.BILLING_CHOICE
	## External transaction token returned by the Billing Choice reporting-details flow.
	var external_transaction_token: String = ""

	static func from_dict(data: Dictionary, report_errors: bool = true) -> BillingProgramInformationDialogParamsAndroid:
		if not data.has("externalTransactionToken") or not data["externalTransactionToken"] is String:
			push_error("Invalid required BillingProgramInformationDialogParamsAndroid.externalTransactionToken value")
			return null
		if data.has("billingProgram") and data["billingProgram"] != null and not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid BillingProgramInformationDialogParamsAndroid.billingProgram enum value")
			return null
		var obj = BillingProgramInformationDialogParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
			else:
				push_error("Invalid BillingProgramAndroid input value")
				return null
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if billing_program != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
				dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
			else:
				dict["billingProgram"] = billing_program
		if external_transaction_token != null:
			dict["externalTransactionToken"] = external_transaction_token
		return dict

class DeepLinkOptions:
	## Android SKU to open (required on Android)
	var sku_android: Variant = null
	## Android package name to target (required on Android)
	var package_name_android: Variant = null

	static func from_dict(data: Dictionary) -> DeepLinkOptions:
		if data.has("skuAndroid") and data["skuAndroid"] != null and not data["skuAndroid"] is String:
			push_error("Invalid DeepLinkOptions.skuAndroid value")
			return null
		if data.has("packageNameAndroid") and data["packageNameAndroid"] != null and not data["packageNameAndroid"] is String:
			push_error("Invalid DeepLinkOptions.packageNameAndroid value")
			return null
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

## Parameters for a developer billing option in a purchase flow (Android). Used with BillingFlowParams for external payments (8.3.0+) and Billing Choice (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+). Only billingProgram is required; link fields are used when the selected program links outside the app.
class DeveloperBillingOptionParamsAndroid:
	## The billing program. Use EXTERNAL_PAYMENTS or BILLING_CHOICE.
	var billing_program: BillingProgramAndroid
	## The URI where the external payment will be processed. Required only when the selected billing program links outside the app.
	var link_uri: Variant = null
	## The launch mode for the external payment link. Required only when the selected billing program links outside the app.
	var launch_mode: Variant = null
	## A pre-generated external transaction token for a Billing Choice external-link flow. Omit it when Google Play should provide the token in the callback.
	var external_transaction_token: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> DeveloperBillingOptionParamsAndroid:
		if data.has("linkUri") and data["linkUri"] != null and not data["linkUri"] is String:
			push_error("Invalid DeveloperBillingOptionParamsAndroid.linkUri value")
			return null
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null and not data["externalTransactionToken"] is String:
			push_error("Invalid DeveloperBillingOptionParamsAndroid.externalTransactionToken value")
			return null
		if not data.has("billingProgram") or not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid DeveloperBillingOptionParamsAndroid.billingProgram enum value")
			return null
		var obj = DeveloperBillingOptionParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
			else:
				push_error("Invalid BillingProgramAndroid input value")
				return null
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		if data.has("launchMode") and data["launchMode"] != null:
			var enum_str = data["launchMode"]
			if enum_str is String and DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.launch_mode = DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES.has(enum_str):
				obj.launch_mode = enum_str
			else:
				push_error("Invalid DeveloperBillingLaunchModeAndroid input value")
				return null
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
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
		if external_transaction_token != null:
			dict["externalTransactionToken"] = external_transaction_token
		return dict

class DiscountOfferInputIOS:
	## Discount identifier
	var identifier: String = ""
	## Key identifier for validation
	var key_identifier: String = ""
	## Cryptographic nonce
	var nonce: String = ""
	## Signature for validation
	var signature: String = ""
	## Timestamp of discount offer
	var timestamp: float = 0.0

	static func from_dict(data: Dictionary) -> DiscountOfferInputIOS:
		if not data.has("identifier") or not data["identifier"] is String:
			push_error("Invalid required DiscountOfferInputIOS.identifier value")
			return null
		if not data.has("keyIdentifier") or not data["keyIdentifier"] is String:
			push_error("Invalid required DiscountOfferInputIOS.keyIdentifier value")
			return null
		if not data.has("nonce") or not data["nonce"] is String:
			push_error("Invalid required DiscountOfferInputIOS.nonce value")
			return null
		if not data.has("signature") or not data["signature"] is String:
			push_error("Invalid required DiscountOfferInputIOS.signature value")
			return null
		if not data.has("timestamp") or not (data["timestamp"] is int or data["timestamp"] is float):
			push_error("Invalid required DiscountOfferInputIOS.timestamp value")
			return null
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

## Parameters for fetching Billing Choice display information (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
class GetBillingChoiceInfoParamsAndroid:
	## Billing program. Currently only BILLING_CHOICE is supported.
	var billing_program: BillingProgramAndroid = BillingProgramAndroid.BILLING_CHOICE
	## Desired Play Billing choice image layout.
	var play_billing_choice_image_layout: BillingChoiceImageLayoutAndroid = BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE
	## BCP 47 locale tag. If omitted, Play Billing uses the user's default locale.
	var user_locale: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> GetBillingChoiceInfoParamsAndroid:
		if data.has("userLocale") and data["userLocale"] != null and not data["userLocale"] is String:
			push_error("Invalid GetBillingChoiceInfoParamsAndroid.userLocale value")
			return null
		if data.has("billingProgram") and data["billingProgram"] != null and not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid GetBillingChoiceInfoParamsAndroid.billingProgram enum value")
			return null
		if data.has("playBillingChoiceImageLayout") and data["playBillingChoiceImageLayout"] != null and not ((data["playBillingChoiceImageLayout"] is String and BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_FROM_STRING.has(data["playBillingChoiceImageLayout"])) or (data["playBillingChoiceImageLayout"] is int and BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_VALUES.has(data["playBillingChoiceImageLayout"]))):
			if report_errors:
				push_error("Invalid GetBillingChoiceInfoParamsAndroid.playBillingChoiceImageLayout enum value")
			return null
		var obj = GetBillingChoiceInfoParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
			else:
				push_error("Invalid BillingProgramAndroid input value")
				return null
		if data.has("playBillingChoiceImageLayout") and data["playBillingChoiceImageLayout"] != null:
			var enum_str = data["playBillingChoiceImageLayout"]
			if enum_str is String and BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_FROM_STRING.has(enum_str):
				obj.play_billing_choice_image_layout = BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_VALUES.has(enum_str):
				obj.play_billing_choice_image_layout = enum_str
			else:
				push_error("Invalid BillingChoiceImageLayoutAndroid input value")
				return null
		if data.has("userLocale") and data["userLocale"] != null:
			obj.user_locale = data["userLocale"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if billing_program != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(billing_program):
				dict["billingProgram"] = BILLING_PROGRAM_ANDROID_VALUES[billing_program]
			else:
				dict["billingProgram"] = billing_program
		if play_billing_choice_image_layout != null:
			if BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_VALUES.has(play_billing_choice_image_layout):
				dict["playBillingChoiceImageLayout"] = BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_VALUES[play_billing_choice_image_layout]
			else:
				dict["playBillingChoiceImageLayout"] = play_billing_choice_image_layout
		if user_locale != null:
			dict["userLocale"] = user_locale
		return dict

## Parameters for showing Play billing in-app messages (Android) Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0).
class InAppMessageParamsAndroid:
	## In-app message categories to show. Defaults to transactional messages.
	var categories: Array[InAppMessageCategoryAndroid] = [InAppMessageCategoryAndroid.TRANSACTIONAL]

	static func from_dict(data: Dictionary) -> InAppMessageParamsAndroid:
		var obj = InAppMessageParamsAndroid.new()
		if data.has("categories") and data["categories"] != null:
			if data["categories"] is Array:
				var arr: Array[InAppMessageCategoryAndroid] = []
				for item in data["categories"]:
					if item is String and IN_APP_MESSAGE_CATEGORY_ANDROID_FROM_STRING.has(item):
						arr.append(IN_APP_MESSAGE_CATEGORY_ANDROID_FROM_STRING[item])
					elif item is int and IN_APP_MESSAGE_CATEGORY_ANDROID_VALUES.has(item):
						arr.append(item)
					else:
						push_error("Invalid InAppMessageCategoryAndroid list value for categories")
						return null
				obj.categories = arr
			else:
				push_error("Invalid input list for categories")
				return null
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if categories != null:
			var arr = []
			for item in categories:
				if IN_APP_MESSAGE_CATEGORY_ANDROID_VALUES.has(item):
					arr.append(IN_APP_MESSAGE_CATEGORY_ANDROID_VALUES[item])
				else:
					arr.append(item)
			dict["categories"] = arr
		return dict

## Connection initialization configuration
class InitConnectionConfig:
	## Enable a specific billing program for Android (7.0+) When set, enables the specified billing program for external transactions. - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+) - EXTERNAL_CONTENT_LINK: Link to external content (introduced in 8.2.0; use 8.2.1+) - EXTERNAL_OFFER: External offers for digital content (introduced in 8.2.0; use 8.2.1+) - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+) - BILLING_CHOICE: Google-rendered or developer-rendered billing choice (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+)
	var enable_billing_program_android: Variant = null
	## Billing Choice renderer configured in Play Console. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). GOOGLE_RENDERED registers the developer-provided billing listener so OpenIAP can emit the selection event. DEVELOPER_RENDERED omits that listener so the app can render its own choice screen and use the reporting/dialog/link APIs. Must match choiceScreenType returned by isBillingProgramAvailableAndroid. Defaults to GOOGLE_RENDERED.
	var billing_choice_screen_type_android: BillingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.GOOGLE_RENDERED

	static func from_dict(data: Dictionary) -> InitConnectionConfig:
		var obj = InitConnectionConfig.new()
		if data.has("enableBillingProgramAndroid") and data["enableBillingProgramAndroid"] != null:
			var enum_str = data["enableBillingProgramAndroid"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.enable_billing_program_android = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.enable_billing_program_android = enum_str
			else:
				push_error("Invalid BillingProgramAndroid input value")
				return null
		if data.has("billingChoiceScreenTypeAndroid") and data["billingChoiceScreenTypeAndroid"] != null:
			var enum_str = data["billingChoiceScreenTypeAndroid"]
			if enum_str is String and BILLING_CHOICE_SCREEN_TYPE_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_choice_screen_type_android = BILLING_CHOICE_SCREEN_TYPE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES.has(enum_str):
				obj.billing_choice_screen_type_android = enum_str
			else:
				push_error("Invalid BillingChoiceScreenTypeAndroid input value")
				return null
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if enable_billing_program_android != null:
			if BILLING_PROGRAM_ANDROID_VALUES.has(enable_billing_program_android):
				dict["enableBillingProgramAndroid"] = BILLING_PROGRAM_ANDROID_VALUES[enable_billing_program_android]
			else:
				dict["enableBillingProgramAndroid"] = enable_billing_program_android
		if billing_choice_screen_type_android != null:
			if BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES.has(billing_choice_screen_type_android):
				dict["billingChoiceScreenTypeAndroid"] = BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES[billing_choice_screen_type_android]
			else:
				dict["billingChoiceScreenTypeAndroid"] = billing_choice_screen_type_android
		return dict

## Parameters for launching an external link (Android) Used with launchExternalLink to initiate external offer, app install, or developer-rendered Billing Choice flows Available in Google Play Billing Library 8.2.0+
class LaunchExternalLinkParamsAndroid:
	## The billing program (EXTERNAL_CONTENT_LINK, EXTERNAL_OFFER, or BILLING_CHOICE)
	var billing_program: BillingProgramAndroid
	## The external link launch mode
	var launch_mode: ExternalLinkLaunchModeAndroid
	## The type of the external link
	var link_type: ExternalLinkTypeAndroid
	## The URI where the content will be accessed from
	var link_uri: String = ""
	## External transaction token for a developer-rendered Billing Choice external-link flow. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Generate it with createBillingProgramReportingDetailsAndroid.
	var external_transaction_token: Variant = null

	static func from_dict(data: Dictionary, report_errors: bool = true) -> LaunchExternalLinkParamsAndroid:
		if not data.has("linkUri") or not data["linkUri"] is String:
			push_error("Invalid required LaunchExternalLinkParamsAndroid.linkUri value")
			return null
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null and not data["externalTransactionToken"] is String:
			push_error("Invalid LaunchExternalLinkParamsAndroid.externalTransactionToken value")
			return null
		if not data.has("billingProgram") or not ((data["billingProgram"] is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(data["billingProgram"])) or (data["billingProgram"] is int and BILLING_PROGRAM_ANDROID_VALUES.has(data["billingProgram"]))):
			if report_errors:
				push_error("Invalid LaunchExternalLinkParamsAndroid.billingProgram enum value")
			return null
		if not data.has("launchMode") or not ((data["launchMode"] is String and EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING.has(data["launchMode"])) or (data["launchMode"] is int and EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES.has(data["launchMode"]))):
			if report_errors:
				push_error("Invalid LaunchExternalLinkParamsAndroid.launchMode enum value")
			return null
		if not data.has("linkType") or not ((data["linkType"] is String and EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING.has(data["linkType"])) or (data["linkType"] is int and EXTERNAL_LINK_TYPE_ANDROID_VALUES.has(data["linkType"]))):
			if report_errors:
				push_error("Invalid LaunchExternalLinkParamsAndroid.linkType enum value")
			return null
		var obj = LaunchExternalLinkParamsAndroid.new()
		if data.has("billingProgram") and data["billingProgram"] != null:
			var enum_str = data["billingProgram"]
			if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
				obj.billing_program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
				obj.billing_program = enum_str
			else:
				push_error("Invalid BillingProgramAndroid input value")
				return null
		if data.has("launchMode") and data["launchMode"] != null:
			var enum_str = data["launchMode"]
			if enum_str is String and EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.launch_mode = EXTERNAL_LINK_LAUNCH_MODE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and EXTERNAL_LINK_LAUNCH_MODE_ANDROID_VALUES.has(enum_str):
				obj.launch_mode = enum_str
			else:
				push_error("Invalid ExternalLinkLaunchModeAndroid input value")
				return null
		if data.has("linkType") and data["linkType"] != null:
			var enum_str = data["linkType"]
			if enum_str is String and EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING.has(enum_str):
				obj.link_type = EXTERNAL_LINK_TYPE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and EXTERNAL_LINK_TYPE_ANDROID_VALUES.has(enum_str):
				obj.link_type = enum_str
			else:
				push_error("Invalid ExternalLinkTypeAndroid input value")
				return null
		if data.has("linkUri") and data["linkUri"] != null:
			obj.link_uri = data["linkUri"]
		if data.has("externalTransactionToken") and data["externalTransactionToken"] != null:
			obj.external_transaction_token = data["externalTransactionToken"]
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
		if external_transaction_token != null:
			dict["externalTransactionToken"] = external_transaction_token
		return dict

class ProductRequest:
	var skus: Array[String] = []
	var type: ProductQueryType = ProductQueryType.IN_APP

	static func from_dict(data: Dictionary) -> ProductRequest:
		if not data.has("skus") or not data["skus"] is Array:
			push_error("Invalid required ProductRequest.skus value")
			return null
		var obj = ProductRequest.new()
		if data.has("skus") and data["skus"] != null:
			if data["skus"] is Array:
				var arr: Array[String] = []
				for item in data["skus"]:
					if item is String:
						arr.append(str(item))
					else:
						push_error("Invalid String list value for skus")
						return null
				obj.skus = arr
			else:
				push_error("Invalid input list for skus")
				return null
		if data.has("type") and data["type"] != null:
			var enum_str = data["type"]
			if enum_str is String and PRODUCT_QUERY_TYPE_FROM_STRING.has(enum_str):
				obj.type = PRODUCT_QUERY_TYPE_FROM_STRING[enum_str]
			elif enum_str is int and PRODUCT_QUERY_TYPE_VALUES.has(enum_str):
				obj.type = enum_str
			else:
				push_error("Invalid ProductQueryType input value")
				return null
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
	var offer_id: String = ""
	## Compact JWS string signed by your server. The JWS should contain the promotional offer signature data. Format: header.payload.signature (base64url encoded)
	var jws: String = ""

	static func from_dict(data: Dictionary) -> PromotionalOfferJWSInputIOS:
		if not data.has("offerId") or not data["offerId"] is String:
			push_error("Invalid required PromotionalOfferJWSInputIOS.offerId value")
			return null
		if not data.has("jws") or not data["jws"] is String:
			push_error("Invalid required PromotionalOfferJWSInputIOS.jws value")
			return null
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
	var id: String = ""
	var product_id: String = ""
	var ids: Array[String] = []
	## Unix timestamp in milliseconds since January 1, 1970 UTC.
	var transaction_date: float = 0.0
	var purchase_token: Variant = null
	## Store where purchase was made
	var store: Variant = null
	var quantity: int = 0
	var purchase_state: PurchaseState = PurchaseState.UNKNOWN
	var is_auto_renewing: bool = false

	static func from_dict(data: Dictionary) -> PurchaseInput:
		var obj = PurchaseInput.new()
		if data.has("id") and data["id"] != null:
			obj.id = data["id"]
		if data.has("productId") and data["productId"] != null:
			obj.product_id = data["productId"]
		if data.has("ids") and data["ids"] != null:
			if data["ids"] is Array:
				var arr: Array[String] = []
				for item in data["ids"]:
					if item is String:
						arr.append(str(item))
				obj.ids = arr
		if data.has("transactionDate") and data["transactionDate"] != null:
			obj.transaction_date = data["transactionDate"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("store") and data["store"] != null:
			var enum_str = data["store"]
			if enum_str is String and IAP_STORE_FROM_STRING.has(enum_str):
				obj.store = IAP_STORE_FROM_STRING[enum_str]
			elif enum_str is int and IAP_STORE_VALUES.has(enum_str):
				obj.store = enum_str
			else:
				obj.store = IapStore.UNKNOWN
		if data.has("quantity") and data["quantity"] != null:
			obj.quantity = data["quantity"]
		if data.has("purchaseState") and data["purchaseState"] != null:
			var enum_str = data["purchaseState"]
			if enum_str is String and PURCHASE_STATE_FROM_STRING.has(enum_str):
				obj.purchase_state = PURCHASE_STATE_FROM_STRING[enum_str]
			elif enum_str is int and PURCHASE_STATE_VALUES.has(enum_str):
				obj.purchase_state = enum_str
			else:
				obj.purchase_state = PurchaseState.UNKNOWN
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
	var also_publish_to_event_listener_ios: Variant = null
	## Limit to currently active items on iOS
	var only_include_active_items_ios: Variant = null
	## Include suspended subscriptions in the result (Android 8.1+). Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements. Users should be directed to the subscription center to resolve payment issues. Default: false (only active subscriptions are returned)
	var include_suspended_android: Variant = null

	static func from_dict(data: Dictionary) -> PurchaseOptions:
		if data.has("alsoPublishToEventListenerIOS") and data["alsoPublishToEventListenerIOS"] != null and not data["alsoPublishToEventListenerIOS"] is bool:
			push_error("Invalid PurchaseOptions.alsoPublishToEventListenerIOS value")
			return null
		if data.has("onlyIncludeActiveItemsIOS") and data["onlyIncludeActiveItemsIOS"] != null and not data["onlyIncludeActiveItemsIOS"] is bool:
			push_error("Invalid PurchaseOptions.onlyIncludeActiveItemsIOS value")
			return null
		if data.has("includeSuspendedAndroid") and data["includeSuspendedAndroid"] != null and not data["includeSuspendedAndroid"] is bool:
			push_error("Invalid PurchaseOptions.includeSuspendedAndroid value")
			return null
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

class PurchaseUpdatedListenerOptions:
	## iOS only. Defaults to true. When false, listener callbacks also receive StoreKit replay events for a transaction ID that was already emitted during the current connection session. Android ignores this option.
	var dedupe_transaction_ios: Variant = null

	static func from_dict(data: Dictionary) -> PurchaseUpdatedListenerOptions:
		if data.has("dedupeTransactionIOS") and data["dedupeTransactionIOS"] != null and not data["dedupeTransactionIOS"] is bool:
			push_error("Invalid PurchaseUpdatedListenerOptions.dedupeTransactionIOS value")
			return null
		var obj = PurchaseUpdatedListenerOptions.new()
		if data.has("dedupeTransactionIOS") and data["dedupeTransactionIOS"] != null:
			obj.dedupe_transaction_ios = data["dedupeTransactionIOS"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if dedupe_transaction_ios != null:
			dict["dedupeTransactionIOS"] = dedupe_transaction_ios
		return dict

class RequestPurchaseAndroidProps:
	## List of product SKUs
	var skus: Array[String] = []
	## Obfuscated account ID
	var obfuscated_account_id: Variant = null
	## Obfuscated profile ID
	var obfuscated_profile_id: Variant = null
	## Personalized offer flag. When true, indicates the price was customized for this user.
	var is_offer_personalized: Variant = null
	## Offer token for one-time purchase discounts (8.0+). Pass the offerToken from discountOffers to apply a discount offer to the purchase.
	var offer_token: Variant = null
	## Developer billing option parameters for external payments and Billing Choice. Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
	var developer_billing_option: DeveloperBillingOptionParamsAndroid

	static func from_dict(data: Dictionary) -> RequestPurchaseAndroidProps:
		if not data.has("skus") or not data["skus"] is Array:
			push_error("Invalid required RequestPurchaseAndroidProps.skus value")
			return null
		if data.has("obfuscatedAccountId") and data["obfuscatedAccountId"] != null and not data["obfuscatedAccountId"] is String:
			push_error("Invalid RequestPurchaseAndroidProps.obfuscatedAccountId value")
			return null
		if data.has("obfuscatedProfileId") and data["obfuscatedProfileId"] != null and not data["obfuscatedProfileId"] is String:
			push_error("Invalid RequestPurchaseAndroidProps.obfuscatedProfileId value")
			return null
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null and not data["isOfferPersonalized"] is bool:
			push_error("Invalid RequestPurchaseAndroidProps.isOfferPersonalized value")
			return null
		if data.has("offerToken") and data["offerToken"] != null and not data["offerToken"] is String:
			push_error("Invalid RequestPurchaseAndroidProps.offerToken value")
			return null
		var obj = RequestPurchaseAndroidProps.new()
		if data.has("skus") and data["skus"] != null:
			if data["skus"] is Array:
				var arr: Array[String] = []
				for item in data["skus"]:
					if item is String:
						arr.append(str(item))
					else:
						push_error("Invalid String list value for skus")
						return null
				obj.skus = arr
			else:
				push_error("Invalid input list for skus")
				return null
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
				var decoded_developer_billing_option = DeveloperBillingOptionParamsAndroid.from_dict(data["developerBillingOption"])
				if decoded_developer_billing_option == null:
					push_error("Invalid input DeveloperBillingOptionParamsAndroid value for developerBillingOption")
					return null
				obj.developer_billing_option = decoded_developer_billing_option
			else:
				push_error("Expected developerBillingOption to be a DeveloperBillingOptionParamsAndroid dictionary")
				return null
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
	var sku: String = ""
	## Auto-finish transaction (dangerous)
	var and_dangerously_finish_transaction_automatically: Variant = null
	## App account token for user tracking
	var app_account_token: Variant = null
	## Purchase quantity
	var quantity: Variant = null
	## Promotional offer to apply (subscriptions only, ignored for one-time purchases). iOS only supports promotional offers for auto-renewable subscriptions.
	var with_offer: DiscountOfferInputIOS
	## Advanced commerce data token (iOS 15+). Used with StoreKit 2's Product.PurchaseOption.custom API for passing campaign tokens, affiliate IDs, or other attribution data. The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
	var advanced_commerce_data: Variant = null

	static func from_dict(data: Dictionary) -> RequestPurchaseIosProps:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required RequestPurchaseIosProps.sku value")
			return null
		if data.has("andDangerouslyFinishTransactionAutomatically") and data["andDangerouslyFinishTransactionAutomatically"] != null and not data["andDangerouslyFinishTransactionAutomatically"] is bool:
			push_error("Invalid RequestPurchaseIosProps.andDangerouslyFinishTransactionAutomatically value")
			return null
		if data.has("appAccountToken") and data["appAccountToken"] != null and not data["appAccountToken"] is String:
			push_error("Invalid RequestPurchaseIosProps.appAccountToken value")
			return null
		if data.has("quantity") and data["quantity"] != null and not data["quantity"] is int:
			push_error("Invalid RequestPurchaseIosProps.quantity value")
			return null
		if data.has("advancedCommerceData") and data["advancedCommerceData"] != null and not data["advancedCommerceData"] is String:
			push_error("Invalid RequestPurchaseIosProps.advancedCommerceData value")
			return null
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
				var decoded_with_offer = DiscountOfferInputIOS.from_dict(data["withOffer"])
				if decoded_with_offer == null:
					push_error("Invalid input DiscountOfferInputIOS value for withOffer")
					return null
				obj.with_offer = decoded_with_offer
			else:
				push_error("Expected withOffer to be a DiscountOfferInputIOS dictionary")
				return null
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
	var type: ProductQueryType = ProductQueryType.IN_APP

	static func in_app(platforms: RequestPurchasePropsByPlatforms) -> RequestPurchaseProps:
		var obj = RequestPurchaseProps.new()
		obj.request = platforms
		obj.type = ProductQueryType.IN_APP
		return obj

	static func subs(platforms: RequestSubscriptionPropsByPlatforms) -> RequestPurchaseProps:
		var obj = RequestPurchaseProps.new()
		obj.request_subscription = platforms
		obj.type = ProductQueryType.SUBS
		return obj

	static func from_dict(data: Dictionary) -> RequestPurchaseProps:
		var has_purchase = data.has("requestPurchase") and data["requestPurchase"] != null
		var has_subscription = data.has("requestSubscription") and data["requestSubscription"] != null
		if has_purchase == has_subscription:
			push_error("RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription")
			return null
		var obj = RequestPurchaseProps.new()
		if has_purchase:
			var purchase_value = data["requestPurchase"]
			if not purchase_value is Dictionary:
				push_error("requestPurchase must be a dictionary")
				return null
			obj.request = RequestPurchasePropsByPlatforms.from_dict(purchase_value)
			if obj.request == null:
				return null
		else:
			var subscription_value = data["requestSubscription"]
			if not subscription_value is Dictionary:
				push_error("requestSubscription must be a dictionary")
				return null
			obj.request_subscription = RequestSubscriptionPropsByPlatforms.from_dict(subscription_value)
			if obj.request_subscription == null:
				return null
		var expected_type = ProductQueryType.IN_APP if has_purchase else ProductQueryType.SUBS
		obj.type = expected_type
		if data.has("type") and data["type"] != null:
			var enum_value = data["type"]
			obj.type = PRODUCT_QUERY_TYPE_FROM_STRING.get(enum_value, enum_value) if enum_value is String else enum_value
		if obj.type != expected_type:
			push_error("RequestPurchaseProps.type does not match its request branch")
			return null
		return obj

	func to_dict() -> Dictionary:
		var has_purchase = request != null
		var has_subscription = request_subscription != null
		if has_purchase == has_subscription:
			push_error("RequestPurchaseProps requires exactly one purchase branch")
			return {}
		var expected_type = ProductQueryType.IN_APP if has_purchase else ProductQueryType.SUBS
		if type != expected_type:
			push_error("RequestPurchaseProps.type does not match its request branch")
			return {}
		var dict = {}
		if has_purchase:
			dict["requestPurchase"] = request.to_dict() if request.has_method("to_dict") else request
		else:
			dict["requestSubscription"] = request_subscription.to_dict() if request_subscription.has_method("to_dict") else request_subscription
		dict["type"] = PRODUCT_QUERY_TYPE_VALUES.get(type, type)
		return dict

## Platform-specific purchase request parameters. Note: "Platforms" refers to the SDK/OS level (apple, google), not the store. - apple: Always targets App Store - google: Targets Play Store by default, Horizon when built with horizon flavor, or Fire OS when built with amazon flavor (determined at build time, not runtime)
class RequestPurchasePropsByPlatforms:
	## Apple-specific purchase parameters
	var apple: RequestPurchaseIosProps
	## Google-specific purchase parameters
	var google: RequestPurchaseAndroidProps

	static func from_dict(data: Dictionary) -> RequestPurchasePropsByPlatforms:
		var obj = RequestPurchasePropsByPlatforms.new()
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				var decoded_apple = RequestPurchaseIosProps.from_dict(data["apple"])
				if decoded_apple == null:
					push_error("Invalid input RequestPurchaseIosProps value for apple")
					return null
				obj.apple = decoded_apple
			else:
				push_error("Expected apple to be a RequestPurchaseIosProps dictionary")
				return null
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				var decoded_google = RequestPurchaseAndroidProps.from_dict(data["google"])
				if decoded_google == null:
					push_error("Invalid input RequestPurchaseAndroidProps value for google")
					return null
				obj.google = decoded_google
			else:
				push_error("Expected google to be a RequestPurchaseAndroidProps dictionary")
				return null
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
		return dict

class RequestSubscriptionAndroidProps:
	## List of subscription SKUs
	var skus: Array[String] = []
	## Obfuscated account ID
	var obfuscated_account_id: Variant = null
	## Obfuscated profile ID
	var obfuscated_profile_id: Variant = null
	## Personalized offer flag. When true, indicates the price was customized for this user.
	var is_offer_personalized: Variant = null
	## Purchase token for upgrades/downgrades
	var purchase_token: Variant = null
	## Original external transaction ID for replacing a subscription that was purchased through developer billing. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
	var original_external_transaction_id: Variant = null
	## Subscription offers
	var subscription_offers: Array[AndroidSubscriptionOfferInput] = []
	## Product-level replacement parameters (8.1.0+) Use this instead of replacementMode for item-level replacement This singular form requires skus to contain exactly one target product. Multi-item subscription changes need a per-target replacement mapping and are rejected rather than applying one oldProductId to multiple products.
	var subscription_product_replacement_params: SubscriptionProductReplacementParamsAndroid
	## Developer billing option parameters for external payments and Billing Choice. Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
	var developer_billing_option: DeveloperBillingOptionParamsAndroid

	static func from_dict(data: Dictionary) -> RequestSubscriptionAndroidProps:
		if not data.has("skus") or not data["skus"] is Array:
			push_error("Invalid required RequestSubscriptionAndroidProps.skus value")
			return null
		if data.has("obfuscatedAccountId") and data["obfuscatedAccountId"] != null and not data["obfuscatedAccountId"] is String:
			push_error("Invalid RequestSubscriptionAndroidProps.obfuscatedAccountId value")
			return null
		if data.has("obfuscatedProfileId") and data["obfuscatedProfileId"] != null and not data["obfuscatedProfileId"] is String:
			push_error("Invalid RequestSubscriptionAndroidProps.obfuscatedProfileId value")
			return null
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null and not data["isOfferPersonalized"] is bool:
			push_error("Invalid RequestSubscriptionAndroidProps.isOfferPersonalized value")
			return null
		if data.has("purchaseToken") and data["purchaseToken"] != null and not data["purchaseToken"] is String:
			push_error("Invalid RequestSubscriptionAndroidProps.purchaseToken value")
			return null
		if data.has("originalExternalTransactionId") and data["originalExternalTransactionId"] != null and not data["originalExternalTransactionId"] is String:
			push_error("Invalid RequestSubscriptionAndroidProps.originalExternalTransactionId value")
			return null
		var obj = RequestSubscriptionAndroidProps.new()
		if data.has("skus") and data["skus"] != null:
			if data["skus"] is Array:
				var arr: Array[String] = []
				for item in data["skus"]:
					if item is String:
						arr.append(str(item))
					else:
						push_error("Invalid String list value for skus")
						return null
				obj.skus = arr
			else:
				push_error("Invalid input list for skus")
				return null
		if data.has("obfuscatedAccountId") and data["obfuscatedAccountId"] != null:
			obj.obfuscated_account_id = data["obfuscatedAccountId"]
		if data.has("obfuscatedProfileId") and data["obfuscatedProfileId"] != null:
			obj.obfuscated_profile_id = data["obfuscatedProfileId"]
		if data.has("isOfferPersonalized") and data["isOfferPersonalized"] != null:
			obj.is_offer_personalized = data["isOfferPersonalized"]
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		if data.has("originalExternalTransactionId") and data["originalExternalTransactionId"] != null:
			obj.original_external_transaction_id = data["originalExternalTransactionId"]
		if data.has("subscriptionOffers") and data["subscriptionOffers"] != null:
			if data["subscriptionOffers"] is Array:
				var arr: Array[AndroidSubscriptionOfferInput] = []
				for item in data["subscriptionOffers"]:
					if item is Dictionary:
						var decoded_android_subscription_offer_input = AndroidSubscriptionOfferInput.from_dict(item)
						if decoded_android_subscription_offer_input == null:
							return null
						arr.append(decoded_android_subscription_offer_input)
					elif item is AndroidSubscriptionOfferInput:
						arr.append(item)
					else:
						push_error("Invalid AndroidSubscriptionOfferInput list value for subscriptionOffers")
						return null
				obj.subscription_offers = arr
			else:
				push_error("Invalid input list for subscriptionOffers")
				return null
		if data.has("subscriptionProductReplacementParams") and data["subscriptionProductReplacementParams"] != null:
			if data["subscriptionProductReplacementParams"] is Dictionary:
				var decoded_subscription_product_replacement_params = SubscriptionProductReplacementParamsAndroid.from_dict(data["subscriptionProductReplacementParams"])
				if decoded_subscription_product_replacement_params == null:
					push_error("Invalid input SubscriptionProductReplacementParamsAndroid value for subscriptionProductReplacementParams")
					return null
				obj.subscription_product_replacement_params = decoded_subscription_product_replacement_params
			else:
				push_error("Expected subscriptionProductReplacementParams to be a SubscriptionProductReplacementParamsAndroid dictionary")
				return null
		if data.has("developerBillingOption") and data["developerBillingOption"] != null:
			if data["developerBillingOption"] is Dictionary:
				var decoded_developer_billing_option = DeveloperBillingOptionParamsAndroid.from_dict(data["developerBillingOption"])
				if decoded_developer_billing_option == null:
					push_error("Invalid input DeveloperBillingOptionParamsAndroid value for developerBillingOption")
					return null
				obj.developer_billing_option = decoded_developer_billing_option
			else:
				push_error("Expected developerBillingOption to be a DeveloperBillingOptionParamsAndroid dictionary")
				return null
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
		if original_external_transaction_id != null:
			dict["originalExternalTransactionId"] = original_external_transaction_id
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
	var sku: String = ""
	var and_dangerously_finish_transaction_automatically: Variant = null
	var app_account_token: Variant = null
	var quantity: Variant = null
	## Promotional offer to apply for subscription purchases. Requires server-signed offer with nonce, timestamp, keyId, and signature.
	var with_offer: DiscountOfferInputIOS
	## Win-back offer to apply (iOS 18+) Used to re-engage churned subscribers with a discount or free trial. The offer is available when the customer is eligible and can be discovered via StoreKit Message (automatic) or subscription offer APIs.
	var win_back_offer: WinBackOfferInputIOS
	## JWS promotional offer (iOS 15+, WWDC 2025). New signature format using compact JWS string for promotional offers. Back-deployed to iOS 15.
	var promotional_offer_jws: PromotionalOfferJWSInputIOS
	## Billing plan to use when purchasing an annual subscription that offers monthly billing with a 12-month commitment (iOS 26.4+).
	var billing_plan_type: Variant = null
	## Compact JWS string for overriding introductory offer eligibility (iOS 15+, WWDC 2025). When nil, the system determines eligibility. Generate the JWS on your server and pass it to StoreKit's introductoryOfferEligibility(compactJWS:) purchase option.
	var compact_jws: Variant = null
	## Advanced commerce data token (iOS 15+). Used with StoreKit 2's Product.PurchaseOption.custom API for passing campaign tokens, affiliate IDs, or other attribution data. The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
	var advanced_commerce_data: Variant = null

	static func from_dict(data: Dictionary) -> RequestSubscriptionIosProps:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required RequestSubscriptionIosProps.sku value")
			return null
		if data.has("andDangerouslyFinishTransactionAutomatically") and data["andDangerouslyFinishTransactionAutomatically"] != null and not data["andDangerouslyFinishTransactionAutomatically"] is bool:
			push_error("Invalid RequestSubscriptionIosProps.andDangerouslyFinishTransactionAutomatically value")
			return null
		if data.has("appAccountToken") and data["appAccountToken"] != null and not data["appAccountToken"] is String:
			push_error("Invalid RequestSubscriptionIosProps.appAccountToken value")
			return null
		if data.has("quantity") and data["quantity"] != null and not data["quantity"] is int:
			push_error("Invalid RequestSubscriptionIosProps.quantity value")
			return null
		if data.has("compactJWS") and data["compactJWS"] != null and not data["compactJWS"] is String:
			push_error("Invalid RequestSubscriptionIosProps.compactJWS value")
			return null
		if data.has("advancedCommerceData") and data["advancedCommerceData"] != null and not data["advancedCommerceData"] is String:
			push_error("Invalid RequestSubscriptionIosProps.advancedCommerceData value")
			return null
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
				var decoded_with_offer = DiscountOfferInputIOS.from_dict(data["withOffer"])
				if decoded_with_offer == null:
					push_error("Invalid input DiscountOfferInputIOS value for withOffer")
					return null
				obj.with_offer = decoded_with_offer
			else:
				push_error("Expected withOffer to be a DiscountOfferInputIOS dictionary")
				return null
		if data.has("winBackOffer") and data["winBackOffer"] != null:
			if data["winBackOffer"] is Dictionary:
				var decoded_win_back_offer = WinBackOfferInputIOS.from_dict(data["winBackOffer"])
				if decoded_win_back_offer == null:
					push_error("Invalid input WinBackOfferInputIOS value for winBackOffer")
					return null
				obj.win_back_offer = decoded_win_back_offer
			else:
				push_error("Expected winBackOffer to be a WinBackOfferInputIOS dictionary")
				return null
		if data.has("promotionalOfferJWS") and data["promotionalOfferJWS"] != null:
			if data["promotionalOfferJWS"] is Dictionary:
				var decoded_promotional_offer_jws = PromotionalOfferJWSInputIOS.from_dict(data["promotionalOfferJWS"])
				if decoded_promotional_offer_jws == null:
					push_error("Invalid input PromotionalOfferJWSInputIOS value for promotionalOfferJWS")
					return null
				obj.promotional_offer_jws = decoded_promotional_offer_jws
			else:
				push_error("Expected promotionalOfferJWS to be a PromotionalOfferJWSInputIOS dictionary")
				return null
		if data.has("billingPlanType") and data["billingPlanType"] != null:
			var enum_str = data["billingPlanType"]
			if enum_str is String and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING.has(enum_str):
				obj.billing_plan_type = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(enum_str):
				obj.billing_plan_type = enum_str
			else:
				push_error("Invalid SubscriptionBillingPlanTypeIOS input value")
				return null
		if data.has("compactJWS") and data["compactJWS"] != null:
			obj.compact_jws = data["compactJWS"]
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
		if billing_plan_type != null:
			if SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES.has(billing_plan_type):
				dict["billingPlanType"] = SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES[billing_plan_type]
			else:
				dict["billingPlanType"] = billing_plan_type
		if compact_jws != null:
			dict["compactJWS"] = compact_jws
		if advanced_commerce_data != null:
			dict["advancedCommerceData"] = advanced_commerce_data
		return dict

## Platform-specific subscription request parameters. Note: "Platforms" refers to the SDK/OS level (apple, google), not the store. - apple: Always targets App Store - google: Targets Play Store by default, Horizon when built with horizon flavor, or Fire OS when built with amazon flavor (determined at build time, not runtime)
class RequestSubscriptionPropsByPlatforms:
	## Apple-specific subscription parameters
	var apple: RequestSubscriptionIosProps
	## Google-specific subscription parameters
	var google: RequestSubscriptionAndroidProps

	static func from_dict(data: Dictionary) -> RequestSubscriptionPropsByPlatforms:
		var obj = RequestSubscriptionPropsByPlatforms.new()
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				var decoded_apple = RequestSubscriptionIosProps.from_dict(data["apple"])
				if decoded_apple == null:
					push_error("Invalid input RequestSubscriptionIosProps value for apple")
					return null
				obj.apple = decoded_apple
			else:
				push_error("Expected apple to be a RequestSubscriptionIosProps dictionary")
				return null
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				var decoded_google = RequestSubscriptionAndroidProps.from_dict(data["google"])
				if decoded_google == null:
					push_error("Invalid input RequestSubscriptionAndroidProps value for google")
					return null
				obj.google = decoded_google
			else:
				push_error("Expected google to be a RequestSubscriptionAndroidProps dictionary")
				return null
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
		return dict

class RequestVerifyPurchaseWithIapkitAmazonProps:
	## Available in OpenIAP Spec 3.2.0 / openiap-apple 3.2.0 / openiap-google 3.3.0. Optional Amazon product id that must match the product id verified by RVS.
	var expected_product_id: Variant = null
	## Amazon Appstore user id returned by PurchaseResponse.getUserData().getUserId().
	var user_id: Variant = null
	## Amazon Appstore receipt id returned by PurchaseResponse.getReceipt().getReceiptId().
	var receipt_id: String = ""
	## Use Amazon RVS Cloud Sandbox for App Tester receipts.
	var sandbox: Variant = null

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitAmazonProps:
		if data.has("expectedProductId") and data["expectedProductId"] != null and not data["expectedProductId"] is String:
			push_error("Invalid RequestVerifyPurchaseWithIapkitAmazonProps.expectedProductId value")
			return null
		if data.has("userId") and data["userId"] != null and not data["userId"] is String:
			push_error("Invalid RequestVerifyPurchaseWithIapkitAmazonProps.userId value")
			return null
		if not data.has("receiptId") or not data["receiptId"] is String:
			push_error("Invalid required RequestVerifyPurchaseWithIapkitAmazonProps.receiptId value")
			return null
		if data.has("sandbox") and data["sandbox"] != null and not data["sandbox"] is bool:
			push_error("Invalid RequestVerifyPurchaseWithIapkitAmazonProps.sandbox value")
			return null
		var obj = RequestVerifyPurchaseWithIapkitAmazonProps.new()
		if data.has("expectedProductId") and data["expectedProductId"] != null:
			obj.expected_product_id = data["expectedProductId"]
		if data.has("userId") and data["userId"] != null:
			obj.user_id = data["userId"]
		if data.has("receiptId") and data["receiptId"] != null:
			obj.receipt_id = data["receiptId"]
		if data.has("sandbox") and data["sandbox"] != null:
			obj.sandbox = data["sandbox"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if expected_product_id != null:
			dict["expectedProductId"] = expected_product_id
		if user_id != null:
			dict["userId"] = user_id
		if receipt_id != null:
			dict["receiptId"] = receipt_id
		if sandbox != null:
			dict["sandbox"] = sandbox
		return dict

class RequestVerifyPurchaseWithIapkitAppleProps:
	## The JWS token returned with the purchase response.
	var jws: String = ""

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitAppleProps:
		if not data.has("jws") or not data["jws"] is String:
			push_error("Invalid required RequestVerifyPurchaseWithIapkitAppleProps.jws value")
			return null
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
	var purchase_token: String = ""

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitGoogleProps:
		if not data.has("purchaseToken") or not data["purchaseToken"] is String:
			push_error("Invalid required RequestVerifyPurchaseWithIapkitGoogleProps.purchaseToken value")
			return null
		var obj = RequestVerifyPurchaseWithIapkitGoogleProps.new()
		if data.has("purchaseToken") and data["purchaseToken"] != null:
			obj.purchase_token = data["purchaseToken"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if purchase_token != null:
			dict["purchaseToken"] = purchase_token
		return dict

## Platform-specific verification parameters for IAPKit. - apple: Verifies via App Store (JWS token) - google: Verifies via Play Store (purchase token) - amazon: Verifies via Amazon Appstore RVS (userId + receiptId)
class RequestVerifyPurchaseWithIapkitProps:
	## API key used for the Authorization header (Bearer {apiKey}).
	var api_key: Variant = null
	## Available in OpenIAP Spec 2.3.1 / openiap-apple 2.4.0 / openiap-google 2.4.0. Base URL for the IAPKit server. Defaults to https://kit.openiap.dev. Set this to a reachable HTTP(S) origin when self-hosting or testing a local IAPKit server. The apiKey must be issued by the same IAPKit/Convex deployment as this server.
	var base_url: Variant = null
	## Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1. Include the product's public IAPKit client payload in a valid Apple or Google verification response. Defaults to false so existing response shapes and bandwidth remain unchanged.
	var include_client_payload: Variant = null
	## Apple App Store verification parameters.
	var apple: RequestVerifyPurchaseWithIapkitAppleProps
	## Google Play Store verification parameters.
	var google: RequestVerifyPurchaseWithIapkitGoogleProps
	## Amazon Appstore verification parameters.
	var amazon: RequestVerifyPurchaseWithIapkitAmazonProps

	static func from_dict(data: Dictionary) -> RequestVerifyPurchaseWithIapkitProps:
		if data.has("apiKey") and data["apiKey"] != null and not data["apiKey"] is String:
			push_error("Invalid RequestVerifyPurchaseWithIapkitProps.apiKey value")
			return null
		if data.has("baseUrl") and data["baseUrl"] != null and not data["baseUrl"] is String:
			push_error("Invalid RequestVerifyPurchaseWithIapkitProps.baseUrl value")
			return null
		if data.has("includeClientPayload") and data["includeClientPayload"] != null and not data["includeClientPayload"] is bool:
			push_error("Invalid RequestVerifyPurchaseWithIapkitProps.includeClientPayload value")
			return null
		var obj = RequestVerifyPurchaseWithIapkitProps.new()
		if data.has("apiKey") and data["apiKey"] != null:
			obj.api_key = data["apiKey"]
		if data.has("baseUrl") and data["baseUrl"] != null:
			obj.base_url = data["baseUrl"]
		if data.has("includeClientPayload") and data["includeClientPayload"] != null:
			obj.include_client_payload = data["includeClientPayload"]
		if data.has("apple") and data["apple"] != null:
			if data["apple"] is Dictionary:
				var decoded_apple = RequestVerifyPurchaseWithIapkitAppleProps.from_dict(data["apple"])
				if decoded_apple == null:
					push_error("Invalid input RequestVerifyPurchaseWithIapkitAppleProps value for apple")
					return null
				obj.apple = decoded_apple
			else:
				push_error("Expected apple to be a RequestVerifyPurchaseWithIapkitAppleProps dictionary")
				return null
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				var decoded_google = RequestVerifyPurchaseWithIapkitGoogleProps.from_dict(data["google"])
				if decoded_google == null:
					push_error("Invalid input RequestVerifyPurchaseWithIapkitGoogleProps value for google")
					return null
				obj.google = decoded_google
			else:
				push_error("Expected google to be a RequestVerifyPurchaseWithIapkitGoogleProps dictionary")
				return null
		if data.has("amazon") and data["amazon"] != null:
			if data["amazon"] is Dictionary:
				var decoded_amazon = RequestVerifyPurchaseWithIapkitAmazonProps.from_dict(data["amazon"])
				if decoded_amazon == null:
					push_error("Invalid input RequestVerifyPurchaseWithIapkitAmazonProps value for amazon")
					return null
				obj.amazon = decoded_amazon
			else:
				push_error("Expected amazon to be a RequestVerifyPurchaseWithIapkitAmazonProps dictionary")
				return null
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if api_key != null:
			dict["apiKey"] = api_key
		if base_url != null:
			dict["baseUrl"] = base_url
		if include_client_payload != null:
			dict["includeClientPayload"] = include_client_payload
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
		if amazon != null:
			if amazon.has_method("to_dict"):
				dict["amazon"] = amazon.to_dict()
			else:
				dict["amazon"] = amazon
		return dict

## Product-level subscription replacement parameters (Android) Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams Available in Google Play Billing Library 8.1.0+
class SubscriptionProductReplacementParamsAndroid:
	## The old product ID that needs to be replaced
	var old_product_id: String = ""
	## The replacement mode for this product change
	var replacement_mode: SubscriptionReplacementModeAndroid = SubscriptionReplacementModeAndroid.UNKNOWN_REPLACEMENT_MODE

	static func from_dict(data: Dictionary) -> SubscriptionProductReplacementParamsAndroid:
		if not data.has("oldProductId") or not data["oldProductId"] is String:
			push_error("Invalid required SubscriptionProductReplacementParamsAndroid.oldProductId value")
			return null
		if not data.has("replacementMode") or not ((data["replacementMode"] is String and SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING.has(data["replacementMode"])) or (data["replacementMode"] is int and SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES.has(data["replacementMode"]))):
			push_error("Invalid required SubscriptionProductReplacementParamsAndroid.replacementMode value")
			return null
		var obj = SubscriptionProductReplacementParamsAndroid.new()
		if data.has("oldProductId") and data["oldProductId"] != null:
			obj.old_product_id = data["oldProductId"]
		if data.has("replacementMode") and data["replacementMode"] != null:
			var enum_str = data["replacementMode"]
			if enum_str is String and SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING.has(enum_str):
				obj.replacement_mode = SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_FROM_STRING[enum_str]
			elif enum_str is int and SUBSCRIPTION_REPLACEMENT_MODE_ANDROID_VALUES.has(enum_str):
				obj.replacement_mode = enum_str
			else:
				push_error("Invalid SubscriptionReplacementModeAndroid input value")
				return null
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
	var sku: String = ""

	static func from_dict(data: Dictionary) -> VerifyPurchaseAppleOptions:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required VerifyPurchaseAppleOptions.sku value")
			return null
		var obj = VerifyPurchaseAppleOptions.new()
		if data.has("sku") and data["sku"] != null:
			obj.sku = data["sku"]
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if sku != null:
			dict["sku"] = sku
		return dict

## Google Play Store verification parameters. Used for server-side receipt validation via Google Play Developer API. ⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.
class VerifyPurchaseGoogleOptions:
	## Product SKU to validate
	var sku: String = ""
	## Android package name (e.g., com.example.app)
	var package_name: String = ""
	## Purchase token from the purchase response. ⚠️ Sensitive: Do not log this value.
	var purchase_token: String = ""
	## Google OAuth2 access token for API authentication. ⚠️ Sensitive: Do not log this value.
	var access_token: String = ""
	## Whether this is a subscription purchase (affects API endpoint used)
	var is_sub: Variant = null

	static func from_dict(data: Dictionary) -> VerifyPurchaseGoogleOptions:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required VerifyPurchaseGoogleOptions.sku value")
			return null
		if not data.has("packageName") or not data["packageName"] is String:
			push_error("Invalid required VerifyPurchaseGoogleOptions.packageName value")
			return null
		if not data.has("purchaseToken") or not data["purchaseToken"] is String:
			push_error("Invalid required VerifyPurchaseGoogleOptions.purchaseToken value")
			return null
		if not data.has("accessToken") or not data["accessToken"] is String:
			push_error("Invalid required VerifyPurchaseGoogleOptions.accessToken value")
			return null
		if data.has("isSub") and data["isSub"] != null and not data["isSub"] is bool:
			push_error("Invalid VerifyPurchaseGoogleOptions.isSub value")
			return null
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

## Meta Horizon (Quest) verification parameters. Used for server-side entitlement verification via Meta's S2S API. POST https://graph.oculus.com/$APP_ID/verify_entitlement ⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.
class VerifyPurchaseHorizonOptions:
	## The SKU for the add-on item, defined in Meta Developer Dashboard
	var sku: String = ""
	## The user ID of the user whose purchase you want to verify
	var user_id: String = ""
	## Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token). ⚠️ Sensitive: Do not log this value.
	var access_token: String = ""

	static func from_dict(data: Dictionary) -> VerifyPurchaseHorizonOptions:
		if not data.has("sku") or not data["sku"] is String:
			push_error("Invalid required VerifyPurchaseHorizonOptions.sku value")
			return null
		if not data.has("userId") or not data["userId"] is String:
			push_error("Invalid required VerifyPurchaseHorizonOptions.userId value")
			return null
		if not data.has("accessToken") or not data["accessToken"] is String:
			push_error("Invalid required VerifyPurchaseHorizonOptions.accessToken value")
			return null
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

## Platform-specific purchase verification parameters. - apple: Verifies via App Store Server API - google: Verifies via Google Play Developer API - horizon: Verifies via Meta's S2S API (verify_entitlement endpoint)
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
				var decoded_apple = VerifyPurchaseAppleOptions.from_dict(data["apple"])
				if decoded_apple == null:
					push_error("Invalid input VerifyPurchaseAppleOptions value for apple")
					return null
				obj.apple = decoded_apple
			else:
				push_error("Expected apple to be a VerifyPurchaseAppleOptions dictionary")
				return null
		if data.has("google") and data["google"] != null:
			if data["google"] is Dictionary:
				var decoded_google = VerifyPurchaseGoogleOptions.from_dict(data["google"])
				if decoded_google == null:
					push_error("Invalid input VerifyPurchaseGoogleOptions value for google")
					return null
				obj.google = decoded_google
			else:
				push_error("Expected google to be a VerifyPurchaseGoogleOptions dictionary")
				return null
		if data.has("horizon") and data["horizon"] != null:
			if data["horizon"] is Dictionary:
				var decoded_horizon = VerifyPurchaseHorizonOptions.from_dict(data["horizon"])
				if decoded_horizon == null:
					push_error("Invalid input VerifyPurchaseHorizonOptions value for horizon")
					return null
				obj.horizon = decoded_horizon
			else:
				push_error("Expected horizon to be a VerifyPurchaseHorizonOptions dictionary")
				return null
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

	static func from_dict(data: Dictionary, report_errors: bool = true) -> VerifyPurchaseWithProviderProps:
		if not data.has("provider") or not ((data["provider"] is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(data["provider"])) or (data["provider"] is int and PURCHASE_VERIFICATION_PROVIDER_VALUES.has(data["provider"]))):
			if report_errors:
				push_error("Invalid VerifyPurchaseWithProviderProps.provider enum value")
			return null
		var obj = VerifyPurchaseWithProviderProps.new()
		if data.has("provider") and data["provider"] != null:
			var enum_str = data["provider"]
			if enum_str is String and PURCHASE_VERIFICATION_PROVIDER_FROM_STRING.has(enum_str):
				obj.provider = PURCHASE_VERIFICATION_PROVIDER_FROM_STRING[enum_str]
			elif enum_str is int and PURCHASE_VERIFICATION_PROVIDER_VALUES.has(enum_str):
				obj.provider = enum_str
			else:
				push_error("Invalid PurchaseVerificationProvider input value")
				return null
		if data.has("iapkit") and data["iapkit"] != null:
			if data["iapkit"] is Dictionary:
				var decoded_iapkit = RequestVerifyPurchaseWithIapkitProps.from_dict(data["iapkit"])
				if decoded_iapkit == null:
					push_error("Invalid input RequestVerifyPurchaseWithIapkitProps value for iapkit")
					return null
				obj.iapkit = decoded_iapkit
			else:
				push_error("Expected iapkit to be a RequestVerifyPurchaseWithIapkitProps dictionary")
				return null
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
	var offer_id: String = ""

	static func from_dict(data: Dictionary) -> WinBackOfferInputIOS:
		if not data.has("offerId") or not data["offerId"] is String:
			push_error("Invalid required WinBackOfferInputIOS.offerId value")
			return null
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

const BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_VALUES = {
	BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE: "rectangular-four-by-one",
	BillingChoiceImageLayoutAndroid.RECTANGULAR_THREE_BY_ONE: "rectangular-three-by-one",
	BillingChoiceImageLayoutAndroid.RECTANGULAR_TWO_BY_TWO: "rectangular-two-by-two"
}

const BILLING_CHOICE_SCREEN_TYPE_ANDROID_VALUES = {
	BillingChoiceScreenTypeAndroid.UNSPECIFIED: "unspecified",
	BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED: "developer-rendered",
	BillingChoiceScreenTypeAndroid.GOOGLE_RENDERED: "google-rendered"
}

const BILLING_PROGRAM_ANDROID_VALUES = {
	BillingProgramAndroid.UNSPECIFIED: "unspecified",
	BillingProgramAndroid.USER_CHOICE_BILLING: "user-choice-billing",
	BillingProgramAndroid.EXTERNAL_CONTENT_LINK: "external-content-link",
	BillingProgramAndroid.EXTERNAL_OFFER: "external-offer",
	BillingProgramAndroid.EXTERNAL_PAYMENTS: "external-payments",
	BillingProgramAndroid.BILLING_CHOICE: "billing-choice"
}

const DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_VALUES = {
	DeveloperBillingLaunchModeAndroid.UNSPECIFIED: "unspecified",
	DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP: "launch-in-external-browser-or-app",
	DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK: "caller-will-launch-link"
}

const DEVELOPER_BILLING_TYPE_ANDROID_VALUES = {
	DeveloperBillingTypeAndroid.DEVELOPER_BILLING_TYPE_UNSPECIFIED: "developer-billing-type-unspecified",
	DeveloperBillingTypeAndroid.IN_APP: "in-app",
	DeveloperBillingTypeAndroid.EXTERNAL_LINK: "external-link"
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
	ErrorCode.SERVICE_TIMEOUT: "service-timeout",
	ErrorCode.QUERY_PRODUCT: "query-product",
	ErrorCode.SKU_NOT_FOUND: "sku-not-found",
	ErrorCode.SKU_OFFER_MISMATCH: "sku-offer-mismatch",
	ErrorCode.ITEM_NOT_OWNED: "item-not-owned",
	ErrorCode.BILLING_UNAVAILABLE: "billing-unavailable",
	ErrorCode.FEATURE_NOT_SUPPORTED: "feature-not-supported",
	ErrorCode.EMPTY_SKU_LIST: "empty-sku-list",
	ErrorCode.DUPLICATE_PURCHASE: "duplicate-purchase"
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
	IapEvent.DEVELOPER_PROVIDED_BILLING_ANDROID: "developer-provided-billing-android",
	IapEvent.SUBSCRIPTION_BILLING_ISSUE: "subscription-billing-issue"
}

const IAPKIT_CLIENT_PAYLOAD_FORMAT_VALUES = {
	IapkitClientPayloadFormat.TOML: "toml",
	IapkitClientPayloadFormat.JSON: "json",
	IapkitClientPayloadFormat.TEXT: "text"
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
	IapStore.HORIZON: "horizon",
	IapStore.AMAZON: "amazon"
}

const IN_APP_MESSAGE_CATEGORY_ANDROID_VALUES = {
	InAppMessageCategoryAndroid.UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID: "unknown-in-app-message-category-id",
	InAppMessageCategoryAndroid.TRANSACTIONAL: "transactional"
}

const IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_VALUES = {
	InAppMessageResponseCodeAndroid.NO_ACTION_NEEDED: "no-action-needed",
	InAppMessageResponseCodeAndroid.SUBSCRIPTION_STATUS_UPDATED: "subscription-status-updated"
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
	ProductTypeIOS.NON_RENEWING_SUBSCRIPTION: "non-renewing-subscription",
	ProductTypeIOS.SUBSCRIPTION_BUNDLE: "subscription-bundle",
	ProductTypeIOS.SUBSCRIPTION_SUITE: "subscription-suite"
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

const SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_VALUES = {
	SubscriptionBillingPlanTypeIOS.UNKNOWN: "unknown",
	SubscriptionBillingPlanTypeIOS.MONTHLY: "monthly",
	SubscriptionBillingPlanTypeIOS.UP_FRONT: "up-front"
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

const BILLING_CHOICE_IMAGE_LAYOUT_ANDROID_FROM_STRING = {
	"rectangular-four-by-one": BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE,
	"rectangular-three-by-one": BillingChoiceImageLayoutAndroid.RECTANGULAR_THREE_BY_ONE,
	"rectangular-two-by-two": BillingChoiceImageLayoutAndroid.RECTANGULAR_TWO_BY_TWO
}

const BILLING_CHOICE_SCREEN_TYPE_ANDROID_FROM_STRING = {
	"unspecified": BillingChoiceScreenTypeAndroid.UNSPECIFIED,
	"developer-rendered": BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED,
	"google-rendered": BillingChoiceScreenTypeAndroid.GOOGLE_RENDERED
}

const BILLING_PROGRAM_ANDROID_FROM_STRING = {
	"unspecified": BillingProgramAndroid.UNSPECIFIED,
	"user-choice-billing": BillingProgramAndroid.USER_CHOICE_BILLING,
	"external-content-link": BillingProgramAndroid.EXTERNAL_CONTENT_LINK,
	"external-offer": BillingProgramAndroid.EXTERNAL_OFFER,
	"external-payments": BillingProgramAndroid.EXTERNAL_PAYMENTS,
	"billing-choice": BillingProgramAndroid.BILLING_CHOICE
}

const DEVELOPER_BILLING_LAUNCH_MODE_ANDROID_FROM_STRING = {
	"unspecified": DeveloperBillingLaunchModeAndroid.UNSPECIFIED,
	"launch-in-external-browser-or-app": DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP,
	"caller-will-launch-link": DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK
}

const DEVELOPER_BILLING_TYPE_ANDROID_FROM_STRING = {
	"developer-billing-type-unspecified": DeveloperBillingTypeAndroid.DEVELOPER_BILLING_TYPE_UNSPECIFIED,
	"in-app": DeveloperBillingTypeAndroid.IN_APP,
	"external-link": DeveloperBillingTypeAndroid.EXTERNAL_LINK
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
	"service-timeout": ErrorCode.SERVICE_TIMEOUT,
	"query-product": ErrorCode.QUERY_PRODUCT,
	"sku-not-found": ErrorCode.SKU_NOT_FOUND,
	"sku-offer-mismatch": ErrorCode.SKU_OFFER_MISMATCH,
	"item-not-owned": ErrorCode.ITEM_NOT_OWNED,
	"billing-unavailable": ErrorCode.BILLING_UNAVAILABLE,
	"feature-not-supported": ErrorCode.FEATURE_NOT_SUPPORTED,
	"empty-sku-list": ErrorCode.EMPTY_SKU_LIST,
	"duplicate-purchase": ErrorCode.DUPLICATE_PURCHASE
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
	"developer-provided-billing-android": IapEvent.DEVELOPER_PROVIDED_BILLING_ANDROID,
	"subscription-billing-issue": IapEvent.SUBSCRIPTION_BILLING_ISSUE
}

const IAPKIT_CLIENT_PAYLOAD_FORMAT_FROM_STRING = {
	"toml": IapkitClientPayloadFormat.TOML,
	"json": IapkitClientPayloadFormat.JSON,
	"text": IapkitClientPayloadFormat.TEXT
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
	"horizon": IapStore.HORIZON,
	"amazon": IapStore.AMAZON
}

const IN_APP_MESSAGE_CATEGORY_ANDROID_FROM_STRING = {
	"unknown-in-app-message-category-id": InAppMessageCategoryAndroid.UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID,
	"transactional": InAppMessageCategoryAndroid.TRANSACTIONAL
}

const IN_APP_MESSAGE_RESPONSE_CODE_ANDROID_FROM_STRING = {
	"no-action-needed": InAppMessageResponseCodeAndroid.NO_ACTION_NEEDED,
	"subscription-status-updated": InAppMessageResponseCodeAndroid.SUBSCRIPTION_STATUS_UPDATED
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
	"non-renewing-subscription": ProductTypeIOS.NON_RENEWING_SUBSCRIPTION,
	"subscription-bundle": ProductTypeIOS.SUBSCRIPTION_BUNDLE,
	"subscription-suite": ProductTypeIOS.SUBSCRIPTION_SUITE
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

const SUBSCRIPTION_BILLING_PLAN_TYPE_IOS_FROM_STRING = {
	"unknown": SubscriptionBillingPlanTypeIOS.UNKNOWN,
	"monthly": SubscriptionBillingPlanTypeIOS.MONTHLY,
	"up-front": SubscriptionBillingPlanTypeIOS.UP_FRONT
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

	## Fetch products or subscriptions from the store. See: https://openiap.dev/docs/apis/fetch-products
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

	## List active purchases for the current user. See: https://openiap.dev/docs/apis/get-available-purchases
	class getAvailablePurchasesField:
		const name = "getAvailablePurchases"
		const snake_name = "get_available_purchases"
		class Args:
			var options: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if options != null:
					dict["options"] = options
				return dict
		const return_type = "Purchase"
		const is_array = true

	## Get details of all currently active subscriptions (filters by subscriptionIds when provided). See: https://openiap.dev/docs/apis/get-active-subscriptions
	class getActiveSubscriptionsField:
		const name = "getActiveSubscriptions"
		const snake_name = "get_active_subscriptions"
		class Args:
			var subscription_ids: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("subscriptionIds") and data["subscriptionIds"] != null:
					if data["subscriptionIds"] is Array:
						var arr: Array[String] = []
						for item in data["subscriptionIds"]:
							if item is String:
								arr.append(str(item))
							else:
								push_error("Invalid String list value for subscriptionIds")
								return null
						obj.subscription_ids = arr
					else:
						push_error("Invalid input list for subscriptionIds")
						return null
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if subscription_ids != null:
					dict["subscriptionIds"] = subscription_ids
				return dict
		const return_type = "ActiveSubscription"
		const is_array = true

	## Check whether the user has any active subscription. See: https://openiap.dev/docs/apis/has-active-subscriptions
	class hasActiveSubscriptionsField:
		const name = "hasActiveSubscriptions"
		const snake_name = "has_active_subscriptions"
		class Args:
			var subscription_ids: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("subscriptionIds") and data["subscriptionIds"] != null:
					if data["subscriptionIds"] is Array:
						var arr: Array[String] = []
						for item in data["subscriptionIds"]:
							if item is String:
								arr.append(str(item))
							else:
								push_error("Invalid String list value for subscriptionIds")
								return null
						obj.subscription_ids = arr
					else:
						push_error("Invalid input list for subscriptionIds")
						return null
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if subscription_ids != null:
					dict["subscriptionIds"] = subscription_ids
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple platforms and alpha-2 on Android. The operation fails when the store cannot provide a value; implementations must not synthesize a locale fallback. See: https://openiap.dev/docs/apis/get-storefront
	class getStorefrontField:
		const name = "getStorefront"
		const snake_name = "get_storefront"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Read the App Store-promoted product, if any (iOS 15+). OpenIAP consumes PurchaseIntent.intents on iOS 16.4+ and uses the StoreKit 1 observer only on iOS 15–16.3. When PurchaseIntent carries an externally redeemed win-back offer, OpenIAP preserves it for the next matching requestPurchase unless the caller supplies an explicit win-back or promotional offer. See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
	class getPromotedProductIOSField:
		const name = "getPromotedProductIOS"
		const snake_name = "get_promoted_product_ios"
		class Args:
			pass
		const return_type = "ProductIOS"
		const is_array = false

	## Check eligibility for the external purchase notice sheet (iOS 17.4+). Uses ExternalPurchase.canPresent. See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
	class canPresentExternalPurchaseNoticeIOSField:
		const name = "canPresentExternalPurchaseNoticeIOS"
		const snake_name = "can_present_external_purchase_notice_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Check eligibility for the custom-link variant of external purchase (iOS 18.1+). Returns true if the app can use custom external purchase links. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
	class isEligibleForExternalPurchaseCustomLinkIOSField:
		const name = "isEligibleForExternalPurchaseCustomLinkIOS"
		const snake_name = "is_eligible_for_external_purchase_custom_link_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+). Use this token to report transactions made through ExternalPurchaseCustomLink. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:) See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
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
					elif enum_str is int and EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES.has(enum_str):
						obj.token_type = enum_str
					else:
						push_error("Invalid ExternalPurchaseCustomLinkTokenTypeIOS input value")
						return null
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

	## List unfinished StoreKit transactions in the queue. See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
	class getPendingTransactionsIOSField:
		const name = "getPendingTransactionsIOS"
		const snake_name = "get_pending_transactions_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = true

	## Check intro-offer eligibility for a subscription group. See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
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

	## Get subscription status objects from StoreKit 2 (iOS 15+). See: https://openiap.dev/docs/apis/ios/subscription-status-ios
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

	## Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+). See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
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

	## Get the latest verified transaction for a product, using StoreKit 2. See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
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

	## Check whether a transaction's JWS verification passed (StoreKit 2). See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
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

	## Return the JWS string for a transaction (StoreKit 2). See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
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

	## Get base64-encoded receipt data (legacy validation). See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
	class getReceiptDataIOSField:
		const name = "getReceiptDataIOS"
		const snake_name = "get_receipt_data_ios"
		class Args:
			pass
		const return_type = "String"
		const is_array = false

	## Fetch the app transaction (iOS 16+). See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
	class getAppTransactionIOSField:
		const name = "getAppTransactionIOS"
		const snake_name = "get_app_transaction_ios"
		class Args:
			pass
		const return_type = "AppTransaction"
		const is_array = false

	## List every StoreKit transaction (finished + unfinished) for the current user. Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app for finished consumables to be included (iOS 18+). Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape. See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
	class getAllTransactionsIOSField:
		const name = "getAllTransactionsIOS"
		const snake_name = "get_all_transactions_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = true

	## Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client is not ready. See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
	class getBillingChoiceInfoAndroidField:
		const name = "getBillingChoiceInfoAndroid"
		const snake_name = "get_billing_choice_info_android"
		class Args:
			var params: GetBillingChoiceInfoParamsAndroid

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["params"] = params
				return dict
		const return_type = "BillingChoiceInfoAndroid"
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

	## Initialize the store connection. Call before any IAP API. See: https://openiap.dev/docs/apis/init-connection
	class initConnectionField:
		const name = "initConnection"
		const snake_name = "init_connection"
		class Args:
			var config: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("config") and data["config"] != null:
					obj.config = data["config"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if config != null:
					dict["config"] = config
				return dict
		const return_type = "Boolean"
		const is_array = false

	## Close the store connection and release resources. See: https://openiap.dev/docs/apis/end-connection
	class endConnectionField:
		const name = "endConnection"
		const snake_name = "end_connection"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Initiate a purchase or subscription flow; rely on events for final state. See: https://openiap.dev/docs/apis/request-purchase
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

	## Complete a transaction after server-side verification. Required on Android within 3 days. See: https://openiap.dev/docs/apis/finish-transaction
	class finishTransactionField:
		const name = "finishTransaction"
		const snake_name = "finish_transaction"
		class Args:
			var purchase: PurchaseInput
			var is_consumable: Variant = null

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
				if is_consumable != null:
					dict["isConsumable"] = is_consumable
				return dict
		const return_type = "VoidResult"
		const is_array = false

	## Restore non-consumable and active subscription purchases. See: https://openiap.dev/docs/apis/restore-purchases
	class restorePurchasesField:
		const name = "restorePurchases"
		const snake_name = "restore_purchases"
		class Args:
			pass
		const return_type = "VoidResult"
		const is_array = false

	## Open the platform's subscription management UI. See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
	class deepLinkToSubscriptionsField:
		const name = "deepLinkToSubscriptions"
		const snake_name = "deep_link_to_subscriptions"
		class Args:
			var options: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("options") and data["options"] != null:
					obj.options = data["options"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if options != null:
					dict["options"] = options
				return dict
		const return_type = "VoidResult"
		const is_array = false

	## Verify a purchase against your own backend. Every VerifyPurchaseResult variant exposes isValid, so entitlement can be gated without inspecting the concrete type. Variants add their own metadata on top: IOS carries receipt/JWS fields, Android carries Play Store receipt fields, and Horizon carries grantTime. See: https://openiap.dev/docs/features/validation#verify-purchase
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

	## Verify via a managed provider without standing up your own server. The PurchaseVerificationProvider enum currently exposes only IAPKit; platform availability may differ by implementation. See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
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

	## Clear pending transactions in the queue (sandbox helper). See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
	class clearTransactionIOSField:
		const name = "clearTransactionIOS"
		const snake_name = "clear_transaction_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Present the manage-subscriptions sheet and return changed purchases (iOS 15+). See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
	class showManageSubscriptionsIOSField:
		const name = "showManageSubscriptionsIOS"
		const snake_name = "show_manage_subscriptions_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = true

	## Present the refund request sheet (iOS 15+). See also Features → Refund. See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
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

	## Force sync transactions with the App Store (iOS 15+). See: https://openiap.dev/docs/apis/ios/sync-ios
	class syncIOSField:
		const name = "syncIOS"
		const snake_name = "sync_ios"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Show the App Store offer code redemption sheet. When built with Xcode 27+ and running on iOS 27+, Mac Catalyst 27+, or visionOS 27+, returns the verified transaction produced by the redemption. StoreKit 2's scene-based sheet returns null after presentation on iOS 16–26, visionOS 1–26, and those platforms on Apple 27 when built with an older SDK. iOS 15 uses the StoreKit 1 sheet and also returns null. On Mac Catalyst, the scene-based API throws StoreKitError.unknown, while the Catalyst 15 StoreKit 1 call has no effect and returns null. Reconcile null results from a presented sheet through the normal transaction listener or an explicit available-purchases refresh. See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
	class presentCodeRedemptionSheetIOSField:
		const name = "presentCodeRedemptionSheetIOS"
		const snake_name = "present_code_redemption_sheet_ios"
		class Args:
			pass
		const return_type = "PurchaseIOS"
		const is_array = false

	## Present the external purchase notice sheet (iOS 17.4+). Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues. Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet() See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
	class presentExternalPurchaseNoticeSheetIOSField:
		const name = "presentExternalPurchaseNoticeSheetIOS"
		const snake_name = "present_external_purchase_notice_sheet_ios"
		class Args:
			pass
		const return_type = "ExternalPurchaseNoticeResultIOS"
		const is_array = false

	## Present an external purchase link, StoreKit External (iOS 16+). See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
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

	## Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+). Call this after a deliberate customer interaction before linking out to external purchases. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:) See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
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
					elif enum_str is int and EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES.has(enum_str):
						obj.notice_type = enum_str
					else:
						push_error("Invalid ExternalPurchaseCustomLinkNoticeTypeIOS input value")
						return null
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

	## Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds. See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
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

	## Consume a consumable purchase so it can be re-bought. See: https://openiap.dev/docs/apis/android/consume-purchase-android
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

	## Check whether a billing program (e.g., External Payments) is available for the current user. Replaces the deprecated isExternalOfferAvailableAsync API. Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API. Returns availability result with isAvailable flag. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
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
					elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
						obj.program = enum_str
					else:
						push_error("Invalid BillingProgramAndroid input value")
						return null
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

	## Create the reporting details and external transaction token required by a billing program. Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations must use 8.2.1+ and create fresh details immediately before every redirect session; do not cache the token for a later redirect. The same token may report multiple purchases made during one External Offer session. Replaces the deprecated createExternalOfferReportingDetailsAsync API. Returns external transaction token needed for reporting external transactions. developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted, native Android defaults it to IN_APP. The Billing Choice extension is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
	class createBillingProgramReportingDetailsAndroidField:
		const name = "createBillingProgramReportingDetailsAndroid"
		const snake_name = "create_billing_program_reporting_details_android"
		class Args:
			var program: BillingProgramAndroid
			var developer_billing_type: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("program") and data["program"] != null:
					var enum_str = data["program"]
					if enum_str is String and BILLING_PROGRAM_ANDROID_FROM_STRING.has(enum_str):
						obj.program = BILLING_PROGRAM_ANDROID_FROM_STRING[enum_str]
					elif enum_str is int and BILLING_PROGRAM_ANDROID_VALUES.has(enum_str):
						obj.program = enum_str
					else:
						push_error("Invalid BillingProgramAndroid input value")
						return null
				if data.has("developerBillingType") and data["developerBillingType"] != null:
					var enum_str = data["developerBillingType"]
					if enum_str is String and DEVELOPER_BILLING_TYPE_ANDROID_FROM_STRING.has(enum_str):
						obj.developer_billing_type = DEVELOPER_BILLING_TYPE_ANDROID_FROM_STRING[enum_str]
					elif enum_str is int and DEVELOPER_BILLING_TYPE_ANDROID_VALUES.has(enum_str):
						obj.developer_billing_type = enum_str
					else:
						push_error("Invalid DeveloperBillingTypeAndroid input value")
						return null
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if BILLING_PROGRAM_ANDROID_VALUES.has(program):
					dict["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]
				else:
					dict["program"] = program
				if developer_billing_type != null:
					if DEVELOPER_BILLING_TYPE_ANDROID_VALUES.has(developer_billing_type):
						dict["developerBillingType"] = DEVELOPER_BILLING_TYPE_ANDROID_VALUES[developer_billing_type]
					else:
						dict["developerBillingType"] = developer_billing_type
				return dict
		const return_type = "BillingProgramReportingDetailsAndroid"
		const is_array = false

	## Launch an external content/offer link from inside the Billing Programs flow (introduced in Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+), including developer-rendered Billing Choice external-link flows. Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Replaces the deprecated showExternalOfferInformationDialog API. Shows Play Store dialog and optionally launches external URL. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/launch-external-link-android
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

	## Open the Google Play offer/promo code redemption flow so the user can enter a code. On Google Play builds, launches the Play Store redeem page (https://play.google.com/redeem). A purchase listener can receive the redeemed purchase while the app is running with an active billing connection; always reconcile with getAvailablePurchases when the app resumes. Does not require the billing client to be initialized (no Play Billing version requirement). Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0. Android counterpart of presentCodeRedemptionSheetIOS. Returns true when the redemption flow was launched, or false when the current store flavor does not provide an equivalent redemption flow. See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
	class openRedeemOfferCodeAndroidField:
		const name = "openRedeemOfferCodeAndroid"
		const snake_name = "open_redeem_offer_code_android"
		class Args:
			pass
		const return_type = "Boolean"
		const is_array = false

	## Show Google's mandatory information dialog before a developer-rendered, in-app Billing Choice screen. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
	class showBillingProgramInformationDialogAndroidField:
		const name = "showBillingProgramInformationDialogAndroid"
		const snake_name = "show_billing_program_information_dialog_android"
		class Args:
			var params: BillingProgramInformationDialogParamsAndroid

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				dict["params"] = params
				return dict
		const return_type = "BillingResultAndroid"
		const is_array = false

	## Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0). Returns a response code and, when the subscription status changes, the related purchase token. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
	class showInAppMessagesAndroidField:
		const name = "showInAppMessagesAndroid"
		const snake_name = "show_in_app_messages_android"
		class Args:
			var params: Variant = null

			static func from_dict(data: Dictionary) -> Args:
				var obj = Args.new()
				if data.has("params") and data["params"] != null:
					obj.params = data["params"]
				return obj

			func to_dict() -> Dictionary:
				var dict = {}
				if params != null:
					dict["params"] = params
				return dict
		const return_type = "InAppMessageResultAndroid"
		const is_array = false


# ============================================================================
# API Wrapper Functions
# These typed functions can be used by godot-iap wrapper
# ============================================================================

# Query API helpers

## Fetch products or subscriptions from the store. See: https://openiap.dev/docs/apis/fetch-products
static func fetch_products_args(params: ProductRequest) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## List active purchases for the current user. See: https://openiap.dev/docs/apis/get-available-purchases
static func get_available_purchases_args(options: Variant = null) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Get details of all currently active subscriptions (filters by subscriptionIds when provided). See: https://openiap.dev/docs/apis/get-active-subscriptions
static func get_active_subscriptions_args(subscription_ids: Variant = null) -> Dictionary:
	var args = {}
	if subscription_ids != null:
		args["subscriptionIds"] = subscription_ids
	return args

## Check whether the user has any active subscription. See: https://openiap.dev/docs/apis/has-active-subscriptions
static func has_active_subscriptions_args(subscription_ids: Variant = null) -> Dictionary:
	var args = {}
	if subscription_ids != null:
		args["subscriptionIds"] = subscription_ids
	return args

## Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple platforms and alpha-2 on Android. The operation fails when the store cannot provide a value; implementations must not synthesize a locale fallback. See: https://openiap.dev/docs/apis/get-storefront
static func get_storefront_args() -> Dictionary:
	return {}

## Read the App Store-promoted product, if any (iOS 15+). OpenIAP consumes PurchaseIntent.intents on iOS 16.4+ and uses the StoreKit 1 observer only on iOS 15–16.3. When PurchaseIntent carries an externally redeemed win-back offer, OpenIAP preserves it for the next matching requestPurchase unless the caller supplies an explicit win-back or promotional offer. See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
static func get_promoted_product_ios_args() -> Dictionary:
	return {}

## Check eligibility for the external purchase notice sheet (iOS 17.4+). Uses ExternalPurchase.canPresent. See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
static func can_present_external_purchase_notice_ios_args() -> Dictionary:
	return {}

## Check eligibility for the custom-link variant of external purchase (iOS 18.1+). Returns true if the app can use custom external purchase links. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
static func is_eligible_for_external_purchase_custom_link_ios_args() -> Dictionary:
	return {}

## Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+). Use this token to report transactions made through ExternalPurchaseCustomLink. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:) See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
static func get_external_purchase_custom_link_token_ios_args(token_type: ExternalPurchaseCustomLinkTokenTypeIOS) -> Dictionary:
	var args = {}
	if EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES.has(token_type):
		args["tokenType"] = EXTERNAL_PURCHASE_CUSTOM_LINK_TOKEN_TYPE_IOS_VALUES[token_type]
	else:
		args["tokenType"] = token_type
	return args

## List unfinished StoreKit transactions in the queue. See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
static func get_pending_transactions_ios_args() -> Dictionary:
	return {}

## Check intro-offer eligibility for a subscription group. See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
static func is_eligible_for_intro_offer_ios_args(group_id: String) -> Dictionary:
	var args = {}
	args["groupID"] = group_id
	return args

## Get subscription status objects from StoreKit 2 (iOS 15+). See: https://openiap.dev/docs/apis/ios/subscription-status-ios
static func subscription_status_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+). See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
static func current_entitlement_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get the latest verified transaction for a product, using StoreKit 2. See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
static func latest_transaction_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Check whether a transaction's JWS verification passed (StoreKit 2). See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
static func is_transaction_verified_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Return the JWS string for a transaction (StoreKit 2). See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
static func get_transaction_jws_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Get base64-encoded receipt data (legacy validation). See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
static func get_receipt_data_ios_args() -> Dictionary:
	return {}

## Fetch the app transaction (iOS 16+). See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
static func get_app_transaction_ios_args() -> Dictionary:
	return {}

## List every StoreKit transaction (finished + unfinished) for the current user. Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app for finished consumables to be included (iOS 18+). Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape. See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
static func get_all_transactions_ios_args() -> Dictionary:
	return {}

## Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client is not ready. See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
static func get_billing_choice_info_android_args(params: GetBillingChoiceInfoParamsAndroid) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

# Mutation API helpers

## Initialize the store connection. Call before any IAP API. See: https://openiap.dev/docs/apis/init-connection
static func init_connection_args(config: Variant = null) -> Dictionary:
	var args = {}
	if config != null:
		if config.has_method("to_dict"):
			args["config"] = config.to_dict()
		else:
			args["config"] = config
	return args

## Close the store connection and release resources. See: https://openiap.dev/docs/apis/end-connection
static func end_connection_args() -> Dictionary:
	return {}

## Initiate a purchase or subscription flow; rely on events for final state. See: https://openiap.dev/docs/apis/request-purchase
static func request_purchase_args(params: RequestPurchaseProps) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## Complete a transaction after server-side verification. Required on Android within 3 days. See: https://openiap.dev/docs/apis/finish-transaction
static func finish_transaction_args(purchase: PurchaseInput, is_consumable: Variant = null) -> Dictionary:
	var args = {}
	if purchase != null:
		if purchase.has_method("to_dict"):
			args["purchase"] = purchase.to_dict()
		else:
			args["purchase"] = purchase
	if is_consumable != null:
		args["isConsumable"] = is_consumable
	return args

## Restore non-consumable and active subscription purchases. See: https://openiap.dev/docs/apis/restore-purchases
static func restore_purchases_args() -> Dictionary:
	return {}

## Open the platform's subscription management UI. See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
static func deep_link_to_subscriptions_args(options: Variant = null) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Verify a purchase against your own backend. Every VerifyPurchaseResult variant exposes isValid, so entitlement can be gated without inspecting the concrete type. Variants add their own metadata on top: IOS carries receipt/JWS fields, Android carries Play Store receipt fields, and Horizon carries grantTime. See: https://openiap.dev/docs/features/validation#verify-purchase
static func verify_purchase_args(options: VerifyPurchaseProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Verify via a managed provider without standing up your own server. The PurchaseVerificationProvider enum currently exposes only IAPKit; platform availability may differ by implementation. See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
static func verify_purchase_with_provider_args(options: VerifyPurchaseWithProviderProps) -> Dictionary:
	var args = {}
	if options != null:
		if options.has_method("to_dict"):
			args["options"] = options.to_dict()
		else:
			args["options"] = options
	return args

## Clear pending transactions in the queue (sandbox helper). See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
static func clear_transaction_ios_args() -> Dictionary:
	return {}

## Present the manage-subscriptions sheet and return changed purchases (iOS 15+). See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
static func show_manage_subscriptions_ios_args() -> Dictionary:
	return {}

## Present the refund request sheet (iOS 15+). See also Features → Refund. See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
static func begin_refund_request_ios_args(sku: String) -> Dictionary:
	var args = {}
	args["sku"] = sku
	return args

## Force sync transactions with the App Store (iOS 15+). See: https://openiap.dev/docs/apis/ios/sync-ios
static func sync_ios_args() -> Dictionary:
	return {}

## Show the App Store offer code redemption sheet. When built with Xcode 27+ and running on iOS 27+, Mac Catalyst 27+, or visionOS 27+, returns the verified transaction produced by the redemption. StoreKit 2's scene-based sheet returns null after presentation on iOS 16–26, visionOS 1–26, and those platforms on Apple 27 when built with an older SDK. iOS 15 uses the StoreKit 1 sheet and also returns null. On Mac Catalyst, the scene-based API throws StoreKitError.unknown, while the Catalyst 15 StoreKit 1 call has no effect and returns null. Reconcile null results from a presented sheet through the normal transaction listener or an explicit available-purchases refresh. See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
static func present_code_redemption_sheet_ios_args() -> Dictionary:
	return {}

## Present the external purchase notice sheet (iOS 17.4+). Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues. Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet() See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
static func present_external_purchase_notice_sheet_ios_args() -> Dictionary:
	return {}

## Present an external purchase link, StoreKit External (iOS 16+). See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
static func present_external_purchase_link_ios_args(url: String) -> Dictionary:
	var args = {}
	args["url"] = url
	return args

## Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+). Call this after a deliberate customer interaction before linking out to external purchases. Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:) See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
static func show_external_purchase_custom_link_notice_ios_args(notice_type: ExternalPurchaseCustomLinkNoticeTypeIOS) -> Dictionary:
	var args = {}
	if EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES.has(notice_type):
		args["noticeType"] = EXTERNAL_PURCHASE_CUSTOM_LINK_NOTICE_TYPE_IOS_VALUES[notice_type]
	else:
		args["noticeType"] = notice_type
	return args

## Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds. See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
static func acknowledge_purchase_android_args(purchase_token: String) -> Dictionary:
	var args = {}
	args["purchaseToken"] = purchase_token
	return args

## Consume a consumable purchase so it can be re-bought. See: https://openiap.dev/docs/apis/android/consume-purchase-android
static func consume_purchase_android_args(purchase_token: String) -> Dictionary:
	var args = {}
	args["purchaseToken"] = purchase_token
	return args

## Check whether a billing program (e.g., External Payments) is available for the current user. Replaces the deprecated isExternalOfferAvailableAsync API. Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API. Returns availability result with isAvailable flag. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
static func is_billing_program_available_android_args(program: BillingProgramAndroid) -> Dictionary:
	var args = {}
	if BILLING_PROGRAM_ANDROID_VALUES.has(program):
		args["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]
	else:
		args["program"] = program
	return args

## Create the reporting details and external transaction token required by a billing program. Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations must use 8.2.1+ and create fresh details immediately before every redirect session; do not cache the token for a later redirect. The same token may report multiple purchases made during one External Offer session. Replaces the deprecated createExternalOfferReportingDetailsAsync API. Returns external transaction token needed for reporting external transactions. developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted, native Android defaults it to IN_APP. The Billing Choice extension is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
static func create_billing_program_reporting_details_android_args(program: BillingProgramAndroid, developer_billing_type: Variant = null) -> Dictionary:
	var args = {}
	if BILLING_PROGRAM_ANDROID_VALUES.has(program):
		args["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]
	else:
		args["program"] = program
	if developer_billing_type != null:
		if DEVELOPER_BILLING_TYPE_ANDROID_VALUES.has(developer_billing_type):
			args["developerBillingType"] = DEVELOPER_BILLING_TYPE_ANDROID_VALUES[developer_billing_type]
		else:
			args["developerBillingType"] = developer_billing_type
	return args

## Launch an external content/offer link from inside the Billing Programs flow (introduced in Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+), including developer-rendered Billing Choice external-link flows. Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Replaces the deprecated showExternalOfferInformationDialog API. Shows Play Store dialog and optionally launches external URL. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/launch-external-link-android
static func launch_external_link_android_args(params: LaunchExternalLinkParamsAndroid) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## Open the Google Play offer/promo code redemption flow so the user can enter a code. On Google Play builds, launches the Play Store redeem page (https://play.google.com/redeem). A purchase listener can receive the redeemed purchase while the app is running with an active billing connection; always reconcile with getAvailablePurchases when the app resumes. Does not require the billing client to be initialized (no Play Billing version requirement). Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0. Android counterpart of presentCodeRedemptionSheetIOS. Returns true when the redemption flow was launched, or false when the current store flavor does not provide an equivalent redemption flow. See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
static func open_redeem_offer_code_android_args() -> Dictionary:
	return {}

## Show Google's mandatory information dialog before a developer-rendered, in-app Billing Choice screen. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+). Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
static func show_billing_program_information_dialog_android_args(params: BillingProgramInformationDialogParamsAndroid) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args

## Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations. OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (upstream API available since Play Billing 4.1.0). Returns a response code and, when the subscription status changes, the related purchase token. Throws OpenIapError.NotPrepared if billing client not ready. See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
static func show_in_app_messages_android_args(params: Variant = null) -> Dictionary:
	var args = {}
	if params != null:
		if params.has_method("to_dict"):
			args["params"] = params.to_dict()
		else:
			args["params"] = params
	return args
