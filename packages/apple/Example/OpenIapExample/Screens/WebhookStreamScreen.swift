import Foundation
import SwiftUI

@available(iOS 15.0, *)
struct WebhookStreamScreen: View {
    @State private var events: [WebhookEventRow] = []
    @State private var status = "idle"
    @State private var statusMessage: String?
    @State private var streamTask: Task<Void, Never>?
    @State private var testing = false

    private let apiKey: String = {
        if let value = Bundle.main.object(forInfoDictionaryKey: "IAPKIT_API_KEY") as? String,
           !value.isEmpty {
            return value
        }
        return ProcessInfo.processInfo.environment["IAPKIT_API_KEY"] ?? ""
    }()

    private let baseUrl: String = {
        if let value = Bundle.main.object(forInfoDictionaryKey: "IAPKIT_BASE_URL") as? String,
           !value.isEmpty {
            return value
        }
        return ProcessInfo.processInfo.environment["IAPKIT_BASE_URL"] ?? "https://kit.openiap.dev"
    }()

    var body: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("SSE /v1/webhooks/stream/{apiKey}")
                    .font(.headline)
                Text("api key: \(apiKey.isEmpty ? "MISSING" : "\(apiKey.prefix(8))...")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(AppColors.cardBackground)
            .cornerRadius(12)

            HStack(spacing: 12) {
                Button(status == "connected" ? "Disconnect" : "Connect") {
                    status == "connected" ? stopStream() : startStream()
                }
                .buttonStyle(.borderedProminent)

                Button(testing ? "Sending..." : "Trigger Test") {
                    Task { await triggerTestNotification() }
                }
                .buttonStyle(.bordered)
                .disabled(testing)
            }

            StatusBanner(status: status, message: statusMessage)

            if events.isEmpty {
                Spacer()
                Text("No webhook events yet.")
                    .foregroundColor(.secondary)
                Spacer()
            } else {
                List(events) { event in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(event.type)
                            .font(.headline)
                        Text("source: \(event.source ?? "-") / platform: \(event.platform ?? "-")")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("productId: \(event.productId ?? "-")")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.plain)
            }
        }
        .padding()
        .background(AppColors.background)
        .navigationTitle("Webhook Stream")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            stopStream()
        }
    }

    private func startStream() {
        guard !apiKey.isEmpty else {
            status = "error"
            statusMessage = "IAPKIT_API_KEY is not configured."
            return
        }

        stopStream()
        status = "connected"
        statusMessage = nil

        streamTask = Task {
            do {
                let endpoint = "\(baseUrl.trimmedTrailingSlash())/v1/webhooks/stream/\(apiKey.urlPathEncoded())"
                guard let url = URL(string: endpoint) else {
                    throw URLError(.badURL)
                }
                var request = URLRequest(url: url)
                request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                let (bytes, response) = try await URLSession.shared.bytes(for: request)
                if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                    throw URLError(.badServerResponse)
                }

                for try await line in bytes.lines {
                    guard !Task.isCancelled else { break }
                    guard line.hasPrefix("data:") else { continue }
                    let raw = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                    guard let data = raw.data(using: .utf8),
                          let event = try? JSONDecoder().decode(WebhookEventRow.self, from: data) else {
                        continue
                    }
                    await MainActor.run {
                        events.insert(event, at: 0)
                        if events.count > 50 {
                            events.removeLast(events.count - 50)
                        }
                        status = "connected"
                        statusMessage = nil
                    }
                }
            } catch {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    status = "error"
                    statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func stopStream() {
        streamTask?.cancel()
        streamTask = nil
        if status == "connected" {
            status = "idle"
            statusMessage = nil
        }
    }

    private func triggerTestNotification() async {
        guard !apiKey.isEmpty else {
            statusMessage = "Cannot trigger test: API key missing."
            return
        }

        testing = true
        defer { testing = false }

        do {
            let endpoint = "\(baseUrl.trimmedTrailingSlash())/v1/webhooks/\(apiKey.urlPathEncoded())"
            guard let url = URL(string: endpoint) else { throw URLError(.badURL) }
            let dataJson = """
            {"version":"1.0","packageName":"com.example.app","eventTimeMillis":"\(Int(Date().timeIntervalSince1970 * 1000))","testNotification":{"version":"1.0"}}
            """
            let payload: [String: Any] = [
                "message": [
                    "data": Data(dataJson.utf8).base64EncodedString(),
                    "messageId": "apple-test-\(Int(Date().timeIntervalSince1970 * 1000))",
                    "publishTime": ISO8601DateFormatter().string(from: Date())
                ],
                "subscription": "projects/example/subscriptions/iapkit-rtdn"
            ]
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let (_, response) = try await URLSession.shared.data(for: request)
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            statusMessage = (200...299).contains(statusCode)
                ? "Test notification accepted."
                : "Test POST returned \(statusCode)."
        } catch {
            statusMessage = "Test POST failed: \(error.localizedDescription)"
        }
    }
}

@available(iOS 15.0, *)
private struct StatusBanner: View {
    let status: String
    let message: String?

    var body: some View {
        Text(message == nil ? "Status: \(status)" : "Status: \(status)\n\(message!)")
            .font(.subheadline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(backgroundColor)
            .cornerRadius(10)
    }

    private var backgroundColor: Color {
        switch status {
        case "connected":
            return AppColors.success.opacity(0.15)
        case "error":
            return AppColors.error.opacity(0.15)
        default:
            return AppColors.cardBackground
        }
    }
}

private struct WebhookEventRow: Codable, Identifiable {
    let id: String
    let type: String
    let source: String?
    let platform: String?
    let productId: String?
}

private extension String {
    func trimmedTrailingSlash() -> String {
        hasSuffix("/") ? String(dropLast()) : self
    }

    func urlPathEncoded() -> String {
        addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? self
    }
}
