
<script setup>
import { computed } from 'vue'

const props = defineProps({
  records: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  range: { type: String, default: '7' },
  truncated: { type: Boolean, default: false }
})

const emit = defineEmits(['range', 'retry'])

function timesheetState(t) {
  // Cancelled documents take precedence.
  if (Number(t.docstatus) === 2 || t.status === 'Cancelled') {
    return 'Cancelled'
  }

  const workflowState = t.workflow_state?.trim()

  if (workflowState) {
    if (workflowState === 'Pending Approval') return 'Pending'
    return workflowState
  }

  // Fallback when workflow_state is unavailable.
  if (Number(t.docstatus) === 1 || t.status === 'Submitted') {
    return 'Approved'
  }

  return 'Draft'
}

const stats = computed(() => {
  const result = {
    total: props.records.length,
    hours: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0
  }

  props.records.forEach(t => {
    result.hours += Number(t.total_hours || 0)

    switch (timesheetState(t)) {
      case 'Draft':
        result.draft++
        break
      case 'Pending':
        result.pending++
        break
      case 'Approved':
        result.approved++
        break
      case 'Rejected':
        result.rejected++
        break
      case 'Cancelled':
        result.cancelled++
        break
    }
  })

  return result
})

const leaders = computed(() => {
  const byEmployee = new Map()

  props.records.forEach(t => {
    const id = t.employee || 'unknown'

    const previous = byEmployee.get(id) || {
      id,
      name: t.employee_name || id,
      hours: 0,
      count: 0
    }

    previous.hours += Number(t.total_hours || 0)
    previous.count++

    byEmployee.set(id, previous)
  })

  return [...byEmployee.values()]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)
})
</script>

<template>
  <section class="panel">
    <div class="head">
      <div>
        <h3>Organization timesheets</h3>
        <p>Work-hour records for your selected period</p>
      </div>

      <div class="filters" aria-label="Timesheet period">
        <button
          v-for="option in [
            { id: '7', text: '7 days' },
            { id: '30', text: '30 days' },
            { id: 'all', text: 'All time' }
          ]"
          :key="option.id"
          :class="{ active: range === option.id }"
          @click="emit('range', option.id)"
        >
          {{ option.text }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="message">
      Loading timesheets…
    </div>

    <div v-else-if="error" class="message error">
      {{ error }}
      <button @click="emit('retry')">Retry</button>
    </div>

    <template v-else>
      <div class="metrics">
        <div>
          <small>Timesheets</small>
          <strong>{{ stats.total }}</strong>
        </div>

        <div>
          <small>Total hours</small>
          <strong>{{ stats.hours.toFixed(1) }}</strong>
        </div>

        <div>
          <small>Draft</small>
          <strong>{{ stats.draft }}</strong>
        </div>

        <div>
          <small>Pending approval</small>
          <strong>{{ stats.pending }}</strong>
        </div>

        <div>
          <small>Approved</small>
          <strong>{{ stats.approved }}</strong>
        </div>

        <div>
          <small>Rejected</small>
          <strong>{{ stats.rejected }}</strong>
        </div>

        <div>
          <small>Cancelled</small>
          <strong>{{ stats.cancelled }}</strong>
        </div>
      </div>

      <p v-if="truncated" class="warning">
        Showing the first 500 timesheets. Counts and hours may be
        incomplete; add pagination for larger organizations.
      </p>

      <div class="subhead">
        <h4>Employee-wise hours</h4>
        <span>Top 5 by recorded hours</span>
      </div>

      <p v-if="!leaders.length" class="message">
        No timesheets found for this period.
      </p>

      <div
        v-for="person in leaders"
        :key="person.id"
        class="person"
      >
        <div>
          <strong>{{ person.name }}</strong>
          <small>{{ person.count }} timesheet(s)</small>
        </div>

        <b>{{ person.hours.toFixed(1) }} hrs</b>
      </div>

      <p class="footnote">
        Hours include all statuses, including drafts and cancelled
        records. Status counts use workflow states when available.
      </p>
    </template>
  </section>
</template>

<style scoped>
.panel {
  background: var(--card, #fff);
  border: 1px solid var(--border, #e5e6f0);
  border-radius: 14px;
  padding: 22px;
  box-shadow: var(--shadow, 0 6px 18px #171b3410);
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.head h3 {
  font-size: 17px;
  margin: 0 0 5px;
}

.head p,
.footnote {
  font-size: 11px;
  color: var(--muted, #666a85);
  margin: 0;
}

.filters {
  display: flex;
  background: #f2f2fb;
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
}

.filters button {
  border: 0;
  background: transparent;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 11px;
  color: #666a85;
  cursor: pointer;
}

.filters button.active {
  background: #4f46e5;
  color: #fff;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 10px;
  margin: 20px 0;
}

.metrics > div {
  background: #f8f9ff;
  border: 1px solid #eff0fa;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metrics small {
  color: #666a85;
  font-size: 11px;
}

.metrics strong {
  font-size: 23px;
  color: #29235f;
}

.subhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #edf0f6;
  padding-top: 17px;
}

.subhead h4 {
  font-size: 13px;
  margin: 0;
}

.subhead span {
  font-size: 11px;
  color: #666a85;
}

.person {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f2f6;
  font-size: 12px;
}

.person > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.person small {
  color: #666a85;
}

.person b {
  color: #4f46e5;
}

.message {
  font-size: 12px;
  color: #666a85;
  padding: 18px 0;
}

.error,
.warning {
  color: #b91c1c;
}

.warning {
  font-size: 11px;
  background: #fff7ed;
  padding: 10px;
  border-radius: 8px;
}

.message button {
  margin-left: 10px;
}

.footnote {
  margin-top: 14px;
  line-height: 1.5;
}
</style>