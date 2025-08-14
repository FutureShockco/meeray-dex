<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}>();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const getButtonClasses = (
  variant: string = 'primary',
  size: string = 'md',
  disabled: boolean = false
) => {
  const baseClasses = 'btn btn-primary rounded font-medium transition-colors duration-200';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50',
  };
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses}`;
};
</script>

<template>
  <button
    :class="getButtonClasses(variant, size, disabled)"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template> 