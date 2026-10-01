<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const today = new Date().toLocaleDateString('en-CA')
const month = today.slice(0, 7)

const emp = ref(null)
const balances = ref([])
const balanceOk = ref(true)
const leaves = ref([])
const attendance = ref([])
const loading = ref(true)
const error = ref('')

const state = (l) => l.workflow_state || l.status
const count = (s) => attendance.value.filter((a) => a.status === s).length
const initials = computed(() =>
  (emp.value?.employee_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
)

const info = computed(() => {
  const e = emp.value || {}
  return [
    ['Employee ID', e.name],
    ['Status', e.status],
    ['Company', e.company],
    ['Department', e.department],
    ['Designation', e.designation],
    ['Employment type', e.employment_type],
    ['Date of joining', e.date_of_joining],
    ['Reports to', e.reports_to],
    ['Leave approver', e.leave_approver],
    ['Login user', e.user_id],
    ['Gender', e.gender],
    ['Date of birth', e.date_of_birth],
    ['Phone', e.cell_number],
    ['Email', e.company_email || e.personal_email],
  ]
})

onMounted(async () => {
  try {
    const res = await api.get(`/api/resource/Employee/${id}`)
    emp.value = res.data.data
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load employee')
    }
    loading.value = false
    return
  }

  try {
    const r = await api.get('/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details', {
      params: { employee: id, date: today },
    })
    const alloc = r.data.message.leave_allocation || {}
    balances.value = Object.entries(alloc).map(([type, v]) => ({ type, ...v }))
  } catch {
    balanceOk.value = false
  }

  try {
    const [lv, att] = await Promise.all([
      api.get('/api/resource/Leave Application', {
        params: {
          filters: JSON.stringify([['employee', '=', id]]),
          fields: JSON.stringify(['name', 'leave_type', 'from_date', 'to_date', 'total_leave_days', 'status', 'workflow_state']),
          order_by: 'from_date desc',
          limit_page_length: 10,
        },
      }),
      api.get('/api/resource/Attendance', {
        params: {
          filters: JSON.stringify([
            ['employee', '=', id],
            ['attendance_date', '>=', `${month}-01`],
            ['attendance_date', '<=', today],
            ['docstatus', '!=', 2],
          ]),
          fields: JSON.stringify(['attendance_date', 'status']),
          limit_page_length: 100,
        },
      }),
    ])
    leaves.value = lv.data.data
    attendance.value = att.data.data
  } catch {}
  loading.value = false
})
</script>

<template>
  <div>
    <a class="back" @click="router.back()">← Back</a>
    <p v-if="error" style="color:red">{{ error }}</p>
    <p v-if="loading">Loading...</p>

    <template v-else-if="emp">
      <div class="hero">
        <div class="avatar">{{ initials }}</div>
        <div>
          <h1>{{ emp.employee_name }}</h1>
          <p>{{ emp.designation || 'No designation' }} · {{ emp.department || 'No department' }}</p>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="lbl">Present this month</div><div class="num green">{{ count('Present') + count('Half Day') }}</div></div>
        <div class="stat"><div class="lbl">On leave this month</div><div class="num blue">{{ count('On Leave') }}</div></div>
        <div class="stat"><div class="lbl">Absent this month</div><div class="num red">{{ count('Absent') }}</div></div>
      </div>

      <div class="grid2">
        <div class="panel">
          <h3>Employee information</h3>
          <div v-for="[k, v] in info" :key="k" class="kv">
            <span class="muted">{{ k }}</span><b>{{ v || '-' }}</b>
          </div>
        </div>

        <div>
          <div class="panel" style="margin-bottom:16px">
            <h3>Leave balance</h3>
            <p v-if="!balanceOk" class="muted">Balance is not available for this employee.</p>
            <p v-else-if="!balances.length" class="muted">No leave allocated.</p>
            <div v-for="b in balances" :key="b.type" class="bal">
              <div class="bar-top"><span>{{ b.type }}</span><b>{{ b.remaining_leaves }} of {{ b.total_leaves }} left</b></div>
              <div class="bar"><div :style="{ width: (b.total_leaves ? Math.min(100, Math.round((b.leaves_taken / b.total_leaves) * 100)) : 0) + '%' }"></div></div>
              <div class="muted">Used {{ b.leaves_taken }} · Pending {{ b.leaves_pending_approval }}</div>
            </div>
          </div>

          <div class="panel">
            <h3>Recent leave applications</h3>
            <p v-if="!leaves.length" class="muted">No leave applications.</p>
            <div v-for="l in leaves" :key="l.name" class="row">
              <div>
                <b>{{ l.leave_type }}</b>
                <div class="muted">{{ l.from_date }} to {{ l.to_date }} · {{ l.total_leave_days }} day(s)</div>
              </div>
              <span :class="['badge', state(l)]">{{ state(l) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back{cursor:pointer;color:#4f46e5;display:inline-block;margin-bottom:14px}
.hero{display:flex;gap:16px;align-items:center;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:16px;padding:24px 28px;margin-bottom:20px}
.hero h1{margin:0 0 4px;font-size:24px}
.hero p{margin:0;opacity:.85}
.avatar{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:22px;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:20px}
.stat{background:var(--card);border-radius:12px;padding:18px;box-shadow:var(--shadow)}
.lbl{color:var(--muted);font-size:14px;margin-bottom:6px}
.num{font-size:30px;font-weight:700}
.green{color:#16a34a}.blue{color:#2563eb}.red{color:#dc2626}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.panel{background:var(--card);border-radius:12px;padding:20px;box-shadow:var(--shadow)}
.panel h3{margin:0 0 14px}
.kv{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.kv:last-child{border-bottom:0}
.muted{color:var(--muted);font-size:13px}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:0}
.badge{padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#fef3c7;color:#92400e;white-space:nowrap}
.badge.Approved{background:#dcfce7;color:#166534}
.badge.Rejected{background:#fee2e2;color:#991b1b}
.bal{margin-bottom:12px}
.bar-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;gap:12px}
.bar{height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-bottom:4px}
.bar > div{height:100%;background:#4f46e5;border-radius:99px}
</style>