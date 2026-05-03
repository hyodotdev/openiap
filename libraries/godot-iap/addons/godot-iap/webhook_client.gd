extends Node
class_name OpenIapWebhookClient

## Webhook listener for the openiap kit SSE stream
## (`GET /v1/webhooks/stream/{api_key}`).
##
## Wire format mirrors the canonical TypeScript implementation in
## packages/gql/src/webhook-client.ts. The WebhookEvent shape comes
## from packages/gql/src/webhook.graphql.
##
## Add this node to a scene, set [code]api_key[/code] (and optionally
## [code]base_url[/code]), then call [code]connect_stream()[/code].
## Listen for the [code]event_received[/code] signal to consume
## normalized webhook events without running your own server.
##
## Reconnect: the node uses HTTPClient + chunked HTTP read in a loop
## with a 2s back-off on disconnect. The Last-Event-ID header is
## populated from the most recently dispatched event so events that
## fire while the connection is closed are delivered in order on the
## next connect.

@export var api_key: String = ""
@export var base_url: String = "https://kit.openiap.dev"
@export var auto_start: bool = false
@export var reconnect_delay_seconds: float = 2.0

signal event_received(event: Dictionary)
signal stream_error(code: String, message: String)
signal connected_to_stream()

var _client: HTTPClient = HTTPClient.new()
var _running: bool = false
var _last_event_id: String = ""
# Byte-oriented buffer so a multi-byte UTF-8 character split across two
# HTTP chunks doesn't corrupt the decode. We only call
# `get_string_from_utf8()` after the SSE frame separator is found —
# `\n` / `\r` are pure ASCII so scanning for the boundary at the byte
# level can't false-match inside a multi-byte codepoint.
var _buffer: PackedByteArray = PackedByteArray()

func _ready() -> void:
	if auto_start:
		connect_stream()

## Begin streaming. Returns immediately; the connection runs on a
## background process loop until [code]close_stream()[/code] is called
## or the node is freed.
func connect_stream() -> void:
	if _running:
		return
	if api_key.is_empty():
		emit_signal("stream_error", "INVALID_INPUT", "api_key is empty")
		return
	_running = true
	_run_loop()

func close_stream() -> void:
	_running = false
	_client.close()

# Stop the SSE coroutine when the node leaves the scene tree. Without
# this, callers that queue_free()/remove_child() this node without
# explicitly calling close_stream() leak the awaited
# SceneTreeTimer (the timer outlives the node) and the resume path
# crashes when the awaiting object is gone. Mirrors close_stream()
# so the cleanup logic stays in one place.
func _exit_tree() -> void:
	close_stream()

func _run_loop() -> void:
	while _running:
		var ok := await _open_and_drain()
		# Skip the reconnect-error signal if shutdown was intentional —
		# `close_stream()` / `_exit_tree()` set `_running = false`
		# before _open_and_drain returns, and emitting TRANSPORT_ERROR
		# in that path made normal teardown look like a failure
		# (PR #124 (https://github.com/hyodotdev/openiap/pull/124)
		# review).
		if not ok and _running:
			emit_signal("stream_error", "TRANSPORT_ERROR", "stream disconnected; reconnecting")
		if not _running:
			break
		await get_tree().create_timer(reconnect_delay_seconds).timeout

