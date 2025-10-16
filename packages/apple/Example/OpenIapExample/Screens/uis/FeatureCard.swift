import SwiftUI

struct FeatureCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let destination: AnyView
    
    var body: some View {
        NavigationLink(destination: destination) {
            VStack(spacing: 8) {
                Spacer()
                
                Image(systemName: icon)
                    .font(.system(size: 34))
                    .foregroundColor(color)
                    .frame(height: 40)
                
                VStack(spacing: 4) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundColor(.primary)
                    
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
                
                Spacer()
            }
            .frame(height: 140)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 16)
            .background(AppColors.cardBackground)
            .cornerRadius(12)
            .shadow(radius: 2)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

