function Scheduler() {
  return (
    <div className="doc-page">
      <h1>Scheduler</h1>

      <section>
        <h2>Overview</h2>
        <p>
          Schedulers control when and how Observable execution happens. They're
          essential for managing concurrency, timing, and execution context in
          purchase flows.
        </p>
      </section>

      <section>
        <h2>Built-in Schedulers</h2>

        <h3>asyncScheduler</h3>
        <p>Schedules work asynchronously using setTimeout/setInterval.</p>
        <pre className="code-block">{`import { asyncScheduler } from '@openiap/core'

purchase.pipe(
  observeOn(asyncScheduler),
  map(result => processResult(result))
)`}</pre>

        <h3>queueScheduler</h3>
        <p>Executes synchronously in a queue (FIFO).</p>
        <pre className="code-block">{`purchases.pipe(
  observeOn(queueScheduler),
  map(purchase => validatePurchase(purchase))
)`}</pre>

        <h3>animationFrameScheduler</h3>
        <p>
          Schedules work using requestAnimationFrame - ideal for UI updates.
        </p>
        <pre className="code-block">{`purchaseProgress.pipe(
  observeOn(animationFrameScheduler),
  map(progress => updateProgressBar(progress))
)`}</pre>
      </section>

      <section>
        <h2>Controlling Execution</h2>

        <h3>subscribeOn</h3>
        <p>Controls which scheduler is used for subscription.</p>
        <pre className="code-block">{`heavyComputation.pipe(
  subscribeOn(asyncScheduler), // Run subscription async
  map(data => process(data))
)`}</pre>

        <h3>observeOn</h3>
        <p>Controls which scheduler is used for emissions.</p>
        <pre className="code-block">{`purchase.pipe(
  observeOn(asyncScheduler), // Emit values async
  tap(result => updateUI(result))
)`}</pre>
      </section>

      <section>
        <h2>Timing Operations</h2>

        <h3>Delayed Execution</h3>
        <pre className="code-block">{`// Delay purchase by 2 seconds
purchase.pipe(
  delay(2000, asyncScheduler)
)

// Schedule periodic checks
interval(5000, asyncScheduler).pipe(
  mergeMap(() => checkPurchaseStatus())
)`}</pre>

        <h3>Throttling & Debouncing</h3>
        <pre className="code-block">{`// Throttle purchase attempts
purchaseButton.clicks.pipe(
  throttleTime(1000, asyncScheduler),
  mergeMap(() => iapl.purchase(productId))
)

// Debounce search input
searchInput.pipe(
  debounceTime(300, asyncScheduler),
  distinctUntilChanged(),
  mergeMap(query => searchProducts(query))
)`}</pre>
      </section>

      <section>
        <h2>Custom Schedulers</h2>
        <pre className="code-block">{`class PriorityScheduler extends Scheduler {
  constructor(private priorityQueue: PriorityQueue) {
    super()
  }
  
  schedule(work, delay = 0, state) {
    const action = new PriorityAction(this, work)
    
    if (delay > 0) {
      return action.schedule(state, delay)
    }
    
    this.priorityQueue.enqueue(action, state.priority)
    return action
  }
}

// Use priority scheduler for purchases
const priorityScheduler = new PriorityScheduler(queue)

premiumPurchases.pipe(
  observeOn(priorityScheduler),
  map(purchase => ({ ...purchase, priority: 'high' }))
)`}</pre>
      </section>

      <section>
        <h2>Testing with Schedulers</h2>
        <pre className="code-block">{`import { TestScheduler } from '@openiap/testing'

it('should handle purchase timeout', () => {
  const scheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })
  
  scheduler.run(({ cold, expectObservable }) => {
    const purchase = cold('--a|', { a: purchaseResult })
    const expected = '-----a|'
    
    const result = purchase.pipe(
      delay(3, scheduler)
    )
    
    expectObservable(result).toBe(expected, { a: purchaseResult })
  })
})`}</pre>
      </section>

      <section>
        <h2>Best Practices</h2>
        <ul>
          <li>Use asyncScheduler for I/O operations and API calls</li>
          <li>Use animationFrameScheduler for smooth UI updates</li>
          <li>Avoid synchronous schedulers for heavy computations</li>
          <li>
            Always specify schedulers in unit tests for deterministic behavior
          </li>
          <li>
            Consider custom schedulers for specialized timing requirements
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Scheduler;
