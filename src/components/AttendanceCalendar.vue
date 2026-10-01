<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  calendar: {
    type: Array,
    default: () => []
  },
  monthLabel: {
    type: String,
    default: ''
  },
  today: {
    type: String,
    default: ''
  },
  joiningDate: {
    type: String,
    default: ''
  },
  loadedFrom: {
    type: String,
    default: ''
  },
  loadedTo: {
    type: String,
    default: ''
  },
  canGoPrevious: {
    type: Boolean,
    default: false
  },
  canGoNext: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['previous', 'next', 'select-date'])

const selectedDate = ref('')

function selectDate(date) {
  if (!date) return

  if (props.today && date > props.today) {
    return
  }

  selectedDate.value = date
  emit('select-date', date)
}

watch(
  () => props.loadedTo,
  value => {
    if (value) {
      selectedDate.value = value
    }
  },
  { immediate: true }
)

const selectedCell = computed(() =>
  props.calendar.find(cell => cell?.iso === selectedDate.value)
)

const dateMessage = computed(() => {
  const date = selectedDate.value

  if (!date) return null

  if (props.joiningDate && date < props.joiningDate) {
    return {
      title: 'Before joining date',
      message: 'You had not joined the company on this date, so no attendance record is available.'
    }
  }

  if (date > props.today) {
    return {
      title: 'Future date',
      message: 'Attendance is not available for future dates.'
    }
  }

  if (!props.joiningDate) {
    return {
      title: 'Joining date unavailable',
      message: 'Your joining date could not be retrieved. Attendance status cannot be fully verified.'
    }
  }

  if (
    !props.loadedFrom ||
    !props.loadedTo ||
    date < props.loadedFrom ||
    date > props.loadedTo
  ) {
    return {
      title: 'Attendance not loaded',
      message: 'This date is outside the selected attendance range. Change the date filters to load its records.'
    }
  }

  const status = selectedCell.value?.status

  return status
    ? {
        title: status,
        message: `Your recorded attendance status for this date is ${status}.`
      }
    : {
        title: 'No attendance record',
        message: 'No attendance record is available for this date.'
      }
})

const dotColor = {
  Present: 'var(--green)',
  Absent: 'var(--red)',
  'Half Day': 'var(--amber)',
  'On Leave': 'var(--violet)'
}
</script>

<template>
  <div class="panel calendar-panel">

    <div class="panel-header">
      <div>
        <h2>{{ monthLabel }}</h2>
        <span class="panel-subtitle">
          Attendance calendar
        </span>
      </div>

      <div class="calendar-actions">
        <button
          class="small-button"
          :disabled="!canGoPrevious"
          @click="$emit('previous')"
        >
          ‹
        </button>

        <button
          class="small-button"
          :disabled="!canGoNext"
          @click="$emit('next')"
        >
          ›
        </button>
      </div>
    </div>

    <div class="calendar">

      <div
        v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
        :key="day"
        class="weekday"
      >
        {{ day }}
      </div>

      <div
        v-for="(cell, index) in calendar"
        :key="index"
        :class="[
          'calendar-day',
          {
            blank: !cell,
            today: cell && cell.iso === today,
            selected: cell && cell.iso === selectedDate,
            'status-present': cell?.status === 'Present',
            'status-absent': cell?.status === 'Absent',
            'status-half': cell?.status === 'Half Day',
            'status-leave': cell?.status === 'On Leave',
            'future-date': cell && props.today && cell.iso > props.today
          }
        ]"
        :role="cell ? 'button' : undefined"
        :tabindex="cell ? 0 : undefined"
        :aria-label="cell ? `${cell.iso}: ${cell.status || 'No loaded status'}` : undefined"
        @click="cell && selectDate(cell.iso)"
        @keydown.enter.prevent="cell && selectDate(cell.iso)"
        @keydown.space.prevent="cell && selectDate(cell.iso)"
      >
        <template v-if="cell">
          <span class="day-number">
            {{ cell.d }}
          </span>

          <span
            v-if="cell.status"
            class="status-dot"
            :style="{ background: dotColor[cell.status] }"
          ></span>
        </template>
      </div>

    </div>

    <section
      v-if="dateMessage"
      class="date-details"
      aria-live="polite"
    >
      <div class="date-details-header">
        <strong>{{ selectedDate }}</strong>
        <button
          type="button"
          class="details-close"
          aria-label="Close attendance details"
          @click="selectedDate = ''"
        >
          ×
        </button>
      </div>

      <h3>{{ dateMessage.title }}</h3>
      <p>{{ dateMessage.message }}</p>
    </section>

    <div class="calendar-legend">
      <span>
        <i class="legend-dot present"></i>
        Present
      </span>

      <span>
        <i class="legend-dot absent"></i>
        Absent
      </span>

      <span>
        <i class="legend-dot half"></i>
        Half Day
      </span>

      <span>
        <i class="legend-dot leave"></i>
        On Leave
      </span>
    </div>

  </div>
