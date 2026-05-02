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

func _run_loop() -> void:
	while _running:
		var ok := await _open_and_drain()
		if not ok:
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
# CRLF-CRLF or LF-LF in the buffer, and sep_len is the byte length of
# that separator. Returns idx = -1 when no complete frame has arrived.
func _find_frame_boundary(buf: PackedByteArray) -> Dictionary:
	var n := buf.size()
	var i := 0
	while i < n - 1:
		# `\n\n`
		if buf[i] == 0x0A and buf[i + 1] == 0x0A:
			return { "idx": i, "sep_len": 2 }
		# `\r\n\r\n`
		if (
			i < n - 3
			and buf[i] == 0x0D
			and buf[i + 1] == 0x0A
			and buf[i + 2] == 0x0D
			and buf[i + 3] == 0x0A
		):
			return { "idx": i, "sep_len": 4 }
		i += 1
	return { "idx": -1, "sep_len": 0 }

func _process_frame(frame: String) -> void:
	if frame.is_empty():
		return
	var event_name := ""
	var event_id := ""
	var data_lines: Array[String] = []
	for line in frame.split("\n", false):
		var stripped := line
		if stripped.ends_with("\r"):
			stripped = stripped.substr(0, stripped.length() - 1)
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
	for required in ["id", "type", "purchaseToken"]:
		if not decoded.has(required) or decoded[required] == null:
			emit_signal("stream_error", "MALFORMED_EVENT", "WebhookEvent missing required fields")
			return
	emit_signal("event_received", decoded)
	# Cursor advances only after a successful emit.
	if not event_id.is_empty():
		_last_event_id = event_id
