export interface Task {
  fn: () => Promise<void>; // The task function that returns a Promise
  priority: number; // Task priority (lower numbers indicate higher priority)
  retries: number; // The current retry count
  maxRetries: number; // The maximum number of retries allowed
  timeout: number | null; // Optional timeout for the task execution (in milliseconds)
  isCancelled: boolean; // Boolean flag to mark if the task has been cancelled
  taskId?: string; // Unique id for identification
}

/**
 * Class: MinHeap
 *
 * A MinHeap data structure used to manage and prioritize tasks based on their priority values.
 * The heap ensures that the task with the lowest priority value (highest priority) is always
 * at the top for efficient retrieval.
 */
class MinHeap {
  private heap: Task[] = []; // Array representing the heap structure

  /**
   * Insert a new task into the heap and ensure the heap property is maintained.
   *
   * @param {Task} task - The task object to insert into the heap.
   */
  insert(task: Task): void {
    this.heap.push(task); // Add the task to the end of the heap
    this.bubbleUp(); // Restore heap property by moving the task up if needed
  }

  /**
   * Remove and return the task with the highest priority (i.e., the minimum priority value).
   *
   * @returns {Task | null} - The task with the minimum priority or null if the heap is empty.
   */
  extractMin(): Task | null {
    if (this.heap.length === 0) return null; // If heap is empty, return null
    if (this.heap.length === 1) return this.heap.pop() || null; // If only one element, pop and return it

    const min = this.heap[0]; // The task with the highest priority (root of heap)
    this.heap[0] = this.heap.pop() as Task; // Replace the root with the last element
    this.bubbleDown(); // Restore heap property by moving the new root down
    return min; // Return the task that was extracted
  }

  /**
   * Peek at the task with the highest priority (lowest priority value) without removing it.
   *
   * The min-heap structure ensures that the task with the lowest priority value (i.e., the highest priority)
   * is always at the root of the heap. This method allows checking what the next task in line is without
   * modifying the heap itself.
   *
   * @returns {Task | null} - The task with the highest priority (min priority) or null if the heap is empty.
   */
  peekMin(): Task | null {
    if (this.heap.length === 0) return null; // If the heap is empty, return null
    return this.heap[0]; // Return the root element (highest priority task) without removing it
  }

  /**
   * Private helper function to maintain the heap property after insertion.
   * Moves the newly added task up the heap to its correct position.
   */
  private bubbleUp(): void {
    let index = this.heap.length - 1; // Start from the last element
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2); // Find the parent index
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break; // Stop if the heap property is satisfied
      // Swap the parent with the child if the child's priority is higher (lower value)
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex; // Move the index to the parent's position and repeat
    }
  }

  /**
   * Private helper function to maintain the heap property after extraction.
   * Moves the root element down the heap to its correct position.
   */
  private bubbleDown(): void {
    let index = 0;
    const length = this.heap.length;

    while (true) {
      const leftChildIndex = 2 * index + 1; // Left child index
      const rightChildIndex = 2 * index + 2; // Right child index
      let smallest = index; // Assume the current index holds the smallest value

      // Check if the left child has a higher priority (lower priority value) than the current smallest
      if (
        leftChildIndex < length &&
        this.heap[leftChildIndex].priority < this.heap[smallest].priority
      ) {
        smallest = leftChildIndex;
      }

      // Check if the right child has a higher priority (lower priority value) than the current smallest
      if (
        rightChildIndex < length &&
        this.heap[rightChildIndex].priority < this.heap[smallest].priority
      ) {
        smallest = rightChildIndex;
      }

      // If the smallest index is still the current index, the heap property is satisfied
      if (smallest === index) break;

      // Swap the current node with the smallest child
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest; // Move the index to the smallest child's position and repeat
    }
  }

  /**
   * Check if the heap is empty.
   *
   * @returns {boolean} - Returns true if the heap is empty, otherwise false.
   */
  isEmpty(): boolean {
    return this.heap.length === 0; // The heap is empty if its length is zero
  }

  /**
   * Find the index of a task in the heap based on the function reference.
   * This is used primarily for canceling a task.
   *
   * @param {() => Promise<void>} fn - The function reference of the task.
   * @returns {number} - The index of the task in the heap or -1 if not found.
   */
  findTaskIndex(fn: () => Promise<void>): number {
    return this.heap.findIndex((task) => task.fn === fn); // Find the task's index based on its function
  }
}

export default MinHeap;
