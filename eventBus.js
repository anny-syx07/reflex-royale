/**
 * EventBus - Lightweight pub/sub event system
 * Enables loose coupling between components
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function (can be async)
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.off(event, callback); // Return unsubscribe function
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    /**
     * Emit an event (fire-and-forget, non-blocking)
     * @param {string} event - Event name
     * @param {Object} data - Event payload
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
            // Execute async to not block the main flow
            setImmediate(async () => {
                try {
                    await cb(data);
                } catch (error) {
                    console.error(`[EventBus] Error in ${event} handler:`, error.message);
                }
            });
        });
    }

    /**
     * Emit and wait for all handlers to complete
     * @param {string} event - Event name
     * @param {Object} data - Event payload
     */
    async emitAsync(event, data) {
        const callbacks = this.listeners.get(event) || [];
        await Promise.all(callbacks.map(cb => cb(data).catch(err => {
            console.error(`[EventBus] Error in ${event} handler:`, err.message);
        })));
    }
}

// Singleton instance
module.exports = new EventBus();
