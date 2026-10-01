<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'mine'
  }
})

const emit = defineEmits(['update:modelValue'])

function selectTab(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="timesheet-tabs">

    <button
      :class="{ active: modelValue === 'mine' }"
      @click="selectTab('mine')"
    >
      My Timesheets
    </button>

    <button
      :class="{ active: modelValue === 'team' }"
      @click="selectTab('team')"
    >
      Team Timesheets
    </button>

  </div>
</template>

<style scoped>
.timesheet-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.timesheet-tabs button {
  border: none;
  background: transparent;
  padding: 10px 16px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.timesheet-tabs button:hover {
  color: var(--text);
}

.timesheet-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
</style>