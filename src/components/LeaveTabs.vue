<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'All'
  }
})

const emit = defineEmits(['update:modelValue'])

const tabs = ['All', 'Approved', 'Pending', 'Rejected']

function selectTab(tab) {
  emit('update:modelValue', tab)
}
</script>

<template>
  <div class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab"
      :class="{ active: modelValue === tab }"
      @click="selectTab(tab)"
    >
      {{ tab }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  margin-bottom: 0;
}

.tabs button {
  border: 0;
  background: #f3f4f9;
  color: #475467;
  padding: 9px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tabs button:first-child {
  border-radius: 8px 0 0 8px;
}

.tabs button:last-child {
  border-radius: 0 8px 8px 0;
}

.tabs button.active {
  background: #5b21f3;
  color: white;
}

@media (max-width: 600px) {
  .tabs {
    width: 100%;
  }

  .tabs button {
    flex: 1;
    padding: 9px 8px;
  }
}
</style>