<script setup>
defineProps({
  records: {
    type: Array,
    default: () => []
  },
  today: {
    type: String,
    default: ''
  },
})

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function statusClass(status) {
  if (status === 'Present') return 'status-present'
  if (status === 'Absent') return 'status-absent'
  if (status === 'On Leave') return 'status-leave'
  return 'status-half'
}
</script>

<template>
  <div class="panel log-panel">

    <div class="panel-header">
      <div>
        <h2>Attendance Log</h2>

        <span class="panel-subtitle">
          Recent attendance records
        </span>
      </div>

      <span class="record-count">
        {{ records.length }} records
      </span>
    </div>

    <div
      v-if="!records.length"
      class="empty-state"
    >
      <div class="empty-icon">—</div>

      <strong>No attendance records</strong>

      <p>
        No attendance records were found
        for this date range.
      </p>
    </div>

    <div
      v-else
      class="attendance-table"
    >

      <div class="table-header">
        <span>Date</span>
        <span>Status</span>
        <span>Leave Type</span>
      </div>

      <div
        v-for="record in records"
        :key="record.name"
        class="table-row"
      >

        <div class="date-cell">
          <strong>
            {{ formatDate(record.attendance_date) }}
          </strong>

          <span
            v-if="record.attendance_date === today"
            class="today-tag"
          >
            Today
          </span>
        </div>

        <div>
          <span
            :class="[
              'status-pill',
              statusClass(record.status)
            ]"
          >
            <span class="pill-dot"></span>
            {{ record.status }}
          </span>
        </div>

        <div class="leave-cell">
          {{ record.leave_type || '—' }}
        </div>

      </div>

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

.record-count {
  font-size: 12px;
  color: #667085;
  background: #f5f5fa;
  padding: 6px 10px;
  border-radius: 20px;
}

.attendance-table {
  width: 100%;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  align-items: center;
  column-gap: 12px;
}

.table-header {
  padding-bottom: 11px;
  border-bottom: 1px solid #eef0f5;
  color: #98a2b3;
  font-size: 11px;
  font-weight: 600;
}

.table-row {
  min-height: 57px;
  border-bottom: 1px solid #f0f1f5;
}

.table-row:last-child {
  border-bottom: 0;
}

.date-cell {
  display: flex;
  align-items: center;
  gap: 7px;
}

.date-cell strong {
  font-size: 13px;
  color: #344054;
}

.today-tag {
  font-size: 9px;
  padding: 3px 6px;
  border-radius: 10px;
  background: #eee8ff;
  color: #5b21f3;
  font-weight: 600;
}

.leave-cell {
  color: #667085;
  font-size: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-present {
  background: #e7f8ef;
  color: #16875b;
}

.status-present .pill-dot {
  background: #22c55e;
}

.status-absent {
  background: #ffe9eb;
  color: #dc2626;
}

.status-absent .pill-dot {
  background: #ef4444;
}

.status-leave {
  background: #eee9ff;
  color: #6d28d9;
}

.status-leave .pill-dot {
  background: #7c3aed;
}

.status-half {
  background: #fff5df;
  color: #b45309;
}

.status-half .pill-dot {
  background: #f59e0b;
}

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #f3f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 22px;
  margin-bottom: 12px;
}

.empty-state strong {
  font-size: 14px;
  color: #344054;
}

.empty-state p {
  max-width: 260px;
  margin: 6px 0 0;
  color: #98a2b3;
  font-size: 12px;
}

@media (max-width: 700px) {
  .panel {
    padding: 16px;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1.3fr 1fr .8fr;
  }
}

/* NB_ATTENDANCE_POLISH: enterprise attendance log */

.panel {
  min-width: 0;
  border: 1px solid #e2e8f3;
  border-radius: 13px;
  padding: 22px;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.panel-header {
  margin-bottom: 19px;
}

.panel-header h2 {
  color: #202d46;
  font-size: 17px;
  font-weight: 750;
}

.panel-subtitle {
  color: #8996ab;
}

.record-count {
  background: #f0f3f9;
  color: #62718a;
  font-size: 11px;
  font-weight: 650;
}

.attendance-table {
  width: 100%;
  max-height: 430px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.table-header,
.table-row {
  grid-template-columns: minmax(125px, 1.15fr)
                         minmax(95px, 1fr)
                         minmax(100px, .85fr);
  gap: 12px;
}

.table-header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 0 12px;
  background: #fff;
  border-bottom: 1px solid #e8edf5;
  color: #8491a7;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .35px;
}

.table-row {
  min-height: 53px;
  border-bottom: 1px solid #edf1f7;
}

.table-row:hover {
  background: #fafbff;
}

.date-cell {
  flex-wrap: wrap;
}

.date-cell strong {
  color: #26344d;
  font-size: 12px;
  font-weight: 700;
}

.today-tag {
  background: #eeeaff;
  color: #5546df;
}

.status-pill {
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 10px;
  font-weight: 700;
}

.leave-cell {
  color: #63718a;
  font-size: 11px;
}

@media (max-width: 700px) {
  .panel {
    padding: 16px;
  }

  .attendance-table {
    overflow-x: auto;
  }

  .table-header,
  .table-row {
    min-width: 390px;
  }
}

</style>