function Subject() {
  return (
    <div className="doc-page">
      <h1>Subject</h1>
      
      <section>
        <h2>Overview</h2>
        <p>
          A Subject is both an Observable and an Observer. It can multicast values to 
          multiple observers, making it perfect for sharing purchase events across 
          different parts of your application.
        </p>
      </section>

      <section>
        <h2>Types of Subjects</h2>
        
        <h3>Subject</h3>
        <p>Basic subject with no initial value or replay behavior.</p>
        <pre className="code-block">{`import { Subject } from '@openiap/core'

const purchaseEvents = new Subject()

// Subscribe multiple observers
purchaseEvents.subscribe(event => 
  console.log('Observer 1:', event)
)

purchaseEvents.subscribe(event => 
  console.log('Observer 2:', event)
)

// Emit events
purchaseEvents.next({ type: 'purchase', productId: 'premium' })`}</pre>

        <h3>BehaviorSubject</h3>
        <p>Stores the latest value and emits it to new subscribers.</p>
        <pre className="code-block">{`const purchaseState = new BehaviorSubject({
  isPurchasing: false,
  lastPurchase: null
})

// New subscribers get the current state immediately
purchaseState.subscribe(state => 
  console.log('Current state:', state)
)

// Update state
purchaseState.next({
  isPurchasing: true,
  lastPurchase: null
})`}</pre>

        <h3>ReplaySubject</h3>
        <p>Replays specified number of previous emissions to new subscribers.</p>
        <pre className="code-block">{`// Replay last 3 purchases
const recentPurchases = new ReplaySubject(3)

recentPurchases.next(purchase1)
recentPurchases.next(purchase2)
recentPurchases.next(purchase3)

// New subscriber gets all 3 previous purchases
recentPurchases.subscribe(purchase => 
  console.log('Recent purchase:', purchase)
)`}</pre>
      </section>

      <section>
        <h2>Purchase Event Bus</h2>
        <pre className="code-block">{`class PurchaseEventBus {
  private events = new Subject()
  
  emit(event: PurchaseEvent) {
    this.events.next(event)
  }
  
  on(eventType: string) {
    return this.events.pipe(
      filter(event => event.type === eventType)
    )
  }
  
  onPurchaseComplete() {
    return this.on('purchase_complete')
  }
  
  onPurchaseError() {
    return this.on('purchase_error')
  }
}

const eventBus = new PurchaseEventBus()

// Listen for events
eventBus.onPurchaseComplete().subscribe(event => {
  unlockContent(event.productId)
})

// Emit events
eventBus.emit({
  type: 'purchase_complete',
  productId: 'premium',
  receipt: receiptData
})`}</pre>
      </section>

      <section>
        <h2>State Management</h2>
        <pre className="code-block">{`class PurchaseStore {
  private state = new BehaviorSubject({
    products: [],
    purchases: [],
    loading: false,
    error: null
  })
  
  get state$() {
    return this.state.asObservable()
  }
  
  get currentState() {
    return this.state.value
  }
  
  updateProducts(products: Product[]) {
    this.state.next({
      ...this.currentState,
      products
    })
  }
  
  addPurchase(purchase: Purchase) {
    this.state.next({
      ...this.currentState,
      purchases: [...this.currentState.purchases, purchase]
    })
  }
}`}</pre>
      </section>

      <section>
        <h2>Best Practices</h2>
        <ul>
          <li>Always unsubscribe from Subjects to prevent memory leaks</li>
          <li>Use BehaviorSubject for state that needs an initial value</li>
          <li>Use ReplaySubject carefully - large buffers can consume memory</li>
          <li>Consider using state management libraries for complex state</li>
          <li>Protect Subjects by exposing only Observable interface when possible</li>
        </ul>
      </section>
    </div>
  )
}

export default Subject