import SwiftUI

struct TestingNotesCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "testtube.2")
                    .foregroundColor(AppColors.warning)
                Text("Testing Notes")
                    .font(.headline)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 12) {
                TestingNote(
                    icon: "checkmark.circle",
                    text: "Requires iOS 14.0+ for offer code redemption",
                    color: AppColors.success
                )
                
                TestingNote(
                    icon: "gear",
                    text: "Configure offer codes in App Store Connect",
                    color: AppColors.primary
                )
                
                TestingNote(
                    icon: "person.2",
                    text: "Test with sandbox account for development",
                    color: AppColors.secondary
                )
                
                TestingNote(
                    icon: "exclamationmark.triangle",
                    text: "Production codes only work in live app",
                    color: AppColors.warning
                )
            }
        }
        .padding()
        .background(AppColors.warning.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppColors.warning, lineWidth: 1)
        )
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

