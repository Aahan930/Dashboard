
<script setup>
import { ref, onMounted } from 'vue'
import api, { errMsg } from '../../api'

const deadlines = ref([])
const loading = ref(false)
const error = ref('')

async function refresh() {
  if (loading.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await api.get(
      '/api/method/hr_portal_custom.missing_timesheet.my_timesheet_deadlines'
    )

    deadlines.value = response.data.message?.deadlines || []
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load timesheet reminders'
    )
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  )
}

function reminderLabel(item) {
  if (item.status === 'Rejected') {
    return 'Rejected timesheet — submit again'
  }

  if (item.status === 'Draft') {
    return 'Draft timesheet — submit'
  }

  return 'Missing timesheet'
}

function deadlineLabel(item) {
  if (item.overdue) {
    return 'Deadline passed'
  }

  if (item.days_remaining === 1) {
    return '1 day remaining'
  }

  return `${item.days_remaining} days remaining`
}

defineExpose({ refresh })

onMounted(refresh)
</script>

<template>
  <section class="deadline-panel">
    <header class="deadline-header">
      <div class="heading-content">
        <div class="heading-label">
          TIMESHEET TRACKING
        </div>

        <h2>Timesheet reminders</h2>

        <p>
          Submit missing timesheets before the
          3-day deadline.
        </p>
      </div>

      <div class="deadline-header-actions">
        <span
          v-if="deadlines.length"
          class="deadline-count"
        >
          {{ deadlines.length }} active
        </span>

        <button
        type="button"
        class="deadline-refresh-button"
        :disabled="loading"
        aria-label="Refresh timesheet reminders"
        @click="refresh"
      >
        <svg
          class="refresh-icon"
          :class="{ spinning: loading }"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M20 11a8 8 0 0 0-14.5-4.7L3 9"
          />
          <path d="M3 4v5h5" />
          <path
            d="M4 13a8 8 0 0 0 14.5 4.7L21 15"
          />
          <path d="M21 20v-5h-5" />
        </svg>

        <span>
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </span>
      </button>
      </div>
    </header>

    <div
      v-if="loading && !deadlines.length"
      class="state-message"
    >
      Checking timesheet deadlines...
    </div>

    <div
      v-else-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!deadlines.length"
      class="all-clear"
    >
      <span class="clear-icon">✓</span>

      <div>
        <strong>You're all caught up</strong>
        <p>
          No missing timesheets in the last 14 days.
        </p>
      </div>
    </div>

    <div
      v-else
      class="reminder-list"
      :aria-busy="loading"
    >
      <article
        v-for="item in deadlines"
        :key="item.date"
        class="reminder"
        :class="{ overdue: item.overdue }"
      >
        <div class="reminder-content">
          <strong class="reminder-date">
            {{ formatDate(item.date) }}
          </strong>

          <p>
            {{ reminderLabel(item) }}
          </p>
        </div>

        <span
          class="deadline-badge"
          :class="{ 'badge-overdue': item.overdue }"
        >
          {{ deadlineLabel(item) }}
        </span>
      </article>
    </div>

    <footer class="deadline-footer">
      <span class="info-icon" aria-hidden="true">
        i
      </span>

      <p>
        Missing timesheets may result in automatic
        Absent marking after the grace period.
        Approved leave and holidays are exempt.
      </p>
    </footer>
  </section>
</template>


<style scoped>
.deadline-panel {
  width: 100%;
  margin-bottom: 20px;
  padding: 20px;

  border: 1px solid #e5eaf2;
  border-radius: 16px;

  background: #ffffff;

  box-shadow: 0 4px 14px rgba(25, 39, 67, .035);
  box-sizing: border-box;
}

.deadline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  margin-bottom: 16px;
}

.heading-content {
  min-width: 0;
}

.heading-label {
  margin-bottom: 5px;

  color: #6558df;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.3px;
}

.heading-content h2 {
  margin: 0;

  color: #182744;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -.25px;
}

.heading-content p {
  margin: 4px 0 0;

  color: #7d8aa1;
  font-size: 11px;
  line-height: 1.5;
}

.deadline-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.deadline-count {
  display: inline-flex;
  align-items: center;

  min-height: 27px;
  padding: 5px 9px;

  border-radius: 8px;

  background: #f5f6fb;
  color: #69758a;

  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.deadline-panel .deadline-refresh-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;

  margin: 0;
  padding: 0;

  border: 1px solid #e1e6ef;
  border-radius: 8px;

  background: #ffffff;
  color: #647189;

  box-shadow: none;
  cursor: pointer;

  transition:
    background .18s ease,
    border-color .18s ease,
    color .18s ease;
}

.deadline-panel .deadline-refresh-button:hover:not(:disabled) {
  background: #f6f7fb;
  border-color: #d2d8e4;
  color: #5146d9;
}

.deadline-panel .deadline-refresh-button span {
  display: none;
}

.deadline-panel .deadline-refresh-button .refresh-icon {
  width: 15px;
  height: 15px;
  color: currentColor;
}

/* Reminder rows */

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.reminder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;

  min-height: 56px;
  padding: 11px 13px;

  border: 1px solid #eceff4;
  border-radius: 10px;

  background: #fbfcfe;
}

.reminder.overdue {
  border-color: #f5d9dd;
  background: #fff7f8;
}

.reminder-content {
  min-width: 0;
}

.reminder-date {
  display: block;

  color: #25324b;
  font-size: 12px;
  font-weight: 700;
}

.reminder-content p {
  margin: 3px 0 0;

  overflow: hidden;
  color: #7b879b;

  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deadline-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-height: 26px;
  padding: 5px 9px;

  border-radius: 8px;

  background: #fff4d3;
  color: #8a5c0a;

  font-size: 10px;
  font-weight: 750;
  white-space: nowrap;
}

.badge-overdue {
  background: #ffe9ec;
  color: #c24156;
}

/* States */

.state-message {
  padding: 22px 10px;

  color: #718096;
  font-size: 12px;
  text-align: center;
}

.error-message {
  padding: 12px 13px;

  border: 1px solid #f3d4d9;
  border-radius: 9px;

  background: #fff7f8;
  color: #be123c;

  font-size: 11px;
}

.all-clear {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 13px;

  border: 1px solid #d9f1e3;
  border-radius: 10px;

  background: #f7fcf9;
}

.clear-icon {
  display: grid;
  place-items: center;

  width: 28px;
  height: 28px;

  flex-shrink: 0;

  border-radius: 8px;

  background: #e6f8ef;
  color: #139c67;

  font-size: 14px;
  font-weight: 700;
}

.all-clear strong {
  color: #26364f;
  font-size: 11px;
}

.all-clear p {
  margin: 2px 0 0;

  color: #7f8ba0;
  font-size: 10px;
}

/* Footer */

.deadline-footer {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  margin-top: 13px;
  padding-top: 11px;

  border-top: 1px solid #edf0f5;
}

.deadline-footer .info-icon {
  display: grid;
  place-items: center;

  width: 15px;
  height: 15px;

  flex-shrink: 0;

  border: 1px solid #cbd5e1;
  border-radius: 50%;

  color: #8793a7;
  font-size: 9px;
  font-weight: 700;
}

.deadline-footer p {
  margin: 0;

  color: #8a96aa;
  font-size: 9px;
  line-height: 1.5;
}

@media (max-width: 700px) {
  .deadline-panel {
    padding: 16px;
  }

  .deadline-header {
    align-items: flex-start;
  }

  .deadline-count {
    display: none;
  }

  .reminder {
    min-height: 52px;
    padding: 10px;
  }

  .deadline-footer p {
    font-size: 9px;
  }
}
</style>
