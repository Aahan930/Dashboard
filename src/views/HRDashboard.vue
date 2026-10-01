<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const router = useRouter()
const email = localStorage.getItem('user')
const today = new Date().toLocaleDateString('en-CA')
const weekEndDate = new Date()
weekEndDate.setDate(weekEndDate.getDate() + 6)
const weekEnd = weekEndDate.toLocaleDateString('en-CA')

const employees = ref([])
const attendance = ref([])
const leaves = ref([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const busy = ref('')
const selected = ref(null)

const state = (l) => l.workflow_state || l.status
const open = (id) => id && router.push(`/hr/employee/${id}`)

const markedIds = computed(() => new Set(attendance.value.map((a) => a.employee)))
const presentList = computed(() => attendance.value.filter((a) => ['Present', 'Half Day'].includes(a.status)))
const onLeaveList = computed(() => attendance.value.filter((a) => a.status === 'On Leave'))
const notMarked = computed(() => employees.value.filter((e) => !markedIds.value.has(e.name)))
const pending = computed(() => leaves.value.filter((l) => ['Pending', 'Open'].includes(state(l))))
const thisWeek = computed(() =>
  leaves.value.filter((l) => state(l) === 'Approved' && l.from_date <= weekEnd && l.to_date >= today)
)
const byDept = computed(() => {
  const m = {}
  employees.value.forEach((e) => {
    const d = e.department || 'No department'
    m[d] = (m[d] || 0) + 1
  })
  return Object.entries(m).map(([name, n]) => ({ name, n }))
})
const pct = (n) => (employees.value.length ? Math.round((n / employees.value.length) * 100) : 0)

const approverUsers = computed(() => new Set(employees.value.map((e) => e.leave_approver).filter(Boolean)))
const managerEmps = computed(
  () => new Set(employees.value.filter((e) => e.user_id && approverUsers.value.has(e.user_id)).map((e) => e.name))
)
const ownEmp = computed(() => employees.value.find((e) => e.user_id === email)?.name)

function canAct(l) {
  return managerEmps.value.has(l.employee) && l.employee !== ownEmp.value && l.owner !== email
}

const detail = computed(() => {
  switch (selected.value) {
    case 'all':
      return {
        title: 'All employees',
        empty: 'No employees.',
        rows: employees.value.map((e) => ({ key: e.name, emp: e.name, title: e.employee_name, sub: `${e.name} · ${e.department || 'No department'}` })),
      }
    case 'present':
      return {
        title: 'Present today',
        empty: 'Nobody is marked present yet.',
        rows: presentList.value.map((a) => ({ key: a.employee, emp: a.employee, title: a.employee_name, sub: a.employee, tag: a.status })),
      }
    case 'leave':
      return {
        title: 'On leave today',
        empty: 'Nobody is on leave today.',
        rows: onLeaveList.value.map((a) => ({ key: a.employee, emp: a.employee, title: a.employee_name, sub: a.employee, tag: 'On Leave' })),
      }
    case 'notmarked':
      return {
        title: 'No attendance record today',
        empty: 'Everyone is marked for today.',
        rows: notMarked.value.map((e) => ({ key: e.name, emp: e.name, title: e.employee_name, sub: `${e.name} · ${e.department || 'No department'}`, tag: 'Not marked' })),
        action: true,
      }
    case 'pending':
      return {
        title: 'Pending leave requests',
        empty: 'No pending requests.',
        rows: pending.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date} · ${l.total_leave_days} day(s) · Approver: ${l.leave_approver || 'none set'}`,
          tag: 'Pending',
          leave: l,
        })),
      }
    default:
      return null
  }
})

function pick(name) {
  selected.value = selected.value === name ? null : name
}

async function load() {
  try {
    const [emp, att, lv] = await Promise.all([
      api.get('/api/resource/Employee', {
        params: {
          filters: JSON.stringify([['status', '=', 'Active']]),
          fields: JSON.stringify(['name', 'employee_name', 'department', 'user_id', 'leave_approver']),
          limit_page_length: 500,
        },
      }),
      api.get('/api/resource/Attendance', {
        params: {
          filters: JSON.stringify([['attendance_date', '=', today], ['docstatus', '!=', 2]]),
          fields: JSON.stringify(['employee', 'employee_name', 'status']),
          limit_page_length: 500,
        },
      }),
      api.get('/api/resource/Leave Application', {
        params: {
          filters: JSON.stringify([['to_date', '>=', today]]),
          fields: JSON.stringify([
            'name', 'employee', 'employee_name', 'owner', 'leave_type', 'from_date', 'to_date',
            'total_leave_days', 'status', 'workflow_state', 'leave_approver',
          ]),
          order_by: 'from_date asc',
          limit_page_length: 500,
        },
      }),
    ])
    employees.value = emp.data.data
    attendance.value = att.data.data
    leaves.value = lv.data.data.filter((l) => state(l) !== 'Rejected' && state(l) !== 'Cancelled')
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load dashboard')
    }
  }
}

async function act(l, action) {
  error.value = ''
  success.value = ''
  busy.value = l.name
  try {
    const doc = (await api.get(`/api/resource/Leave Application/${l.name}`)).data.data
    await api.post('/api/method/frappe.model.workflow.apply_workflow', {
      doc: JSON.stringify(doc),
      action,
    })
    success.value = `${l.employee_name}: ${action} done`
    await load()
  } catch (e) {
    error.value = errMsg(e, `Could not ${action.toLowerCase()}`)
  }
  busy.value = ''
}

onMounted(async () => {
  await load()
  loading.value = false
})
</script>

<template>
  <div>
    <h2>HR Dashboard</h2>
    <p class="muted" style="margin-top:-12px">Today: {{ today }}. Select a card, then a name, to see the details.</p>
    <p v-if="error" style="color:red">{{ error }}</p>
    <p v-if="success" style="color:green">{{ success }}</p>
    <p v-if="loading">Loading...</p>

    <template v-else>
      <div class="stats">
        <div :class="['stat', { on: selected === 'all' }]" tabindex="0" @click="pick('all')" @keydown.enter="pick('all')">
          <div class="lbl">Total employees</div><div class="num blue">{{ employees.length }}</div>
        </div>
        <div :class="['stat', { on: selected === 'present' }]" tabindex="0" @click="pick('present')" @keydown.enter="pick('present')">
          <div class="lbl">Present today</div><div class="num green">{{ presentList.length }}</div>
        </div>
        <div :class="['stat', { on: selected === 'leave' }]" tabindex="0" @click="pick('leave')" @keydown.enter="pick('leave')">
          <div class="lbl">On leave today</div><div class="num indigo">{{ onLeaveList.length }}</div>
        </div>
        <div :class="['stat', { on: selected === 'notmarked' }]" tabindex="0" @click="pick('notmarked')" @keydown.enter="pick('notmarked')">
          <div class="lbl">Not marked yet</div><div class="num amber">{{ notMarked.length }}</div>
        </div>
        <div :class="['stat', { on: selected === 'pending' }]" tabindex="0" @click="pick('pending')" @keydown.enter="pick('pending')">
          <div class="lbl">Pending leaves</div><div class="num red">{{ pending.length }}</div>
        </div>
      </div>

      <div v-if="detail" class="panel detail">
        <div class="head">
          <h3>{{ detail.title }}</h3>
          <div class="acts">
            <button v-if="detail.action" @click="router.push('/mark-attendance')">Mark attendance</button>
            <button class="ghost" @click="selected = null">Close</button>
          </div>
        </div>
        <p v-if="!detail.rows.length" class="muted">{{ detail.empty }}</p>
        <div v-for="r in detail.rows" :key="r.key" class="row link" @click="open(r.emp)">
          <div><b>{{ r.title }}</b><div class="muted">{{ r.sub }}</div></div>
          <div class="acts" @click.stop>
            <template v-if="r.leave && canAct(r.leave)">
              <button :disabled="busy === r.leave.name" @click="act(r.leave, 'Approve')">Approve</button>
              <button class="bad" :disabled="busy === r.leave.name" @click="act(r.leave, 'Reject')">Reject</button>
            </template>
            <span v-else-if="r.tag" :class="['badge', r.tag.replace(' ', '')]">{{ r.tag }}</span>
          </div>
        </div>
      </div>

      <div class="grid2">
        <div class="panel">
          <h3>Today's attendance</h3>
          <div class="stack">
            <div class="seg g" :style="{ width: pct(presentList.length) + '%' }"></div>
            <div class="seg i" :style="{ width: pct(onLeaveList.length) + '%' }"></div>
            <div class="seg n" :style="{ width: pct(notMarked.length) + '%' }"></div>
          </div>
          <div class="muted legend">
            <span>Present {{ presentList.length }}</span><span>On leave {{ onLeaveList.length }}</span><span>Not marked {{ notMarked.length }}</span>
          </div>
          <div v-if="notMarked.length" class="row top">
            <div>
              <b>No record today</b>
              <div class="muted">{{ notMarked.map((e) => e.employee_name).join(', ') }}</div>
            </div>
            <button @click="router.push('/mark-attendance')">Mark attendance</button>
          </div>
          <p v-else class="muted">Everyone is marked for today.</p>
        </div>

        <div class="panel">
          <h3>Pending leave requests</h3>
          <p v-if="!pending.length" class="muted">No pending requests.</p>
          <div v-for="l in pending" :key="l.name" class="row">
            <div>
              <b class="lnk" @click="open(l.employee)">{{ l.employee_name }}</b>
              <div class="muted">{{ l.leave_type }} · {{ l.from_date }} to {{ l.to_date }} · {{ l.total_leave_days }} day(s)</div>
              <div class="muted">Approver: {{ l.leave_approver || 'none set' }}</div>
            </div>
            <div class="acts">
              <template v-if="canAct(l)">
                <button :disabled="busy === l.name" @click="act(l, 'Approve')">Approve</button>
                <button class="bad" :disabled="busy === l.name" @click="act(l, 'Reject')">Reject</button>
              </template>
              <span v-else class="badge Pending">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid2">
        <div class="panel">
          <h3>On leave in the next 7 days</h3>
          <p v-if="!thisWeek.length" class="muted">Nobody has approved leave this week.</p>
          <div v-for="l in thisWeek" :key="l.name" class="row">
            <div><b class="lnk" @click="open(l.employee)">{{ l.employee_name }}</b><div class="muted">{{ l.leave_type }}</div></div>
            <span class="muted">{{ l.from_date }} to {{ l.to_date }}</span>
          </div>
        </div>

        <div class="panel">
          <h3>Headcount by department</h3>
          <div v-for="d in byDept" :key="d.name" class="dept">
            <div class="bar-top"><span>{{ d.name }}</span><b>{{ d.n }}</b></div>
            <div class="bar"><div :style="{ width: pct(d.n) + '%' }"></div></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:20px}
.stat{background:var(--card);border-radius:12px;padding:20px;box-shadow:var(--shadow);cursor:pointer;border:2px solid transparent;transition:transform .12s}
.stat:hover{transform:translateY(-2px)}
.stat.on{border-color:#4f46e5}
.lbl{color:var(--muted);font-size:14px;margin-bottom:8px}
.num{font-size:34px;font-weight:700}
.blue{color:#4f46e5}.green{color:#16a34a}.indigo{color:#2563eb}.amber{color:#d97706}.red{color:#dc2626}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px}
.panel{background:var(--card);border-radius:12px;padding:20px;box-shadow:var(--shadow)}
.panel h3{margin:0 0 14px}
.detail{margin-bottom:20px;border:2px solid #c7d2fe}
.head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
.head h3{margin:0}
.acts{display:flex;gap:8px;align-items:center}
.ghost{background:#e5e7eb;color:#1f2937}
.ghost:hover{background:#d1d5db}
.bad{background:#dc2626}
.bad:hover{background:#b91c1c}
.muted{color:var(--muted);font-size:13px}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:0}
.row.top{margin-top:14px;border-top:1px solid #f1f5f9;border-bottom:0}
.row.link{cursor:pointer;padding-left:8px;padding-right:8px;border-radius:8px}
.row.link:hover{background:#f5f3ff}
.lnk{cursor:pointer;color:#4f46e5}
.lnk:hover{text-decoration:underline}
.badge{padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#e5e7eb;color:#374151;white-space:nowrap}
.badge.Pending,.badge.Notmarked{background:#fef3c7;color:#92400e}
.badge.Present,.badge.HalfDay{background:#dcfce7;color:#166534}
.badge.OnLeave{background:#dbeafe;color:#1e40af}
.stack{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#e5e7eb;margin-bottom:8px}
.seg.g{background:#16a34a}.seg.i{background:#2563eb}.seg.n{background:#d1d5db}
.legend{display:flex;gap:14px;flex-wrap:wrap}
.dept{margin-bottom:12px}
.bar-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}
.bar{height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden}
.bar > div{height:100%;background:#4f46e5;border-radius:99px}
</style>