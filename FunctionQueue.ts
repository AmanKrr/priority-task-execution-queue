import MinHeap, {Task} from './BinaryHeap';

type EventCallback = (task: Task) => void;

interface TaskOptions {
  fn: () => Promise<void>; // The task function to be executed
  priority?: number; // Optional task priority (higher values get executed first)
  retries?: number; // Optional retry count for the task
  timeout?: number | null; // Optional timeout in milliseconds for the task
  taskId?: string; // Unique id for identification
}

/**
 * Class: FunctionQueue
 *
 * A priority-based function queue system with support for concurrency limits,
 * task retries, timeouts, and dynamic task prioritization. Tasks are managed
 * in a MinHeap for optimized priority-based execution.
 */
class FunctionQueue {
  private queue: MinHeap; // Priority queue (MinHeap) to store tasks
  private runningCount: number; // Tracks the number of running tasks
  private concurrencyLimit: number; // Limits how many tasks can run concurrently
  private isPaused: boolean; // Controls whether the queue is paused
  private maxQueueSize: number; // Maximum number of tasks allowed in the queue
  private eventListeners: {[key: string]: EventCallback[]}; // Stores event listeners for task events
  private runTimeout: NodeJS.Timeout | null = null; // Timeout to control debounce behavior in `run`

  /**
   * Constructor: Initialize the function queue with concurrency and max queue size.
   *
   * @param {number} concurrencyLimit - The maximum number of tasks to run concurrently (default is 1).
   * @param {number} maxQueueSize - Maximum allowed tasks in the queue (default is infinite).
   */
  constructor(concurrencyLimit: number = 1, maxQueueSize: number = Infinity) {
    this.queue = new MinHeap(); // Create a new MinHeap for priority queueing
    this.runningCount = 0; // No tasks running initially
    this.concurrencyLimit = concurrencyLimit; // Set the concurrency limit
    this.isPaused = false; // Queue starts in a running state
    this.maxQueueSize = maxQueueSize; // Set the maximum queue size
    this.eventListeners = {}; // Initialize event listeners object
  }

  /**
   * Enqueue a new task into the queue.
   *
   * @param {TaskOptions} options - The task options including the function, priority, retries, and timeout.
   */
  enqueue({
    fn,
    priority = 0,
    retries = 0,
    timeout = null,
    taskId = new Date().toUTCString(),
  }: TaskOptions): void {
    // Check if the queue has exceeded its maximum size
    if (this.queue['heap'].length >= this.maxQueueSize) {
      console.error("Queue is full. Can't add more tasks.");
      return;
    }

    // Create a new task object and insert it into the priority queue (MinHeap)
    const task: Task = {
      fn, // The task function
      priority, // Task priority (lower numbers have higher priority)
      retries, // Retry count
      maxRetries: retries, // Store max retries
      timeout, // Timeout for the task (optional)
      isCancelled: false, // By default, task is not cancelled
      taskId: taskId || this.generateTaskId(), // Unique id for identification
    };

    this.queue.insert(task); // Insert task into the priority queue

    // If the queue is not paused, start processing tasks
    if (!this.isPaused) {
      this.run();
    }
  }

  /**
   * Cancel a task based on its function reference.
   *
   * @param {() => Promise<void>} fn - The task function to cancel.
   */
  cancel(fn: () => Promise<void>): void {
    // Find the task index using its function reference
    const taskIndex = this.queue.findTaskIndex(fn);
    if (taskIndex > -1) {
      this.queue['heap'].splice(taskIndex, 1); // Remove task from the heap
      console.log('Task canceled');
    }
  }

