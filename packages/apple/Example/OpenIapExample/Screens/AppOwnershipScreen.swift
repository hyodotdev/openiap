import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct AppOwnershipScreen: View {
    @StateObject private var iapStore = OpenIapStore()
    @State private var cloudProjectNumber = ""
    @State private var requestHash = ""
    @State private var resultMessage: String?
    @State private var isChecking = false
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.largeTitle)
                            .foregroundColor(AppColors.primary)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("App Ownership")
                                .font(.headline)

                            Text("Check the app came from its store")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()
                    }

                    Text("Verify the app download itself, separately from in-app purchases.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(AppColors.cardBackground)
                .cornerRadius(12)
                .shadow(radius: 2)
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                    TextField("Google Cloud project number", text: $cloudProjectNumber)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .disabled(isChecking)
                    TextField("Request hash", text: $requestHash)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .disabled(isChecking)
                    Button(isChecking ? "Checking..." : "Check app ownership") {
                        Task { await checkAppOwnership() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isChecking || iapStore.status.loadings.initConnection)
                    if let resultMessage {
                        Text(resultMessage)
                            .font(.system(.caption, design: .monospaced))
                    }
                }
                .padding()
                .background(AppColors.cardBackground)
                .cornerRadius(12)
                .shadow(radius: 2)
                .padding(.horizontal)

                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .background(AppColors.background)
        .navigationTitle("App Ownership")
        .navigationBarTitleDisplayMode(.large)
        .alert("Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            Task {
                do {
                    try await iapStore.initConnection()
                } catch {
                    errorMessage = "Failed to initialize connection: \(error.localizedDescription)"
                    showError = true
                }
            }
        }
        .onDisappear {
            Task { try? await iapStore.endConnection() }
        }
    }

    @MainActor
    private func checkAppOwnership() async {
        let projectNumber = cloudProjectNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let hash = requestHash.trimmingCharacters(in: .whitespacesAndNewlines)
        guard projectNumber.isEmpty == hash.isEmpty else {
            resultMessage = "Error: \(ErrorCode.developerError.rawValue)\nEnter both Google Cloud project number and Request hash, or leave both empty."
            return
        }
        let google = projectNumber.isEmpty ? nil : PlayIntegrityParamsAndroid(
            cloudProjectNumber: projectNumber, requestHash: hash
        )
        isChecking = true
        resultMessage = nil
        defer { isChecking = false }
        do {
            let result = try await iapStore.verifyAppOwnership(VerifyAppOwnershipProps(google: google))
            resultMessage = """
            Status: \(result.status.rawValue)
            Store ID: \(result.storeId)
            Reason: \(result.reason?.rawValue ?? "none")
            Signed AppTransaction length: \(result.signedAppTransactionIOS?.count ?? 0)
            Integrity token length: \(result.integrityTokenAndroid?.count ?? 0)
            """
        } catch let error as OpenIapError {
            resultMessage = "Error: \(error.code.rawValue)\n\(error.message)"
        } catch {
            resultMessage = "App ownership failed: \(error.localizedDescription)"
        }
    }
}

#Preview {
    NavigationView {
        AppOwnershipScreen()
    }
}
