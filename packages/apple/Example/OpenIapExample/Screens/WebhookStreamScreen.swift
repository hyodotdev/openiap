import SwiftUI

@available(iOS 15.0, *)
struct WebhookStreamScreen: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Trusted backend or MCP only")
                    .font(.headline)

                WebhookInfoCard(
                    title: "Do not connect from a shipped app",
                    message: """
                    The project-wide IAPKit stream contains lifecycle records and purchase identifiers. \
                    It requires an openiap-kit_sk_ secret admin key, which must never be embedded in an app.
                    """,
                    warning: true
                )

                WebhookInfoCard(
                    title: "Mobile app",
                    message: """
                    Use an openiap-kit_pk_ publishable key for purchase verification, user-scoped \
                    entitlement helpers, and public product payloads.
                    """
                )

                WebhookInfoCard(
                    title: "Trusted consumer",
                    message: """
                    MCP, CI, or your backend connects to GET /v1/webhooks/stream and sends \
                    Authorization: Bearer <IAPKIT_SECRET_KEY>. If your backend protects paid content, \
                    it should make the final entitlement decision.
                    """
                )

                Text(
                    """
                    Configure the separate lifecycle webhook URL from the IAPKit dashboard in \
                    App Store Connect and Google Cloud Pub/Sub.
                    """
                )
                .font(.subheadline)
                .foregroundColor(.secondary)
            }
            .padding()
        }
        .background(AppColors.background)
        .navigationTitle("Webhook Stream")
        .navigationBarTitleDisplayMode(.inline)
    }
}

@available(iOS 15.0, *)
private struct WebhookInfoCard: View {
    let title: String
    let message: String
    var warning = false

    var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
    }

    var body: some View {
        if warning {
            content
                .background(Color.orange.opacity(0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.orange.opacity(0.5))
                )
                .cornerRadius(12)
        } else {
            content
                .background(AppColors.cardBackground)
                .cornerRadius(12)
        }
    }
}