</template>

<style scoped>
.panel {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 17px;
  padding: 22px;
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: #111827;
}

.panel-subtitle {
  display: block;
  margin-top: 4px;
  color: #98a2b3;
  font-size: 12px;
}

.calendar-actions {
  display: flex;
  gap: 6px;
}

.small-button {
  width: 32px;
  height: 32px;
  border: 1px solid #e8e8ef;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
  color: #667085;
}

.small-button:hover {
  background: #f4f0ff;
  color: #5b21f3;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.weekday {
  text-align: center;
  color: #98a2b3;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 0;
}

.calendar-day {
  min-height: 42px;
  border-radius: 9px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #344054;
  font-size: 13px;
  position: relative;
}

.calendar-day:hover {
  background: #f7f5ff;
}

.calendar-day:not(.blank) {
  cursor: pointer;
}

.calendar-day:not(.blank):focus-visible {
  outline: 2px solid #5b21f3;
  outline-offset: 2px;
}

.calendar-day.selected:not(.today) {
  background: #ede9fe;
  color: #5b21f3;
}

.date-details {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #ddd6fe;
  border-radius: 12px;
  background: #faf9ff;
}

.date-details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #667085;
  font-size: 12px;
}

.details-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #667085;
  font-size: 22px;
  cursor: pointer;
}

.details-close:hover {
  background: #ede9fe;
}

.date-details h3 {
  margin: 8px 0 6px;
  font-size: 16px;
  color: #344054;
}

.date-details p {
  margin: 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}

.calendar-day.blank {
  pointer-events: none;
}

.calendar-day.today {
  background: #5b21f3;
  color: white;
  font-weight: 700;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.calendar-day.today .status-dot {
  background: white !important;
}

.calendar-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #f0f1f5;
}

.calendar-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #667085;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.legend-dot.present {
  background: #22c55e;
}

.legend-dot.absent {
  background: #ef4444;
}

.legend-dot.half {
  background: #f59e0b;
}

.legend-dot.leave {
  background: #7c3aed;
}

@media (max-width: 700px) {
  .panel {
    padding: 16px;
  }
}

/* NB_ATTENDANCE_POLISH: enterprise calendar */

.panel {
  border: 1px solid #e2e8f3;
  border-radius: 13px;
  padding: 22px;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.panel-header {
  margin-bottom: 22px;
}

.panel-header h2 {
  color: #202d46;
  font-size: 17px;
  font-weight: 750;
}

.panel-subtitle {
  color: #8996ab;
}

.small-button {
  width: 34px;
  height: 34px;
  border-color: #e1e7f0;
  color: #64748b;
}

.small-button:hover {
  background: #eef2ff;
  color: #4f46e5;
}

.calendar {
  gap: 6px;
}

.weekday {
  padding: 7px 0 10px;
  color: #8794a9;
  font-size: 11px;
}

.calendar-day {
  min-height: 46px;
  border: 1px solid transparent;
  border-radius: 9px;
  gap: 4px;
  font-weight: 650;
  transition: border-color .15s, background .15s;
}

.calendar-day.status-present {
  background: #e9f8f0;
  color: #147c52;
}

.calendar-day.status-absent {
  background: #fff0f1;
  color: #c93649;
}

.calendar-day.status-half {
  background: #fff4e2;
  color: #a96813;
}

.calendar-day.status-leave {
  background: #f0ebff;
  color: #6844c8;
}

.calendar-day:not(.blank):hover {
  border-color: #b8c3f6;
  filter: brightness(.98);
}

.calendar-day.selected:not(.today) {
  border: 2px solid #4f46e5;
  box-shadow: 0 0 0 2px #eef2ff;
}

.calendar-day.today {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
}

.calendar-day.today.selected {
  box-shadow: 0 0 0 3px #c7d2fe;
}

.calendar-day.today .status-dot {
  background: white !important;
}

.status-dot {
  width: 5px;
  height: 5px;
}

.calendar-legend {
  gap: 15px;
  margin-top: 21px;
  border-top-color: #edf1f7;
}

.date-details {
  border-color: #dce2fb;
  background: #f8f9ff;
}

.date-details h3 {
  color: #27344e;
}

@media (max-width: 700px) {
  .panel {
    padding: 16px;
  }

  .calendar {
    gap: 3px;
  }

  .calendar-day {
    min-height: 40px;
  }
}


.small-button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.calendar-day.future-date {
  opacity: .35;
  cursor: not-allowed;
}

</style>