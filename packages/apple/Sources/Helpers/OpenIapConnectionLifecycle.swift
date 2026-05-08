import Foundation

/// Owns the mutable connection resources that must move together during
/// init/end races. OpenIapModule keeps StoreKit behavior; this helper keeps the
/// lock, generation checks, and task handles in one place.
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
final class OpenIapConnectionLifecycle {
    // MARK: - Resource Snapshots

    struct CleanupResources {
        let updateListenerTask: Task<Void, Error>?
        let messageListenerTask: Task<Void, Never>?
        let unfinishedTransactionTask: Task<Void, Never>?
        let productManager: ProductManager?
    }

    struct DeinitResources {
        let initTask: Task<Bool, Error>?
        let endTask: Task<Void, Never>?
        let updateListenerTask: Task<Void, Error>?
        let messageListenerTask: Task<Void, Never>?
        let unfinishedTransactionTask: Task<Void, Never>?
    }

    private let lock = NSLock()
    private var connectionGeneration: UInt64 = 0
    private var initTask: Task<Bool, Error>?
    private var initTaskGeneration: UInt64?
    private var endTask: Task<Void, Never>?
    private var endTaskGeneration: UInt64?
    private var updateListenerTask: Task<Void, Error>?
    private var messageListenerTask: Task<Void, Never>?
    private var unfinishedTransactionTask: Task<Void, Never>?
    private var productManager: ProductManager?

    // MARK: - Init / End Tasks

    func currentEndTask() -> Task<Void, Never>? {
        withLock { endTask }
    }

    func makeInitTask(
        operation: @escaping (UInt64) async throws -> Bool
    ) -> (task: Task<Bool, Error>, generation: UInt64)? {
        withLock {
            guard endTask == nil else {
                return nil
            }

            if let initTask, initTaskGeneration == connectionGeneration {
                return (initTask, connectionGeneration)
            }

            connectionGeneration += 1
            let generation = connectionGeneration
            let task = Task<Bool, Error> {
                try await operation(generation)
            }
            initTask = task
            initTaskGeneration = generation
            return (task, generation)
        }
    }

    func makeEndTask(cleanup: @escaping () async -> Void) -> Task<Void, Never> {
        withLock {
            if let endTask {
                return endTask
            }

            connectionGeneration += 1
            let generation = connectionGeneration
            let taskToCancel = initTask
            initTask = nil
            initTaskGeneration = nil

            let task = Task { [weak self] in
                defer { self?.clearEndTask(generation: generation) }
                taskToCancel?.cancel()
                if let taskToCancel {
                    await Self.awaitCancelledInitTask(taskToCancel)
                }

                await cleanup()
            }
            endTask = task
            endTaskGeneration = generation
            return task
        }
    }

    func clearInitTask(generation: UInt64) {
        withLock {
            if initTaskGeneration == generation {
                initTask = nil
                initTaskGeneration = nil
            }
        }
    }

    func clearUnfinishedTransactionTask(generation: UInt64) {
        withLock {
            if connectionGeneration == generation {
                unfinishedTransactionTask = nil
            }
        }
    }

    func ensureCurrent(_ generation: UInt64) throws {
        try withLock {
            guard connectionGeneration == generation else {
                throw CancellationError()
            }
        }
    }

    // MARK: - Resource Access

    func currentProductManager() -> ProductManager? {
        withLock { productManager }
    }

    func getOrCreateProductManager(generation: UInt64) throws -> ProductManager {
        try withLock {
            guard connectionGeneration == generation else {
                throw CancellationError()
            }

            if let productManager {
                return productManager
            }

            let productManager = ProductManager()
            self.productManager = productManager
            return productManager
        }
    }

    // MARK: - Listener Tasks

    func startTransactionListenerTask(
        generation: UInt64,
        makeTask: () -> Task<Void, Error>
    ) throws {
        try withLock {
            guard connectionGeneration == generation else {
                throw CancellationError()
            }
            guard updateListenerTask == nil else {
                return
            }

            updateListenerTask = makeTask()
        }
    }

    func startUnfinishedTransactionTask(
        generation: UInt64,
        makeTask: () -> Task<Void, Never>
    ) throws {
        try withLock {
            guard connectionGeneration == generation else {
                throw CancellationError()
            }
            guard unfinishedTransactionTask == nil else {
                return
            }

            unfinishedTransactionTask = makeTask()
        }
    }

    func startMessageListenerTask(
        generation: UInt64?,
        makeTask: () -> Task<Void, Never>
    ) throws {
        try withLock {
            if let generation, connectionGeneration != generation {
                throw CancellationError()
            }
            guard endTask == nil, messageListenerTask == nil else {
                return
            }

            messageListenerTask = makeTask()
        }
    }

    // MARK: - Cleanup

    func detachResourcesForCleanup() -> CleanupResources {
        withLock {
            let resources = CleanupResources(
                updateListenerTask: updateListenerTask,
                messageListenerTask: messageListenerTask,
                unfinishedTransactionTask: unfinishedTransactionTask,
                productManager: productManager
            )

            updateListenerTask = nil
            messageListenerTask = nil
            unfinishedTransactionTask = nil
            productManager = nil
            return resources
        }
    }

    func detachTasksForDeinit() -> DeinitResources {
        withLock {
            let resources = DeinitResources(
                initTask: initTask,
                endTask: endTask,
                updateListenerTask: updateListenerTask,
                messageListenerTask: messageListenerTask,
                unfinishedTransactionTask: unfinishedTransactionTask
            )

            initTask = nil
            initTaskGeneration = nil
            endTask = nil
            endTaskGeneration = nil
            updateListenerTask = nil
            messageListenerTask = nil
            unfinishedTransactionTask = nil
            return resources
        }
    }

    // MARK: - Locking

    private func clearEndTask(generation: UInt64) {
        withLock {
            if endTaskGeneration == generation {
                endTask = nil
                endTaskGeneration = nil
            }
        }
    }

    private func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }

    private static func awaitCancelledInitTask(_ task: Task<Bool, Error>) async {
        do {
            _ = try await task.value
        } catch is CancellationError {
            // Expected when endConnection cancels an in-flight initConnection.
        } catch {
            OpenIapLog.warn("initConnection failed while endConnection was cancelling it: \(error)")
        }
    }
}
