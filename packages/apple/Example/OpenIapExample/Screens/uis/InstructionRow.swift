import SwiftUI

struct InstructionRow: View {
    let number: String
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 24, height: 24)
                .background(AppColors.primary)
                .clipShape(Circle())
            
            Text(text)
                .font(.subheadline)
                .foregroundColor(AppColors.primaryText)
            
            Spacer()
        }
    }
}

