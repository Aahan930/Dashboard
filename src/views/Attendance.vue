<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

import MarkAttendance from './MarkAttendance.vue'
import AttendanceStats from '../components/AttendanceStats.vue'
import AttendanceCalendar from '../components/AttendanceCalendar.vue'
import AttendanceLog from '../components/AttendanceLog.vue'


const router = useRouter()

const email = localStorage.getItem('user')
const today = new Date().toLocaleDateString('en-CA')
const monthStart = today.slice(0, 8) + '01'

const from = ref(monthStart)
const to = ref(today)

const records = ref([])
const selectedStatus = ref('')
const selectedAttendanceDate = ref(today)

const selectedRecords = computed(() =>
  records.value
    .filter(record => record.status === selectedStatus.value)
    .sort((a, b) =>
      b.attendance_date.localeCompare(a.attendance_date)
    )
)

function selectStatus(status) {
  selectedStatus.value =
    selectedStatus.value === status ? '' : status
}
const employee = ref('')
const joiningDate = ref('')
const error = ref('')
const loading = ref(true)

const monthCursor = ref(new Date(today + 'T00:00:00'))

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

function setRange(f, t) {
  from.value = f
  to.value = t

  const anchor = new Date(`${t}T00:00:00`)

  if (!Number.isNaN(anchor.getTime())) {
    monthCursor.value = anchor
    selectedAttendanceDate.value = t
  }
}

async function load() {
  error.value = ''

  if (from.value > to.value) {
    error.value = 'From date must be before To date.'
    return
  }

  loading.value = true

  try {
    if (!employee.value) {
      const emp = await api.get('/api/resource/Employee', {
        params: {
          filters: JSON.stringify([
            ['user_id', '=', email]
          ]),
          fields: JSON.stringify(['name', 'date_of_joining'])
        }
      })

      employee.value = emp.data.data[0]?.name
      joiningDate.value = emp.data.data[0]?.date_of_joining || ''

      if (!employee.value) {
        error.value = 'No employee record linked'
        return
      }
    }


    const res = await api.get('/api/resource/Attendance', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee.value],
          ['attendance_date', '>=', from.value],
          ['attendance_date', '<=', to.value],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify([
          'name',
          'attendance_date',
          'status',
          'leave_type'
        ]),
        order_by: 'attendance_date desc',
        limit_page_length: 500
      }
    })

    records.value = res.data.data

  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load attendance')
    }
  } finally {
    loading.value = false
  }
}
function refresh(){
  console.log("REFRESH BUTTON CLICKED")
  load()
}

const counted = computed(() =>
  records.value.filter(r => r.attendance_date <= today)
)

const presentCount = computed(() =>
  records.value.filter(r => r.status === 'Present').length
)

const absentCount = computed(() =>
  records.value.filter(r => r.status === 'Absent').length
)

const leaveCount = computed(() =>
  records.value.filter(r => r.status === 'On Leave').length
)

const halfDayCount = computed(() =>
  records.value.filter(r => r.status === 'Half Day').length
)

const percentage = computed(() => {
  const eligible = counted.value.filter(
    r => ['Present', 'Absent', 'Half Day'].includes(r.status)
  )

  if (!eligible.length) return 0

  const present = eligible.filter(
    r => r.status === 'Present'
  ).length

  const halfDay = eligible.filter(
    r => r.status === 'Half Day'
  ).length

  return Math.round(
    ((present + halfDay * 0.5) / eligible.length) * 1000
  ) / 10
})

const byDate = computed(() => {
  const result = {}

  records.value.forEach(record => {
    result[record.attendance_date] = record.status
  })

  return result
})

const calendar = computed(() => {
  const year = monthCursor.value.getFullYear()
  const month = monthCursor.value.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []

  for (let i = 0; i < firstDay; i++) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso =
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    cells.push({
      d: day,
      iso,
      status: byDate.value[iso]
    })
  }

  return cells
})

const monthLabel = computed(() =>
  monthCursor.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
)

const canGoPrevious = computed(() => {
  if (!joiningDate.value) return true

  const current = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth(),
    1
  )

  const joining = new Date(`${joiningDate.value}T00:00:00`)
  const joiningMonth = new Date(
    joining.getFullYear(),
    joining.getMonth(),
    1
  )

  return current > joiningMonth
})

const canGoNext = computed(() => {
  const current = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth(),
    1
  )

  const systemToday = new Date()
  const currentSystemMonth = new Date(
    systemToday.getFullYear(),
    systemToday.getMonth(),
    1
  )

  return current < currentSystemMonth
})