func _open_and_drain() -> bool:
	var trimmed := base_url.trim_suffix("/")
	var parsed_uri := trimmed.replace("https://", "").replace("http://", "")
	var slash := parsed_uri.find("/")
	var host: String
	var path_root: String
	if slash >= 0:
		host = parsed_uri.substr(0, slash)
		path_root = parsed_uri.substr(slash)
	else:
		host = parsed_uri
		path_root = ""
	var use_ssl := not trimmed.begins_with("http://")
	var port := 443 if use_ssl else 80
	# Honor an explicit `host:port` override regardless of scheme.
	# Prior behaviour only parsed the port for non-TLS URLs, so a
	# custom HTTPS endpoint like `https://kit.example.com:8443` was
	# silently dialled on 443 and the stream never opened.
	var colon := host.find(":")
	if colon >= 0:
		port = int(host.substr(colon + 1))
		host = host.substr(0, colon)

	var connect_err := _client.connect_to_host(host, port, TLSOptions.client() if use_ssl else null)
	if connect_err != OK:
		return false

	while _client.get_status() == HTTPClient.STATUS_CONNECTING or _client.get_status() == HTTPClient.STATUS_RESOLVING:
		_client.poll()
		await get_tree().process_frame

	if _client.get_status() != HTTPClient.STATUS_CONNECTED:
		# Detect terminal HTTPClient statuses (DNS resolution failure,
		# unreachable host, broken TLS) so a misconfigured endpoint
		# doesn't trigger an infinite reconnect loop. Surface the
		# specific failure so the operator can fix the config instead
		# of seeing a generic "stream disconnected" log spam every 2s
		# (PR #124 (https://github.com/hyodotdev/openiap/pull/124)
		# review).
		var status := _client.get_status()
		if status == HTTPClient.STATUS_CANT_RESOLVE \
				or status == HTTPClient.STATUS_CANT_CONNECT \
				or status == HTTPClient.STATUS_TLS_HANDSHAKE_ERROR:
			emit_signal("stream_error", "HTTP_CLIENT_FATAL", "HTTPClient terminal status: %d" % status)
			_running = false
			_client.close()
		return false

	emit_signal("connected_to_stream")

	var path := "%s/v1/webhooks/stream/%s" % [path_root, api_key.uri_encode()]
	var headers := PackedStringArray([
		"Accept: text/event-stream",
		"Cache-Control: no-cache",
	])
	if not _last_event_id.is_empty():
		headers.append("Last-Event-ID: %s" % _last_event_id)

	var req_err := _client.request(HTTPClient.METHOD_GET, path, headers)
	if req_err != OK:
		return false

	while _client.get_status() == HTTPClient.STATUS_REQUESTING:
		_client.poll()
		await get_tree().process_frame

	if _client.get_status() != HTTPClient.STATUS_BODY:
		return false

	# kit's SSE handler returns 401 on bad/rotated apiKey, 412 on
	# unconfigured platform, 5xx on transient backend issues. Without
	# inspecting the response code, the body-reader loop below would
	# consume the error JSON, _drain_frames would find no SSE frame,
	# and _open_and_drain would return true — _run_loop would then
	# silently reconnect forever with zero user-visible feedback. Bail
	# loudly with HTTP_ERROR so the caller can surface a real error.
	# Accept any 2xx (200-299) — kit returns 200 today but the SSE spec
	# and common proxy paths permit 201/202/204 success codes too. The
	# 4xx-vs-5xx terminal split below is what we actually care about
	# (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review).
	var response_code := _client.get_response_code()
	if response_code < 200 or response_code >= 300:
		emit_signal("stream_error", "HTTP_ERROR", "Unexpected HTTP response: %d" % response_code)
		# 4xx responses (401 INVALID_API_KEY, 412 *_NOT_CONFIGURED) will
		# never succeed on retry — stop the loop so the operator sees
		# the error instead of an infinite log spam. 5xx is transient
		# and should reconnect on the normal back-off.
		if response_code >= 400 and response_code < 500:
			_running = false
		return false

	_buffer = PackedByteArray()
	while _client.get_status() == HTTPClient.STATUS_BODY and _running:
		_client.poll()
		var chunk: PackedByteArray = _client.read_response_body_chunk()
		if chunk.size() > 0:
			_buffer.append_array(chunk)
			_drain_frames()
		else:
			await get_tree().process_frame

	return true

func _drain_frames() -> void:
	# SSE frames are terminated by a blank line ("\n\n" or "\r\n\r\n").
	# Operate on the byte buffer so that a UTF-8 codepoint split across
	# two chunks is preserved until its trailing bytes arrive — the
	# previous String-based buffer would have lost the head bytes when
	# `get_string_from_utf8()` returned empty on an incomplete tail.
	while true:
		var boundary := _find_frame_boundary(_buffer)
		if boundary.idx < 0:
			return
		var frame_bytes := _buffer.slice(0, boundary.idx)
		_buffer = _buffer.slice(boundary.idx + boundary.sep_len)
		var frame := frame_bytes.get_string_from_utf8()
		_process_frame(frame)

