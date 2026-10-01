
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../../api'

import HRStats from './HRStats.vue'
import HRAttendance from './HRAttendance.vue'
import HRLeaves from './HRLeaves.vue'
import HRTimesheets from './HRTimesheets.vue'
import HRDepartments from './HRDepartments.vue'

const router = useRouter()
const email = localStorage.getItem('user')

const today = new Date().toLocaleDateString('en-CA')

const weekEndDate = new Date()
weekEndDate.setDate(weekEndDate.getDate() + 6)
const weekEnd = weekEndDate.toLocaleDateString('en-CA')

const employees = ref([])
const attendance = ref([])
const leaves = ref([])
const timesheets = ref([])

const loading = ref(true)
const timesheetLoading = ref(false)
const timesheetError = ref('')
const timesheetRange = ref('7')
const timesheetTruncated = ref(false)

const error = ref('')
const success = ref('')
const busy = ref('')
const selected = ref(null)

const state = l => l.workflow_state || l.status

const open = id =>
  id && router.push(`/hr/employee/${encodeURIComponent(id)}`)

const activeIds = computed(
  () => new Set(employees.value.map(e => e.name))
)

const todayRecords = computed(
  () => attendance.value.filter(a => activeIds.value.has(a.employee))
)

const markedIds = computed(
  () => new Set(todayRecords.value.map(a => a.employee))
)

const presentList = computed(
  () => todayRecords.value.filter(a =>
    ['Present', 'Half Day'].includes(a.status)
  )
)

const onLeaveList = computed(
  () => todayRecords.value.filter(a => a.status === 'On Leave')
)

const notMarked = computed(
  () => employees.value.filter(e => !markedIds.value.has(e.name))
)

const pending = computed(
  () => leaves.value.filter(l =>
    ['Pending', 'Open'].includes(state(l))
  )
)

const thisWeek = computed(
  () => leaves.value.filter(l =>
    state(l) === 'Approved' &&
    l.from_date <= weekEnd &&
    l.to_date >= today
  )
)

const byDept = computed(() => {
  const counts = new Map()

  employees.value.forEach(e => {
    const name = e.department || 'No department'
    counts.set(name, (counts.get(name) || 0) + 1)
  })

  return [...counts.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n)
})

const approverUsers = computed(
  () => new Set(
    employees.value.map(e => e.leave_approver).filter(Boolean)
  )
)

const managerEmps = computed(
  () => new Set(
    employees.value
      .filter(e =>
        e.user_id &&
        approverUsers.value.has(e.user_id)
      )
      .map(e => e.name)
  )
)

const ownEmp = computed(
  () => employees.value.find(e => e.user_id === email)?.name
)

function canAct(leave) {
  return (
    managerEmps.value.has(leave.employee) &&
    leave.employee !== ownEmp.value &&
    leave.owner !== email
  )
}

const cards = computed(() => [
  {
    id: 'all',
    label: 'Total employees',
    value: employees.value.length,
    note: 'Active employees',
    color: 'blue',
    icon: '♙'
  },
  {
    id: 'present',
    label: 'Present today',
    value: presentList.value.length,
    note: 'Includes half days',
    color: 'green',
    icon: '✓'
  },
  {
    id: 'leave',
    label: 'On leave today',
    value: onLeaveList.value.length,
    note: 'Attendance marked on leave',
    color: 'indigo',
    icon: '▣'
  },
  {
    id: 'notmarked',
    label: 'Not marked yet',
    value: notMarked.value.length,
    note: 'No attendance record',
    color: 'amber',
    icon: '◷'
  },
  {
    id: 'pending',
    label: 'Pending leaves',
    value: pending.value.length,
    note: 'Awaiting review',
    color: 'red',
    icon: '◫'
  },
  {
    id: 'timesheets',
    label: 'Timesheets',
    value: timesheetLoading.value
      ? '…'
      : timesheetError.value
        ? '—'
        : timesheets.value.length,
    note: 'Selected timesheet period',
    color: 'blue',
    icon: '◴'
  }
])

