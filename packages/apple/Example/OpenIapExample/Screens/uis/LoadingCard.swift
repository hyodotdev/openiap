import SwiftUI

struct LoadingCard: View {
    let text: String
    
    var body: some View {
        HStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
            
            Text(text)
                .font(.subheadline)
                .foregroundColor(AppColors.primaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal)
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
}

