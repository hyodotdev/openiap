import Foundation

public final class Subscription: NSObject {
    public let id: UUID
    public let eventType: IapEvent
    internal var onRemove: (() -> Void)?

    public init(eventType: IapEvent, onRemove: (() -> Void)? = nil) {
        self.id = UUID()
        self.eventType = eventType
        self.onRemove = onRemove
        super.init()
    }

    deinit {
        if let onRemove {
            Task { await MainActor.run { onRemove() } }
        }
    }
}
