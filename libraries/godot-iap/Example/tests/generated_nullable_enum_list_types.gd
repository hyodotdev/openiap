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

enum TestStatus {
	UNKNOWN = 0,
	ACTIVE = 1,
}

enum StrictStatus {
	ACTIVE = 0,
}

# ============================================================================
# Types
# ============================================================================

class EnumListHolder:
	## Status values from the schema. Preserves every documentation line. @see https://openiap.dev/docs/types
	var statuses: Array[TestStatus] = []
	var strict_statuses: Array[StrictStatus] = []
	var nullable_strict_statuses: Array[Variant] = []
	var nullable_labels: Array[Variant] = []

	static func from_dict(data: Dictionary, report_errors: bool = true) -> EnumListHolder:
		var obj = EnumListHolder.new()
		if data.has("statuses") and data["statuses"] != null:
			if data["statuses"] is Array:
				var arr: Array[TestStatus] = []
				for item in data["statuses"]:
					if item is String and TEST_STATUS_FROM_STRING.has(item):
						arr.append(TEST_STATUS_FROM_STRING[item])
					elif item is int and TEST_STATUS_VALUES.has(item):
						arr.append(item)
					else:
						arr.append(TestStatus.UNKNOWN)
				obj.statuses = arr
		if data.has("strictStatuses") and data["strictStatuses"] != null:
			if data["strictStatuses"] is Array:
				var arr: Array[StrictStatus] = []
				for item in data["strictStatuses"]:
					if item is String and STRICT_STATUS_FROM_STRING.has(item):
						arr.append(STRICT_STATUS_FROM_STRING[item])
					elif item is int and STRICT_STATUS_VALUES.has(item):
						arr.append(item)
					else:
						if report_errors:
							push_error("Invalid StrictStatus list value for strictStatuses")
						return null
				obj.strict_statuses = arr
		if data.has("nullableStrictStatuses") and data["nullableStrictStatuses"] != null:
			if data["nullableStrictStatuses"] is Array:
				var arr: Array[Variant] = []
				for item in data["nullableStrictStatuses"]:
					if item == null:
						arr.append(null)
					elif item is String and STRICT_STATUS_FROM_STRING.has(item):
						arr.append(STRICT_STATUS_FROM_STRING[item])
					elif item is int and STRICT_STATUS_VALUES.has(item):
						arr.append(item)
					else:
						arr.append(null)
				obj.nullable_strict_statuses = arr
		if data.has("nullableLabels") and data["nullableLabels"] != null:
			if data["nullableLabels"] is Array:
				var arr: Array[Variant] = []
				for item in data["nullableLabels"]:
					if item == null:
						arr.append(null)
					elif item is String:
						arr.append(str(item))
				obj.nullable_labels = arr
		return obj

	func to_dict() -> Dictionary:
		var dict = {}
		if statuses != null:
			var arr = []
			for item in statuses:
				if TEST_STATUS_VALUES.has(item):
					arr.append(TEST_STATUS_VALUES[item])
				else:
					arr.append(item)
			dict["statuses"] = arr
		else:
			dict["statuses"] = null
		if strict_statuses != null:
			var arr = []
			for item in strict_statuses:
				if STRICT_STATUS_VALUES.has(item):
					arr.append(STRICT_STATUS_VALUES[item])
				else:
					arr.append(item)
			dict["strictStatuses"] = arr
		else:
			dict["strictStatuses"] = null
		if nullable_strict_statuses != null:
			var arr = []
			for item in nullable_strict_statuses:
				if STRICT_STATUS_VALUES.has(item):
					arr.append(STRICT_STATUS_VALUES[item])
				else:
					arr.append(item)
			dict["nullableStrictStatuses"] = arr
		else:
			dict["nullableStrictStatuses"] = null
		dict["nullableLabels"] = nullable_labels
		return dict

# ============================================================================
# Input Types
# ============================================================================

# ============================================================================
# Enum String Helpers
# ============================================================================

const TEST_STATUS_VALUES = {
	TestStatus.UNKNOWN: "unknown",
	TestStatus.ACTIVE: "active"
}

const STRICT_STATUS_VALUES = {
	StrictStatus.ACTIVE: "active"
}

# ============================================================================
# Enum Reverse Lookup (string -> enum for deserialization)
# ============================================================================

const TEST_STATUS_FROM_STRING = {
	"unknown": TestStatus.UNKNOWN,
	"active": TestStatus.ACTIVE
}

const STRICT_STATUS_FROM_STRING = {
	"active": StrictStatus.ACTIVE
}