# Returns {idx, sep_len} where idx is the byte offset of the first
# blank-line separator in the buffer, and sep_len is the byte length
# of that separator. Returns idx = -1 when no complete frame has
# arrived. Per the SSE spec (whatwg, section "Interpreting an event
# stream"), a line terminator is *any* of CRLF, LF, or CR — and a
# blank line is two consecutive terminators in any combination. The
# byte scan below accepts every combination so we don't miss frames
# emitted by servers using CR-only or mixed terminators.
func _find_frame_boundary(buf: PackedByteArray) -> Dictionary:
	var n := buf.size()
	var i := 0
	while i < n:
		# Length of the line terminator starting at index i (0 if not
		# a terminator). Accept CRLF (2), LF (1), CR (1).
		var first_len := _terminator_length(buf, i, n)
		if first_len == 0:
			i += 1
			continue
		var second_len := _terminator_length(buf, i + first_len, n)
		if second_len == 0:
			i += first_len
			continue
		return { "idx": i, "sep_len": first_len + second_len }
	return { "idx": -1, "sep_len": 0 }

# Length (1 or 2) of the line terminator starting at `idx`, or 0 if
# the byte at `idx` isn't a terminator. CRLF takes precedence so
# `\r\n` is reported as 2, not as 1+1.
func _terminator_length(buf: PackedByteArray, idx: int, n: int) -> int:
	if idx >= n:
		return 0
	var b := buf[idx]
	if b == 0x0D and idx + 1 < n and buf[idx + 1] == 0x0A:
		return 2
	if b == 0x0A or b == 0x0D:
		return 1
	return 0

func _process_frame(frame: String) -> void:
	if frame.is_empty():
		return
	var event_name := ""
	var event_id := ""
	var data_lines: Array[String] = []
	# WHATWG SSE spec accepts CR, LF, or CRLF as a line terminator.
	# Normalize to "\n" first so split + ends_with(":") downstream
	# behave correctly even on CR-only servers (rare but spec-allowed).
	var normalized := frame.replace("\r\n", "\n").replace("\r", "\n")
	for line in normalized.split("\n", false):
		var stripped := line
		if stripped.begins_with(":"):
			continue # SSE comment
		var colon := stripped.find(":")
		if colon < 0:
			continue
		var field := stripped.substr(0, colon)
		var value := stripped.substr(colon + 1)
		if value.begins_with(" "):
			value = value.substr(1)
		match field:
			"event":
				event_name = value
			"id":
				event_id = value
			"data":
				data_lines.append(value)
	# Don't advance `_last_event_id` here — wait until we've actually
	# emitted the parsed event below. If parsing fails (PARSE_ERROR /
	# MALFORMED_EVENT) we'd otherwise move the reconnect cursor past
	# an event the listener never received, so the next connection
	# would skip it permanently.
	if data_lines.is_empty():
		return
	if event_name == "heartbeat" or event_name == "ready":
		return
	var data_str := "\n".join(data_lines)
	if data_str.is_empty():
		return
	var json := JSON.new()
	var err := json.parse(data_str)
	if err != OK:
		emit_signal("stream_error", "PARSE_ERROR", "Failed to parse SSE payload: %s" % json.get_error_message())
		return
	var decoded = json.data
	if typeof(decoded) != TYPE_DICTIONARY:
		return
	# `has(...)` returns true even for explicit-null fields, so an
	# upstream payload like `{"id": null, ...}` would slip through and
	# downstream listeners would see a partial event. Reject any
	# required field that is missing OR null.
	for required in ["id", "type"]:
		if not _is_non_empty_string(decoded.get(required)):
			emit_signal("stream_error", "MALFORMED_EVENT", "WebhookEvent missing required fields")
			return
	# purchaseToken is required for every event type *except*
	# TestNotification — Apple ASN v2 / Google RTDN test payloads
	# carry no transaction. Hard-rejecting here would surface valid
	# test webhooks as MALFORMED_EVENT and never reach listeners.
	if decoded["type"] != "TestNotification":
		if not _is_non_empty_string(decoded.get("purchaseToken")):
			emit_signal("stream_error", "MALFORMED_EVENT", "WebhookEvent missing required field purchaseToken")
			return
	emit_signal("event_received", decoded)
	# Cursor advances only after a successful emit.
	if not event_id.is_empty():
		_last_event_id = event_id


# True when value is a non-empty string. Used to reject upstream
# payloads where required fields (id, type, purchaseToken) come back
# as numeric / null / empty — without this, a malformed event with
# `{"id": 0, "type": "..."}` would silently flow through to listeners
# and crash on `String(event.id)`-shaped consumers.
func _is_non_empty_string(value) -> bool:
	if value == null:
		return false
	if typeof(value) != TYPE_STRING:
		return false
	return not String(value).is_empty()