function shiftMonth(amount) {
  if (amount < 0 && !canGoPrevious.value) return
  if (amount > 0 && !canGoNext.value) return

  const date = new Date(monthCursor.value)
  date.setMonth(date.getMonth() + amount)

  const year = date.getFullYear()
  const month = date.getMonth()

  const firstDate =
    `${year}-${String(month + 1).padStart(2, '0')}-01`

  const lastDay = new Date(year, month + 1, 0).getDate()

  const lastDate =
    `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const isCurrentMonth =
    year === Number(today.slice(0, 4)) &&
    month + 1 === Number(today.slice(5, 7))

  const rangeEnd = isCurrentMonth ? today : lastDate

  monthCursor.value = new Date(year, month, 1)
  from.value = firstDate
  to.value = rangeEnd
  selectedAttendanceDate.value = rangeEnd
}

watch([from, to], load)

onMounted(load)
</script>

<template>
  <div class="attendance-page">

    <header class="attendance-enterprise-header">
      <div>
        <span class="attendance-eyebrow">EMPLOYEE SELF SERVICE</span>
        <h1>Attendance</h1>
        <p>Track your daily attendance, review your records and manage corrections.</p>
      </div>

      <router-link
        to="/attendance/correction"
        class="attendance-correction-link"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4z"/>
        </svg>
        Attendance correction
      </router-link>
    </header>

    <MarkAttendance
      embedded
      :selected-date="selectedAttendanceDate"
      @marked="refresh"
    />

    <section class="filter-card">
      <div class="date-field">
        <label>From</label>
        <input
          type="date"
          v-model="from"
          :max="to"
        />
      </div>

      <div class="date-field">
        <label>To</label>
        <input
          type="date"
          v-model="to"
          :min="from"
        />
      </div>

      <div class="quick-filters">
        <button
          class="quick-button"
          :class="{ active: from === monthStart && to === today }"
          @click="setRange(monthStart, today)"
        >
          This month
        </button>

        <button
          class="quick-button"
          @click="setRange(daysAgo(6), today)"
        >
          Last 7 days
        </button>

        <button
          class="quick-button"
          @click="setRange(daysAgo(29), today)"
        >
          Last 30 days
        </button>
      </div>
    </section>

    <div v-if="error" class="error-box">
      {{ error }}
    </div>

    <div v-if="loading" class="loading-box">
      <div class="loading-spinner"></div>
      <span>Loading attendance...</span>
    </div>

    <template v-else-if="!error">

      <AttendanceStats
        :percentage="percentage"
        :recorded-days="counted.length"
        :present="presentCount"
        :absent="absentCount"
        :leave="leaveCount"
        @select="selectStatus"
      />

      <section
        v-if="selectedStatus"
        class="status-details"
        aria-live="polite"
      >
        <div class="status-details-header">
          <div>
            <span class="status-details-eyebrow">
              ATTENDANCE DETAILS
            </span>

            <h2>{{ selectedStatus }}</h2>

            <p>
              {{ selectedRecords.length }}
              matching record(s) in the selected date range
            </p>
          </div>

          <button
            type="button"
            class="status-details-close"
            aria-label="Close attendance details"
            @click="selectedStatus = ''"
          >
            ×
          </button>
        </div>

        <div
          v-if="!selectedRecords.length"
          class="status-details-empty"
        >
          No {{ selectedStatus.toLowerCase() }}
          records found for the selected date range.
        </div>

        <div
          v-else
          class="status-details-table-wrap"
        >
          <table class="status-details-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Leave Type</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="record in selectedRecords"
                :key="record.name"
              >
                <td>{{ record.attendance_date }}</td>

                <td>
                  <span class="status-details-badge">
                    {{ record.status }}
                  </span>
                </td>

                <td>{{ record.leave_type || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="main-grid">

        <AttendanceCalendar
          :calendar="calendar"
          :month-label="monthLabel"
          :today="today"
          :joining-date="joiningDate"
          :loaded-from="from"
          :loaded-to="to"
          :can-go-previous="canGoPrevious"
          :can-go-next="canGoNext"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @select-date="selectedAttendanceDate = $event"
        />

        <AttendanceLog
          :records="records"
          :today="today"
        />

      </section>



      

    </template>

  </div>
</template>

<style scoped>
.status-details {
  margin-bottom: 22px;
  padding: 22px;
  background: #fff;
  border: 1px solid #ddd6fe;
  border-radius: 16px;
  box-sizing: border-box;
}

.status-details-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.status-details-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  color: #7c3aed;
}

.status-details-header h2 {
  margin: 6px 0;
  font-size: 21px;
  color: #111827;
}

.status-details-header p {
  margin: 0;
  font-size: 13px;
  color: #667085;
}

.status-details-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
  border: 1px solid #e8e8ef;
  border-radius: 8px;
  background: #fff;
  color: #667085;
  font-size: 22px;
  cursor: pointer;
}

.status-details-close:hover {
  background: #f4f0ff;
}

.status-details-empty {
  padding: 25px;
  border-radius: 10px;
  background: #f8f9fd;
  color: #667085;
  text-align: center;
  font-size: 14px;
}

.status-details-table-wrap {
  max-height: 350px;
  overflow: auto;
}

.status-details-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.status-details-table th,
.status-details-table td {
  padding: 13px 12px;
  border-bottom: 1px solid #eef0f6;
}

.status-details-table th {
  color: #667085;
  font-weight: 600;
}

.status-details-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  background: #f0edff;
  color: #5b21f3;
  font-size: 12px;
  font-weight: 600;
}


.attendance-page {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  color: #111827;
}

.page-header p {
  margin: 7px 0 0;
  color: #667085;
  font-size: 14px;
}

.primary-button {
  border: 0;
  background: #5b21f3;
  color: white;
  border-radius: 10px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-button:hover {
  background: #4c1dce;
}

.filter-card {
  background: white;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 22px;
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  border: 1px solid #eef0f6;
}

.date-field label {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #667085;
}

.date-field input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e1e4ec;
  border-radius: 9px;
  background: white;
  color: #111827;
  font-family: inherit;
  outline: none;
}

.date-field input:focus {
  border-color: #6d3df5;
  box-shadow: 0 0 0 3px rgba(109, 61, 245, 0.08);
}

.quick-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-button {
  height: 42px;
  padding: 0 15px;
  border: 0;
  border-radius: 9px;
  background: #f3f4f9;
  color: #475467;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.quick-button:hover {
  background: #ebe8ff;
  color: #5b21f3;
}

.error-box {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #dc2626;
  padding: 14px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.loading-box {
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #667085;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #ddd6fe;
  border-top-color: #5b21f3;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(360px, .9fr) minmax(500px, 1.4fr);
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 1100px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    gap: 15px;
    flex-direction: column;
  }

  .filter-card {
    align-items: stretch;
  }

  .quick-filters {
    width: 100%;
  }

  .quick-button {
    flex: 1;
  }
}

/* NestorBird enterprise attendance */

.attendance-page {
  width: 100%;
  max-width: none;
  min-width: 0;
  margin: 0;
  padding: 32px clamp(20px, 3vw, 48px) 56px;
  box-sizing: border-box;
  color: #202d46;
}

.attendance-enterprise-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.attendance-eyebrow {
  display: block;
  margin-bottom: 9px;
  color: #7b88a0;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.4px;
}

.attendance-enterprise-header h1 {
  margin: 0;
  color: #202d46;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -1px;
  line-height: 1.2;
}

.attendance-enterprise-header p {
  margin: 9px 0 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

.attendance-correction-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 50px;
  padding: 12px 22px;
  border: 1px solid #dc2626;
  border-radius: 11px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.25);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.attendance-correction-link:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-color: #b91c1c;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 9px 20px rgba(220, 38, 38, 0.32);
}

.attendance-correction-link:active {
  transform: translateY(0);
  box-shadow: 0 4px 11px rgba(220, 38, 38, 0.22);
}

.attendance-correction-link svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}


/* Date filters */

.attendance-page .filter-card {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin: 20px 0 24px;
  padding: 20px 22px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(23, 35, 59, .035);
}

.attendance-page .date-field label {
  margin-bottom: 8px;
  color: #66758d;
  font-size: 11px;
  font-weight: 700;
}

.attendance-page .date-field input {
  min-width: 150px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  background: #fff;
  color: #26334b;
  font-size: 12px;
}

.attendance-page .date-field input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px #eef2ff;
}

.attendance-page .quick-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.attendance-page .quick-button {
  height: 40px;
  padding: 0 14px;
  border: 1px solid #e5eaf2;
  border-radius: 8px;
  background: #f8fafc;
  color: #53627a;
  font-size: 12px;
  font-weight: 650;
}

.attendance-page .quick-button.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.18);
}

.attendance-page .quick-button:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

/* Calendar and attendance log layout */

.attendance-page .main-grid {
  display: grid;
  grid-template-columns:
    minmax(320px, 0.9fr)
    minmax(0, 1.35fr);
  align-items: start;
  gap: 20px;
  margin-top: 24px;
}

.attendance-page .main-grid > * {
  min-width: 0;
}

/* Clicked statistic details */

.attendance-page .status-details {
  margin: 22px 0;
  padding: 24px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(23, 35, 59, .035);
}

.attendance-page .status-details-eyebrow {
  color: #6366f1;
  font-size: 10px;
  letter-spacing: 1.3px;
}

.attendance-page .status-details-header h2 {
  color: #26334b;
  font-size: 19px;
}

.attendance-page .status-details-badge {
  border-radius: 7px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
}

.attendance-page .status-details-close:hover {
  background: #eef2ff;
}

.attendance-page .loading-spinner {
  border-color: #e0e7ff;
  border-top-color: #4f46e5;
}

@media (max-width: 1150px) {
  .attendance-page .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .attendance-page {
    padding: 22px 16px 36px;
  }

  .attendance-enterprise-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .attendance-enterprise-header h1 {
    font-size: 25px;
  }

  .attendance-correction-link {
    width: 100%;
  }

  .attendance-page .filter-card {
    align-items: stretch;
    padding: 16px;
  }

  .attendance-page .date-field {
    flex: 1 1 140px;
  }

  .attendance-page .date-field input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .attendance-page .quick-filters {
    width: 100%;
  }

  .attendance-page .quick-button {
    flex: 1;
  }

  .attendance-page .status-details {
    padding: 16px;
  }
}

</style>