  /**
   * Main run function to execute tasks from the queue based on priority and concurrency limits.
   */
  async run(): Promise<void> {
    // Prevent further execution if queue is paused or max concurrency is reached
    if (this.isPaused || this.runningCount >= this.concurrencyLimit || this.queue.isEmpty()) return;

    if (this.runTimeout) return; // Debounce to prevent multiple concurrent runs
    this.runTimeout = setTimeout(async () => {
      this.runTimeout = null;

      // Run tasks as long as concurrency limit allows and queue is not empty
      while (this.runningCount < this.concurrencyLimit && !this.queue.isEmpty()) {
        this.runningCount++;
        const task = this.queue.extractMin(); // Extract the highest-priority task

        if (task && !task.isCancelled) {
          this.triggerEvent('taskStart', task); // Emit task start event

          try {
            await this.executeTask(task); // Execute the task (with retries and timeout)
            this.triggerEvent('taskComplete', task); // Emit task complete event
          } catch (error) {
            this.triggerEvent('taskError', task); // Emit task error event
          }
        }
        this.runningCount--; // Decrement the running count after task finishes
      }

      this.run(); // Continue processing the queue if tasks remain
    }, 100); // Debounce timeout to avoid frequent function calls
  }

  /**
   * Execute a task with retry support and optional timeout.
   *
   * @param {Task} task - The task to be executed.
   */
  private async executeTask(task: Task): Promise<void> {
    let attempt = 0;
    while (attempt <= task.maxRetries) {
      attempt++;
      try {
        if (task.timeout) {
          await this.runWithTimeout(task.fn, task.timeout); // Run task with timeout
        } else {
          await task.fn(); // Run task normally
        }
        break; // If task succeeds, break out of retry loop
      } catch (error) {
        if (attempt > task.maxRetries) throw error; // Throw error if max retries exceeded
      }
    }
  }

  /**
   * Run a task with timeout support.
   *
   * @param {() => Promise<void>} fn - The task function to be executed.
   * @param {number} timeout - The timeout in milliseconds.
   * @returns {Promise<void>}
   */
  private runWithTimeout(fn: () => Promise<void>, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Task timed out')), timeout); // Reject if timeout

      fn()
        .then((result) => {
          clearTimeout(timer); // Clear timeout on success
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer); // Clear timeout on failure
          reject(error);
        });
    });
  }

  /**
   * Pause the queue, preventing any new tasks from being started.
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the queue, allowing tasks to be processed again.
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.run();
    }
  }

  /**
   * Adjust the priority of a task dynamically.
   *
   * @param {() => Promise<void>} fn - The function reference of the task to update.
   * @param {number} newPriority - The new priority value for the task.
   */
  adjustPriority(fn: () => Promise<void>, newPriority: number): void {
    // Find the task in the queue by function reference
    const taskIndex = this.queue.findTaskIndex(fn);
    if (taskIndex > -1) {
      const task = this.queue['heap'].splice(taskIndex, 1)[0]; // Remove task from heap
      task.priority = newPriority; // Update priority
      this.queue.insert(task); // Re-insert the task with updated priority
    }
  }

  /**
   * Register an event listener for task events (e.g., taskStart, taskComplete, taskError).
   *
   * @param {string} eventName - The event name (e.g., 'taskStart', 'taskComplete', 'taskError').
   * @param {EventCallback} callback - The callback function to trigger when the event occurs.
   */
  on(eventName: string, callback: EventCallback): void {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Trigger an event to notify registered listeners.
   *
   * @param {string} eventName - The event name.
   * @param {Task} task - The task associated with the event.
   */
  private triggerEvent(eventName: string, task: Task): void {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach((callback) => callback(task));
    }
  }

  /**
   * Get the taskId of the next task to be executed based on priority.
   *
   * This function leverages the `peekMin()` method to retrieve the task that will be executed next
   * (i.e., the task with the highest priority). If a task exists, it returns its `taskId`. If no tasks
   * are present, it returns null.
   *
   * @returns {string | null} - The `taskId` of the next task to be executed or null if the queue is empty.
   */
  getNextTaskId(): string | null {
    const nextTask = this.queue.peekMin(); // Peek at the task with the highest priority (min priority)
    return nextTask ? nextTask.taskId || null : null; // Return taskId or null if no task exists
  }

  /**
   * Generate a unique task ID for each task.
   *
   * This function generates a unique `taskId` by combining the prefix `"task-"` with the current
   * timestamp. The use of the timestamp ensures that each task gets a unique identifier at the
   * moment of its creation.
   *
   * @returns {string} - A unique `taskId` for a task in the format "task-<timestamp>".
   */
  private generateTaskId(): string {
    return `task-${Date.now().toString()}`; // Generate unique ID using current timestamp
  }
}

export default FunctionQueue;
