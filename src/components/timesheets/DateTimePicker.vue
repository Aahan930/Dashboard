<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },

  label: {
    type: String,
    default: ''
  },

  placeholder: {
    type: String,
    default: 'Select date and time'
  }
})

const emit = defineEmits(['update:modelValue'])

const showPicker = ref(false)

const selectedDate = ref('')
const selectedTime = ref('')


function openPicker() {
  const value = props.modelValue

  if (value) {
    const [date, time] = value.split('T')

    selectedDate.value = date || ''
    selectedTime.value = time || ''
  } else {
    selectedDate.value = ''
    selectedTime.value = ''
  }

  showPicker.value = true
}


function cancelPicker() {
  showPicker.value = false
}


function confirmPicker() {
  if (!selectedDate.value || !selectedTime.value) {
    return
  }

  const value =
    `${selectedDate.value}T${selectedTime.value}`

  emit('update:modelValue', value)

  showPicker.value = false
}


function formatDisplay(value) {
  if (!value) {
    return ''
  }

  const [date, time] = value.split('T')

  if (!date) {
    return ''
  }

  const parts = date.split('-')

  if (parts.length !== 3) {
    return value
  }

  const formattedDate =
    `${parts[2]}-${parts[1]}-${parts[0]}`

  return time
    ? `${formattedDate} ${time}`
    : formattedDate
}


watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      return
    }

    const [date, time] = value.split('T')

    selectedDate.value = date || ''
    selectedTime.value = time || ''
  }
)
</script>


<template>
  <div class="datetime-picker">

    <label v-if="label">
      {{ label }}
    </label>


    <!-- Display field -->
    <button
      type="button"
      class="datetime-field"
      @click="openPicker"
    >

      <span
        v-if="modelValue"
        class="selected-value"
      >
        {{ formatDisplay(modelValue) }}
      </span>

      <span
        v-else
        class="placeholder"
      >
        {{ placeholder }}
      </span>

      <span class="calendar-icon">
        📅
      </span>

    </button>


    <!-- Picker -->
    <div
      v-if="showPicker"
      class="picker-overlay"
    >

      <div
        class="picker-card"
        @click.stop
      >

        <!-- Header -->
        <div class="picker-header">

          <div>
            <h3>Select Date & Time</h3>
            <p>
              Choose the date and time for your Timesheet.
            </p>
          </div>

          <button
            type="button"
            class="close-btn"
            @click="cancelPicker"
          >
            ×
          </button>

        </div>


        <!-- Date -->
        <div class="picker-section">

          <label>
            Date
          </label>

          <input
            v-model="selectedDate"
            type="date"
            class="picker-input"
          />

        </div>


        <!-- Time -->
        <div class="picker-section">

          <label>
            Time
          </label>

          <input
            v-model="selectedTime"
            type="time"
            class="picker-input"
          />

        </div>


        <!-- Preview -->
        <div
          v-if="selectedDate && selectedTime"
          class="preview"
        >
          <span>
            Selected
          </span>

          <strong>
            {{ formatDisplay(
              `${selectedDate}T${selectedTime}`
            ) }}
          </strong>
        </div>


        <!-- Actions -->
        <div class="picker-actions">

          <button
            type="button"
            class="cancel-btn"
            @click="cancelPicker"
          >
            Cancel
          </button>

          <button
            type="button"
            class="ok-btn"
            :disabled="
              !selectedDate ||
              !selectedTime
            "
            @click="confirmPicker"
          >
            OK
          </button>

        </div>

      </div>

    </div>

  </div>
</template>


<style scoped>
.datetime-picker {
  width: 100%;
}

.datetime-picker > label {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}


/* Field */

.datetime-field {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  padding: 10px 12px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: white;
  color: var(--text);

  font: inherit;
  font-size: 13px;

  cursor: pointer;
  text-align: left;
}

.datetime-field:hover {
  border-color: var(--accent);
}

.selected-value {
  color: var(--text);
}

.placeholder {
  color: var(--faint);
}

.calendar-icon {
  flex-shrink: 0;
}


/* Overlay */

.picker-overlay {
  position: fixed;
  inset: 0;

  z-index: 1000;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  background: rgba(20, 22, 59, 0.35);
}


/* Picker */

.picker-card {
  width: min(420px, 100%);

  background: white;

  border-radius: 14px;

  padding: 24px;

  box-shadow:
    0 20px 50px rgba(20, 22, 59, 0.2);
}


/* Header */

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  margin-bottom: 24px;
}

.picker-header h3 {
  margin: 0 0 5px;

  font-size: 18px;
}

.picker-header p {
  margin: 0;

  color: var(--muted);

  font-size: 12px;
}

.close-btn {
  border: none;
  background: transparent;

  color: var(--muted);

  font-size: 24px;

  cursor: pointer;
}


/* Sections */

.picker-section {
  display: flex;
  flex-direction: column;

  gap: 7px;

  margin-bottom: 18px;
}

.picker-section label {
  font-size: 12px;

  color: var(--muted);

  font-weight: 600;
}

.picker-input {
  width: 100%;

  padding: 11px 12px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: white;

  color: var(--text);

  font: inherit;
}

.picker-input:focus {
  outline: none;

  border-color: var(--accent);
}


/* Preview */

.preview {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 12px 14px;

  margin-top: 4px;

  border-radius: 8px;

  background: var(--accent-soft);
}

.preview span {
  color: var(--muted);

  font-size: 12px;
}

.preview strong {
  color: var(--accent-dark);

  font-size: 13px;
}


/* Actions */

.picker-actions {
  display: flex;
  justify-content: flex-end;

  gap: 10px;

  margin-top: 24px;
}

.cancel-btn,
.ok-btn {
  border: none;

  padding: 10px 16px;

  border-radius: 8px;

  font-size: 13px;

  font-weight: 600;

  cursor: pointer;
}

.cancel-btn {
  background: #f1f1f5;

  color: var(--text);
}

.ok-btn {
  background: var(--accent);

  color: white;
}

.ok-btn:hover {
  background: var(--accent-dark);
}

.ok-btn:disabled {
  opacity: 0.5;

  cursor: not-allowed;
}
</style>