import { ref, computed } from 'vue'

export interface Toast {
    id: string
    type: 'success' | 'error' | 'warning' | 'info' | 'loading'
    title: string
    message?: string
    duration?: number
    progress?: number // 0-100 for progress bar
    showProgress?: boolean
    link?: {
        text: string
        url: string
    }
    autoClose?: boolean
}

// Module-level state for global toasts
const toasts = ref<Toast[]>([])
let toastIdCounter = 0

export const useToast = () => {
    const addToast = (toast: Omit<Toast, 'id'>): string => {
        const id = `toast_${Date.now()}_${toastIdCounter++}`
        const newToast: Toast = {
            id,
            duration: 5000,
            autoClose: true,
            ...toast,
        }

        toasts.value.push(newToast)

        // Auto-remove after duration if autoClose is true
        if (newToast.autoClose && newToast.duration) {
            setTimeout(() => {
                removeToast(id)
            }, newToast.duration)
        }

        return id
    }

    const removeToast = (id: string) => {
        const index = toasts.value.findIndex(t => t.id === id)
        if (index > -1) {
            toasts.value.splice(index, 1)
        }
    }

    const updateToast = (id: string, updates: Partial<Toast>) => {
        const toast = toasts.value.find(t => t.id === id)
        if (toast) {
            Object.assign(toast, updates)
        }
    }

    const clearAll = () => {
        toasts.value = []
    }

    // Convenience methods
    const success = (title: string, message?: string, duration?: number) => {
        return addToast({ type: 'success', title, message, duration })
    }

    const error = (title: string, message?: string, duration?: number) => {
        return addToast({ type: 'error', title, message, duration: duration || 7000 })
    }

    const warning = (title: string, message?: string, duration?: number) => {
        return addToast({ type: 'warning', title, message, duration })
    }

    const info = (title: string, message?: string, duration?: number) => {
        return addToast({ type: 'info', title, message, duration })
    }

    const loading = (title: string, message?: string) => {
        return addToast({
            type: 'loading',
            title,
            message,
            autoClose: false,
            showProgress: true,
            progress: 0
        })
    }

    // Transaction-specific toast with auto-progress
    const transaction = (title: string, txId?: string) => {
        const id = addToast({
            type: 'loading',
            title,
            message: 'Processing transaction...',
            autoClose: false,
            showProgress: true,
            progress: 0,
            link: txId ? {
                text: 'View TX',
                url: `https://explorer.meeray.com/tx/${txId}`
            } : undefined
        })

        // Animate progress to 90% over 30 seconds
        const startTime = Date.now()
        const duration = 30000 // 30 seconds
        const maxAutoProgress = 90 // Stop at 90%, final 10% only comes from actual status

        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / duration) * maxAutoProgress, maxAutoProgress)

            updateToast(id, { progress })

            // Stop animation when we reach max or toast is removed
            if (progress >= maxAutoProgress || !toasts.value.find(t => t.id === id)) {
                clearInterval(progressInterval)
            }
        }, 100) // Update every 100ms for smooth animation

        return id
    }

    return {
        toasts: computed(() => toasts.value),
        addToast,
        removeToast,
        updateToast,
        clearAll,
        success,
        error,
        warning,
        info,
        loading,
        transaction,
    }
}