const detail = computed(() => {
  switch (selected.value) {
    case 'all':
      return {
        title: 'Active employees',
        empty: 'No active employees.',
        rows: employees.value.map(e => ({
          key: e.name,
          emp: e.name,
          title: e.employee_name,
          sub: `${e.name} · ${e.department || 'No department'}`
        }))
      }

    case 'present':
      return {
        title: 'Present today (including half days)',
        empty: 'Nobody is marked present yet.',
        rows: presentList.value.map(a => ({
          key: a.employee,
          emp: a.employee,
          title: a.employee_name,
          sub: a.employee,
          tag: a.status
        }))
      }

    case 'leave':
      return {
        title: 'On leave today',
        empty: 'Nobody is marked on leave today.',
        rows: onLeaveList.value.map(a => ({
          key: a.employee,
          emp: a.employee,
          title: a.employee_name,
          sub: a.employee,
          tag: 'On Leave'
        }))
      }

    case 'notmarked':
      return {
        title: 'No attendance record today',
        empty: 'Everyone has a record for today.',
        action: true,
        rows: notMarked.value.map(e => ({
          key: e.name,
          emp: e.name,
          title: e.employee_name,
          sub: `${e.name} · ${e.department || 'No department'}`,
          tag: 'Not marked'
        }))
      }

    case 'pending':
      return {
        title: 'Pending leave requests',
        empty: 'No pending requests.',
        rows: pending.value.map(l => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} – ${l.to_date} · Approver: ${l.leave_approver || 'none set'}`,
          tag: 'Pending',
          leave: l
        }))
      }

    case 'timesheets':
      return {
        title: 'Timesheets for selected period',
        empty: 'No timesheets in this period.',
        rows: timesheets.value.slice(0, 30).map(t => ({
          key: t.name,
          title: t.employee_name || t.employee,
          sub: `${t.name} · ${Number(t.total_hours || 0).toFixed(1)} hrs · ${t.status}`,
          tag: t.workflow_state || t.status
        }))
      }

    default:
      return null
  }
})

function pick(id) {
  selected.value = selected.value === id ? null : id
}

function redirectIfUnauthorized(e) {
  if (
    e.response?.status === 401 ||
    e.response?.status === 403
  ) {
    localStorage.removeItem('user')
    router.push('/login')
    return true
  }

  return false
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    const [emp, att, lv] = await Promise.all([
      api.get('/api/resource/Employee', {
        params: {
          filters: JSON.stringify([
            ['status', '=', 'Active']
          ]),
          fields: JSON.stringify([
            'name',
            'employee_name',
            'department',
            'user_id',
            'leave_approver'
          ]),
          limit_page_length: 500
        }
      }),

      api.get('/api/resource/Attendance', {
        params: {
          filters: JSON.stringify([
            ['attendance_date', '=', today],
            ['docstatus', '!=', 2]
          ]),
          fields: JSON.stringify([
            'employee',
            'employee_name',
            'status'
          ]),
          limit_page_length: 500
        }
      }),

      api.get('/api/resource/Leave Application', {
        params: {
          filters: JSON.stringify([
            ['to_date', '>=', today]
          ]),
          fields: JSON.stringify([
            'name',
            'employee',
            'employee_name',
            'owner',
            'leave_type',
            'from_date',
            'to_date',
            'total_leave_days',
            'status',
            'workflow_state',
            'leave_approver'
          ]),
          order_by: 'from_date asc',
          limit_page_length: 500
        }
      })
    ])

    employees.value = emp.data.data || []
    attendance.value = att.data.data || []

    leaves.value = (lv.data.data || []).filter(
      l => !['Rejected', 'Cancelled'].includes(state(l))
    )
  } catch (e) {
    if (!redirectIfUnauthorized(e)) {
      error.value = errMsg(e, 'Could not load HR dashboard')
    }
  } finally {
    loading.value = false
  }
}

async function loadTimesheets() {
  timesheetLoading.value = true
  timesheetError.value = ''

  try {
    const filters = []

    if (timesheetRange.value !== 'all') {
      const start = new Date()

      start.setDate(
        start.getDate() - (Number(timesheetRange.value) - 1)
      )

      filters.push([
        'start_date',
        '>=',
        start.toLocaleDateString('en-CA')
      ])

      filters.push([
        'start_date',
        '<=',
        today
      ])
    }

    const res = await api.get('/api/resource/Timesheet', {
      params: {
        filters: JSON.stringify(filters),

        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'start_date',
          'end_date',
          'total_hours',
          'status',
          'workflow_state',
          'docstatus'
        ]),

        order_by: 'start_date desc',
        limit_page_length: 500
      }
    })

    timesheets.value = res.data.data || []

    timesheetTruncated.value =
      timesheets.value.length >= 500
  } catch (e) {
    timesheets.value = []

    timesheetError.value = errMsg(
      e,
      'Could not load organization timesheets'
    )

    redirectIfUnauthorized(e)
  } finally {
    timesheetLoading.value = false
  }
}

async function changeTimesheetRange(range) {
  if (timesheetRange.value === range) return

  timesheetRange.value = range

  await loadTimesheets()
}

async function refresh() {
  console.log('HR REFRESH CLICKED')

  await Promise.all([
    load(),
    loadTimesheets()
  ])
}

async function act(leave, action) {
  if (busy.value || !canAct(leave)) return

  error.value = ''
  success.value = ''
  busy.value = leave.name

  try {
    const doc = (
      await api.get(
        `/api/resource/Leave Application/${encodeURIComponent(leave.name)}`
      )
    ).data.data

    await api.post(
      '/api/method/frappe.model.workflow.apply_workflow',
      {
        doc: JSON.stringify(doc),
        action
      }
    )

    success.value = `${leave.employee_name}: ${action} done`

    await load()
  } catch (e) {
    error.value = errMsg(
      e,
      `Could not ${action.toLowerCase()}`
    )
  } finally {
    busy.value = ''
  }
}

onMounted(refresh)
</script>

<template>
  <main class="hr-dashboard">
    <header class="hero">
      <div>
        <span class="eyebrow">HR WORKSPACE</span>

        <h1>Organization Overview</h1>

        <p>
          Workforce attendance, leave management and timesheet activity
          · {{ today }}
        </p>
      </div>

      <button
        class="refresh"
        :disabled="loading || timesheetLoading"
        @click="refresh"
      >
        ↻ Refresh
      </button>
    </header>

    <p v-if="error" class="notice error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" class="notice success" role="status">
      {{ success }}
    </p>

    <p v-if="loading" class="loading">
      Loading HR dashboard…
    </p>

    <template v-else>
      <HRStats
        :cards="cards"
        :selected="selected"
        @select="pick"
      />

      <section v-if="detail" class="detail panel">
        <div class="detail-head">
          <h3>{{ detail.title }}</h3>

          <div class="actions">
            <button
              v-if="detail.action"
              class="primary"
              @click="router.push('/mark-attendance')"
            >
              Mark attendance
            </button>

            <button
              class="secondary"
              @click="selected = null"
            >
              Close
            </button>
          </div>
        </div>

        <p v-if="!detail.rows.length" class="muted">
          {{ detail.empty }}
        </p>

        <div
          v-for="row in detail.rows"
          :key="row.key"
          class="detail-row"
        >
          <button
            class="person-link"
            :disabled="!row.emp"
            @click="open(row.emp)"
          >
            <strong>{{ row.title }}</strong>
            <small>{{ row.sub }}</small>
          </button>

          <div class="actions">
            <template v-if="row.leave && canAct(row.leave)">
              <button
                class="primary"
                :disabled="!!busy"
                @click="act(row.leave, 'Approve')"
              >
                Approve
              </button>

              <button
                class="danger"
                :disabled="!!busy"
                @click="act(row.leave, 'Reject')"
              >
                Reject
              </button>
            </template>

            <span v-else-if="row.tag" class="pill">
              {{ row.tag }}
            </span>
          </div>
        </div>

        <p
          v-if="selected === 'timesheets' && timesheets.length > 30"
          class="muted"
        >
          Showing 30 records. Use the timesheet page for the full list.
        </p>
      </section>

      <div class="dashboard-grid">
        <HRAttendance
          :employees="employees"
          :records="todayRecords"
          :date="today"
          @mark="router.push('/mark-attendance')"
          @open="open"
        />

        <HRLeaves
          :pending="pending"
          :upcoming="thisWeek"
          :busy="busy"
          :can-act="canAct"
          @open="open"
          @act="act"
        />
      </div>

      <div class="dashboard-grid">
        <HRTimesheets
          :records="timesheets"
          :loading="timesheetLoading"
          :error="timesheetError"
          :range="timesheetRange"
          :truncated="timesheetTruncated"
          @range="changeTimesheetRange"
          @retry="loadTimesheets"
        />

        <HRDepartments
          :departments="byDept"
          :total="employees.length"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.hr-dashboard {
  width: 100%;
  min-width: 0;
  padding-bottom: 32px;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  background: #191c43;
  border-radius: 15px;
  padding: 27px 30px;
  margin-bottom: 20px;
  color: white;
}

.eyebrow {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .14em;
  color: #b5b2ff;
}

.hero h1 {
  font-size: 26px;
  margin: 8px 0;
  color: #fff;
}

.hero p {
  font-size: 12px;
  color: #d4d5ee;
  margin: 0;
  line-height: 1.6;
}

.refresh {
  border: 1px solid #7475a2;
  background: #313568;
  color: #fff;
  border-radius: 9px;
  padding: 10px 15px;
  cursor: pointer;
}

.refresh:disabled {
  opacity: .6;
  cursor: wait;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
  align-items: stretch;
}

.panel {
  background: var(--card, #fff);
  border: 1px solid var(--border, #e5e6f0);
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--shadow, 0 6px 18px #171b3410);
}

.detail {
  margin-bottom: 20px;
  border-color: #c7d2fe;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail h3 {
  font-size: 16px;
  margin: 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f0f1f6;
  padding: 11px 0;
}

.detail-row:last-of-type {
  border-bottom: 0;
}

.person-link {
  border: 0;
  background: none;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  color: #4f46e5;
}

.person-link:disabled {
  cursor: default;
  color: var(--text, #181a33);
}

.person-link small {
  color: var(--muted, #666a85);
  font-size: 11px;
}

.actions {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
}

.actions button {
  border: 0;
  border-radius: 8px;
  padding: 8px 11px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.actions button:disabled {
  opacity: .5;
  cursor: wait;
}

.primary {
  background: #4f46e5;
  color: white;
}

.secondary {
  background: #eeedfb;
  color: #4f46e5;
}

.danger {
  background: #fee2e2;
  color: #b91c1c;
}

.pill {
  border-radius: 20px;
  background: #fef3c7;
  color: #92400e;
  padding: 5px 9px;
  font-size: 11px;
}

.muted,
.loading {
  font-size: 12px;
  color: var(--muted, #666a85);
}

.notice {
  border-radius: 9px;
  padding: 12px 14px;
  font-size: 12px;
  margin-bottom: 16px;
}

.notice.error {
  background: #fef2f2;
  color: #b91c1c;
}

.notice.success {
  background: #ecfdf5;
  color: #15803d;
}

@media (max-width: 850px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .hero {
    padding: 22px;
  }

  .hero h1 {
    font-size: 22px;
  }

  .detail-row {
    align-items: flex-start;
    flex-direction: column;
  }
}

/* HIDE MANUAL REFRESH CONTROLS */
.refresh-btn { display: none !important; }
.empty-refresh { display: none !important; }
.today-refresh { display: none !important; }
.refresh-button { display: none !important; }
.refresh { display: none !important; }
.deadline-refresh-button { display: none !important; }
</style>