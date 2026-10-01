<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const router = useRouter()
const email = localStorage.getItem('user')
const today = new Date().toLocaleDateString('en-CA')

const viewDate = ref(today)
const apps = ref([])
const team = ref([])
const loading = ref(true)
const error = ref('')
const selected = ref(null)

/* -----------------------------
   TEAM ATTENDANCE
------------------------------ */

const attendanceRecords = ref([])
const attendanceLoading = ref(false)
const attendanceError = ref('')

/* -----------------------------
   TEAM TIMESHEETS
------------------------------ */

const timesheetRecords = ref([])
const timesheetLoading = ref(false)
const timesheetError = ref('')

function state(l) {
  return l.workflow_state || l.status
}

function pct(b) {
  return b.total_leaves
    ? Math.min(
        100,
        Math.round(
          (b.leaves_taken / b.total_leaves) * 100
        )
      )
    : 0
}

const open = (id) =>
  id && router.push(`/team/employee/${id}`)

function pick(name) {
  selected.value =
    selected.value === name ? null : name
}

/* -----------------------------
   LOAD TEAM ATTENDANCE
------------------------------ */

async function loadTeamAttendance() {
  if (!team.value.length) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  attendanceError.value = ''

  try {
    const employeeIds = team.value.map(
      (member) => member.id
    )

    const res = await api.get(
      '/api/resource/Attendance',
      {
        params: {
          filters: JSON.stringify([
            ['employee', 'in', employeeIds],
            ['attendance_date', '=', viewDate.value],
            ['docstatus', '!=', 2]
          ]),
          fields: JSON.stringify([
            'name',
            'employee',
            'employee_name',
            'attendance_date',
            'status',
            'leave_type'
          ]),
          order_by: 'employee_name asc',
          limit_page_length: 500
        }
      }
    )

    attendanceRecords.value =
      res.data.data || []
  } catch (e) {
    attendanceError.value = errMsg(
      e,
      'Could not load team attendance'
    )

    attendanceRecords.value = []
  } finally {
    attendanceLoading.value = false
  }
}

/* -----------------------------
   ATTENDANCE COMPUTED DATA
------------------------------ */

const attendanceStats = computed(() => {
  const present =
    attendanceRecords.value.filter(
      (r) => r.status === 'Present'
    ).length

  const absent =
    attendanceRecords.value.filter(
      (r) => r.status === 'Absent'
    ).length

  const halfDay =
    attendanceRecords.value.filter(
      (r) => r.status === 'Half Day'
    ).length

  const onLeave =
    attendanceRecords.value.filter(
      (r) => r.status === 'On Leave'
    ).length

  return {
    present,
    absent,
    halfDay,
    onLeave
  }
})

const attendanceRows = computed(() => {
  return team.value.map((member) => {
    const record =
      attendanceRecords.value.find(
        (r) => r.employee === member.id
      )

    return {
      id: member.id,
      name: member.name,
      status:
        record?.status || 'Not Marked',
      leaveType:
        record?.leave_type || ''
    }
  })
})

const attendancePercentage = computed(() => {
  const total =
    attendanceStats.value.present +
    attendanceStats.value.absent +
    attendanceStats.value.halfDay +
    attendanceStats.value.onLeave

  if (!total) return 0

  return Math.round(
    (
      (
        attendanceStats.value.present +
        attendanceStats.value.halfDay * 0.5
      ) /
      total
    ) *
      100
  )
})

/* -----------------------------
   LOAD TEAM TIMESHEETS
------------------------------ */

async function loadTeamTimesheets() {
  if (!team.value.length) {
    timesheetRecords.value = []
    return
  }

  timesheetLoading.value = true
  timesheetError.value = ''

  try {
    const employeeIds = team.value.map(
      (member) => member.id
    )

    const res = await api.get(
      '/api/resource/Timesheet',
      {
        params: {
          filters: JSON.stringify([
            ['employee', 'in', employeeIds]
          ]),
          fields: JSON.stringify([
            'name',
            'employee',
            'employee_name',
            'status',
            'start_date',
            'end_date',
            'total_hours'
          ]),
          order_by: 'start_date desc',
          limit_page_length: 500
        }
      }
    )

    timesheetRecords.value =
      res.data.data || []
  } catch (e) {
    timesheetError.value = errMsg(
      e,
      'Could not load team timesheets'
    )

    timesheetRecords.value = []
  } finally {
    timesheetLoading.value = false
  }
}

/* -----------------------------
   TIMESHEET COMPUTED DATA
------------------------------ */

const timesheetStats = computed(() => {
  const records =
    timesheetRecords.value

  return {
    total: records.length,

    draft: records.filter(
      (r) => r.status === 'Draft'
    ).length,

    submitted: records.filter(
      (r) => r.status === 'Submitted'
    ).length,

    cancelled: records.filter(
      (r) => r.status === 'Cancelled'
    ).length,

    totalHours: records.reduce(
      (sum, r) =>
        sum + Number(r.total_hours || 0),
      0
    )
  }
})

const timesheetEmployeeRows = computed(() => {
  return team.value.map((member) => {
    const records =
      timesheetRecords.value.filter(
        (r) => r.employee === member.id
      )

    const hours = records.reduce(
      (sum, r) =>
        sum + Number(r.total_hours || 0),
      0
    )

    return {
      id: member.id,
      name: member.name,
      timesheets: records.length,
      hours
    }
  })
})

/* -----------------------------
   LOAD TEAM DATA
------------------------------ */

onMounted(async () => {
  try {
    const res = await api.get(
      '/api/resource/Leave Application',
      {
        params: {
          filters: JSON.stringify([
            ['leave_approver', '=', email],
            ['owner', '!=', email]
          ]),
          fields: JSON.stringify([
            'name',
            'employee',
            'employee_name',
            'leave_type',
            'from_date',
            'to_date',
            'total_leave_days',
            'status',
            'workflow_state'
          ]),
          order_by: 'from_date desc',
          limit_page_length: 500
        }
      }
    )

    apps.value = res.data.data.filter(
      (l) =>
        !['Rejected', 'Cancelled'].includes(
          state(l)
        )
    )

    const members = new Map()

    apps.value.forEach((l) => {
      members.set(
        l.employee,
        l.employee_name
      )
    })

    try {
      const emp = await api.get(
        '/api/resource/Employee',
        {
          params: {
            filters: JSON.stringify([
              ['leave_approver', '=', email],
              ['status', '=', 'Active']
            ]),
            fields: JSON.stringify([
              'name',
              'employee_name'
            ]),
            limit_page_length: 200
          }
        }
      )

      emp.data.data.forEach((e) => {
        members.set(
          e.name,
          e.employee_name
        )
      })
    } catch {}

    team.value = await Promise.all(
      [...members.entries()].map(
        async ([id, name]) => {
          try {
            const r = await api.get(
              '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
              {
                params: {
                  employee: id,
                  date: today
                }
              }
            )

            const alloc =
              r.data.message.leave_allocation ||
              {}

            const balances =
              Object.entries(alloc).map(
                ([type, v]) => ({
                  type,
                  ...v
                })
              )

            return {
              id,
              name,
              balances,
              ok: true
            }
          } catch {
            return {
              id,
              name,
              balances: [],
              ok: false
            }
          }
        }
      )
    )

    await loadTeamAttendance()
    await loadTeamTimesheets()
  } catch (e) {
    if (
      e.response?.status === 401 ||
      e.response?.status === 403
    ) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(
        e,
        'Could not load team data'
      )
    }
  }

  loading.value = false
})

/* -----------------------------
   WATCH DATE / TEAM
------------------------------ */

watch(
  () => [
    viewDate.value,
    team.value.map(
      (member) => member.id
    ).join(',')
  ],
  () => {
    if (!loading.value) {
      loadTeamAttendance()
    }
  }
)

/* -----------------------------
   LEAVE COMPUTED DATA
------------------------------ */

const onLeave = computed(() =>
  apps.value.filter(
    (l) =>
      state(l) === 'Approved' &&
      l.from_date <= viewDate.value &&
      l.to_date >= viewDate.value
  )
)

const onLeaveIds = computed(
  () =>
    new Set(
      onLeave.value.map(
        (l) => l.employee
      )
    )
)

const upcoming = computed(() =>
  apps.value
    .filter(
      (l) =>
        state(l) === 'Approved' &&
        l.from_date > viewDate.value
    )
    .sort((a, b) =>
      a.from_date.localeCompare(
        b.from_date
      )
    )
    .slice(0, 8)
)

const pendingList = computed(() =>
  apps.value.filter((l) =>
    ['Pending', 'Open'].includes(
      state(l)
    )
  )
)

const detail = computed(() => {
  switch (selected.value) {
    case 'members':
      return {
        title: 'Team members',
        empty: 'No team members yet.',
        rows: team.value.map((m) => ({
          key: m.id,
          emp: m.id,
          title: m.name,
          sub: m.id,
          tag: onLeaveIds.value.has(m.id)
            ? 'On leave'
            : 'Available'
        }))
      }

    case 'onleave':
      return {
        title: `On leave on ${viewDate.value}`,
        empty:
          'Nobody is on approved leave on this date.',
        rows: onLeave.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date}`,
          tag: `${l.total_leave_days} day(s)`
        }))
      }

    case 'pending':
      return {
        title: 'Pending requests',
        empty: 'No pending requests.',
        rows: pendingList.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date} · ${l.total_leave_days} day(s)`,
          tag: 'Pending'
        })),
        approvals: true
      }

    case 'upcoming':
      return {
        title: 'Upcoming approved leaves',
        empty:
          'No upcoming approved leaves.',
        rows: upcoming.value.map((l) => ({
          key: l.name,
          emp: l.employee,
          title: l.employee_name,
          sub: `${l.leave_type} · ${l.from_date} to ${l.to_date}`,
          tag: `${l.total_leave_days} day(s)`
        }))
      }

    default:
      return null
  }
})
</script>

<template>
  <div class="team">
    <h2>Team Dashboard</h2>

    <p
      class="muted"
      style="margin-top:-12px"
    >
      Select a card, then a name, to see
      the details.
    </p>

    <p
      v-if="error"
      class="err"
    >
      {{ error }}
    </p>

    <p v-if="loading">
      Loading...
    </p>

    <template v-else>

      <!-- TEAM OVERVIEW -->
      <div class="stats">
        <div
          :class="[
            'stat',
            { on: selected === 'members' }
          ]"
          tabindex="0"
          @click="pick('members')"
          @keydown.enter="pick('members')"
        >
          <div class="lbl">
            Team members
          </div>

          <div class="num blue">
            {{ team.length }}
          </div>
        </div>

        <div
          :class="[
            'stat',
            { on: selected === 'onleave' }
          ]"
          tabindex="0"
          @click="pick('onleave')"
          @keydown.enter="pick('onleave')"
        >
          <div class="lbl">
            On leave on selected date
          </div>

          <div class="num red">
            {{ onLeave.length }}
          </div>
        </div>

        <div
          :class="[
            'stat',
            { on: selected === 'pending' }
          ]"
          tabindex="0"
          @click="pick('pending')"
          @keydown.enter="pick('pending')"
        >
          <div class="lbl">
            Pending requests
          </div>

          <div class="num amber">
            {{ pendingList.length }}
          </div>
        </div>

        <div
          :class="[
            'stat',
            { on: selected === 'upcoming' }
          ]"
          tabindex="0"
          @click="pick('upcoming')"
          @keydown.enter="pick('upcoming')"
        >
          <div class="lbl">
            Upcoming leaves
          </div>

          <div class="num green">
            {{ upcoming.length }}
          </div>
        </div>
      </div>

      <!-- SELECTED DETAIL -->
      <div
        v-if="detail"
        class="panel detail"
      >
        <div class="head">
          <h3>{{ detail.title }}</h3>

          <div class="datebox">
            <button
              v-if="detail.approvals"
              @click="router.push('/approvals')"
            >
              Open approvals
            </button>

            <button
              class="ghost"
              @click="selected = null"
            >
              Close
            </button>
          </div>
        </div>

        <p
          v-if="!detail.rows.length"
          class="muted"
        >
          {{ detail.empty }}
        </p>

        <div
          v-for="r in detail.rows"
          :key="r.key"
          class="row link"
          @click="open(r.emp)"
        >
          <div>
            <b>{{ r.title }}</b>

            <div class="muted">
              {{ r.sub }}
            </div>
          </div>

          <span
            :class="[
              'badge',
              r.tag === 'Available' ||
              r.tag.includes('day')
                ? 'Approved'
                : r.tag === 'On leave'
                  ? 'Rejected'
                  : ''
            ]"
          >
            {{ r.tag }}
          </span>
        </div>
      </div>

      <!-- TEAM ATTENDANCE -->
      <div class="panel attendance-panel">
        <div class="head">
          <div>
            <h3>Team Attendance</h3>

            <p class="muted">
              Attendance for {{ viewDate }}
            </p>
          </div>

          <div class="datebox">
            <input
              type="date"
              v-model="viewDate"
            />

            <button
              @click="viewDate = today"
            >
              Today
            </button>
          </div>
        </div>

        <p
          v-if="attendanceError"
          class="err"
        >
          {{ attendanceError }}
        </p>

        <p
          v-if="attendanceLoading"
          class="muted"
        >
          Loading attendance...
        </p>

        <template v-else>
          <!-- ATTENDANCE SUMMARY -->
          <div class="attendance-stats">
            <div class="attendance-stat">
              <span class="attendance-label">
                Present
              </span>

              <strong
                class="attendance-number present"
              >
                {{ attendanceStats.present }}
              </strong>
            </div>

            <div class="attendance-stat">
              <span class="attendance-label">
                Absent
              </span>

              <strong
                class="attendance-number absent"
              >
                {{ attendanceStats.absent }}
              </strong>
            </div>

            <div class="attendance-stat">
              <span class="attendance-label">
                Half Day
              </span>

              <strong
                class="attendance-number half"
              >
                {{ attendanceStats.halfDay }}
              </strong>
            </div>

            <div class="attendance-stat">
              <span class="attendance-label">
                On Leave
              </span>

              <strong
                class="attendance-number leave"
              >
                {{ attendanceStats.onLeave }}
              </strong>
            </div>

            <div class="attendance-stat">
              <span class="attendance-label">
                Attendance
              </span>

              <strong
                class="attendance-number percentage"
              >
                {{ attendancePercentage }}%
              </strong>
            </div>
          </div>

          <!-- EMPLOYEE ATTENDANCE TABLE -->
          <div
            v-if="attendanceRows.length"
            class="attendance-table-wrap"
          >
            <table class="attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Status</th>
                  <th>Leave Type</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="row in attendanceRows"
                  :key="row.id"
                >
                  <td>
                    <b
                      class="lnk"
                      @click="open(row.id)"
                    >
                      {{ row.name }}
                    </b>
                  </td>

                  <td class="muted">
                    {{ row.id }}
                  </td>

                  <td>
                    <span
                      :class="[
                        'attendance-badge',
                        row.status
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            '-'
                          )
                      ]"
                    >
                      {{ row.status }}
                    </span>
                  </td>

                  <td class="muted">
                    {{ row.leaveType || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-else
            class="muted"
          >
            No team members found.
          </p>
        </template>
      </div>

      <!-- TEAM TIMESHEETS -->
      <div class="panel timesheet-panel">
        <div class="head">
          <div>
            <h3>Team Timesheets</h3>

            <p class="muted">
              Timesheet activity across your team
            </p>
          </div>
        </div>

        <p
          v-if="timesheetError"
          class="err"
        >
          {{ timesheetError }}
        </p>

        <p
          v-if="timesheetLoading"
          class="muted"
        >
          Loading timesheets...
        </p>

        <template v-else>
          <!-- TIMESHEET SUMMARY -->
          <div class="timesheet-stats">
            <div class="timesheet-stat">
              <span class="timesheet-label">
                Total Timesheets
              </span>

              <strong class="timesheet-number blue">
                {{ timesheetStats.total }}
              </strong>
            </div>

            <div class="timesheet-stat">
              <span class="timesheet-label">
                Total Hours
              </span>

              <strong class="timesheet-number green">
                {{ timesheetStats.totalHours.toFixed(2) }}
              </strong>
            </div>

            <div class="timesheet-stat">
              <span class="timesheet-label">
                Draft
              </span>

              <strong class="timesheet-number amber">
                {{ timesheetStats.draft }}
              </strong>
            </div>

            <div class="timesheet-stat">
              <span class="timesheet-label">
                Submitted
              </span>

              <strong class="timesheet-number blue">
                {{ timesheetStats.submitted }}
              </strong>
            </div>

            <div class="timesheet-stat">
              <span class="timesheet-label">
                Cancelled
              </span>

              <strong class="timesheet-number red">
                {{ timesheetStats.cancelled }}
              </strong>
            </div>
          </div>

          <!-- EMPLOYEE TIMESHEET TABLE -->
          <div
            v-if="timesheetEmployeeRows.length"
            class="timesheet-table-wrap"
          >
            <table class="timesheet-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Timesheets</th>
                  <th>Total Hours</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="row in timesheetEmployeeRows"
                  :key="row.id"
                >
                  <td>
                    <b
                      class="lnk"
                      @click="open(row.id)"
                    >
                      {{ row.name }}
                    </b>

                    <div class="muted">
                      {{ row.id }}
                    </div>
                  </td>

                  <td>
                    {{ row.timesheets }}
                  </td>

                  <td>
                    <b>
                      {{ row.hours.toFixed(2) }}
                    </b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-else
            class="muted"
          >
            No timesheets found for your team.
          </p>
        </template>
      </div>

      <!-- WHO IS ON LEAVE -->
      <div class="panel">
        <div class="head">
          <h3>Who is on leave</h3>

          <div class="datebox">
            <input
              type="date"
              v-model="viewDate"
            />

            <button
              @click="viewDate = today"
            >
              Today
            </button>
          </div>
        </div>

        <p
          v-if="!onLeave.length"
          class="muted"
        >
          Nobody is on approved leave on
          {{ viewDate }}.
        </p>

        <div
          v-for="l in onLeave"
          :key="l.name"
          class="row link"
          @click="open(l.employee)"
        >
          <div>
            <b>{{ l.employee_name }}</b>

            <div class="muted">
              {{ l.leave_type }} ·
              {{ l.from_date }} to
              {{ l.to_date }}
            </div>
          </div>

          <span class="badge Approved">
            {{ l.total_leave_days }} day(s)
          </span>
        </div>
      </div>

      <!-- TEAM LEAVE BALANCE -->
      <div class="panel">
        <h3>Team leave balance</h3>

        <p
          v-if="!team.length"
          class="muted"
        >
          No team members yet. They appear
          once they apply for leave or list
          you as their leave approver.
        </p>

        <table v-if="team.length">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave balance</th>
              <th>
                Status on {{ viewDate }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="m in team"
              :key="m.id"
            >
              <td>
                <b
                  class="lnk"
                  @click="open(m.id)"
                >
                  {{ m.name }}
                </b>

                <div class="muted">
                  {{ m.id }}
                </div>
              </td>

              <td>
                <span
                  v-if="!m.ok"
                  class="muted"
                >
                  Balance unavailable
                </span>

                <span
                  v-else-if="!m.balances.length"
                  class="muted"
                >
                  No leave allocated
                </span>

                <div
                  v-for="b in m.balances"
                  :key="b.type"
                  class="bal"
                >
                  <div class="bar-top">
                    <span>
                      {{ b.type }}
                    </span>

                    <b>
                      {{ b.remaining_leaves }}
                      of
                      {{ b.total_leaves }}
                      left
                    </b>
                  </div>

                  <div class="bar">
                    <div
                      :style="{
                        width:
                          pct(b) + '%'
                      }"
                    ></div>
                  </div>

                  <div class="muted">
                    Used
                    {{ b.leaves_taken }}
                    · Pending
                    {{
                      b.leaves_pending_approval
                    }}
                  </div>
                </div>
              </td>

              <td>
                <span
                  :class="[
                    'badge',
                    onLeaveIds.has(m.id)
                      ? 'Rejected'
                      : 'Approved'
                  ]"
                >
                  {{
                    onLeaveIds.has(m.id)
                      ? 'On leave'
                      : 'Available'
                  }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- UPCOMING APPROVED LEAVES -->
      <div class="panel">
        <h3>Upcoming approved leaves</h3>

        <p
          v-if="!upcoming.length"
          class="muted"
        >
          No upcoming approved leaves.
        </p>

        <div
          v-for="l in upcoming"
          :key="l.name"
          class="row link"
          @click="open(l.employee)"
        >
          <div>
            <b>{{ l.employee_name }}</b>

            <div class="muted">
              {{ l.leave_type }} ·
              {{ l.from_date }} to
              {{ l.to_date }}
            </div>
          </div>

          <span class="badge Approved">
            {{ l.total_leave_days }} day(s)
          </span>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:16px;
  margin-bottom:20px
}

.stat{
  background:var(--card);
  border-radius:12px;
  padding:20px;
  box-shadow:var(--shadow);
  cursor:pointer;
  border:2px solid transparent;
  transition:transform .12s
}

.stat:hover{
  transform:translateY(-2px)
}

.stat.on{
  border-color:#4f46e5
}

.lbl{
  color:var(--muted);
  font-size:14px;
  margin-bottom:8px
}

.num{
  font-size:34px;
  font-weight:700
}

.blue{
  color:#4f46e5
}

.red{
  color:#dc2626
}

.amber{
  color:#d97706
}

.green{
  color:#16a34a
}

.panel{
  background:var(--card);
  border-radius:12px;
  padding:20px;
  box-shadow:var(--shadow);
  margin-bottom:20px
}

.panel h3{
  margin:0 0 14px
}

.detail{
  border:2px solid #c7d2fe
}

.head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  flex-wrap:wrap;
  gap:10px;
  margin-bottom:6px
}

.head h3{
  margin:0
}

.datebox{
  display:flex;
  gap:8px
}

.datebox input{
  padding:8px
}

.ghost{
  background:#e5e7eb;
  color:#1f2937
}

.ghost:hover{
  background:#d1d5db
}

.muted{
  color:var(--muted);
  font-size:13px
}

.err{
  color:var(--red)
}

.row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px 8px;
  border-bottom:1px solid #f1f5f9;
  border-radius:8px
}

.row:last-child{
  border-bottom:0
}

.row.link{
  cursor:pointer
}

.row.link:hover{
  background:#f5f3ff
}

.lnk{
  cursor:pointer;
  color:#4f46e5
}

.lnk:hover{
  text-decoration:underline
}

.badge{
  padding:4px 10px;
  border-radius:99px;
  font-size:12px;
  font-weight:600;
  background:#fef3c7;
  color:#92400e;
  white-space:nowrap
}

.badge.Approved{
  background:#dcfce7;
  color:#166534
}

.badge.Rejected{
  background:#fee2e2;
  color:#991b1b
}

.bal{
  margin-bottom:12px
}

.bar-top{
  display:flex;
  justify-content:space-between;
  font-size:14px;
  margin-bottom:4px;
  gap:12px
}

.bar{
  height:8px;
  background:#e5e7eb;
  border-radius:99px;
  overflow:hidden;
  margin-bottom:4px
}

.bar > div{
  height:100%;
  background:#4f46e5;
  border-radius:99px
}

/* -----------------------------
   TEAM ATTENDANCE
------------------------------ */

.attendance-panel{
  margin-top:20px
}

.attendance-panel .head{
  margin-bottom:18px
}

.attendance-panel .head p{
  margin:5px 0 0
}

.attendance-stats{
  display:grid;
  grid-template-columns:repeat(
    auto-fit,
    minmax(140px, 1fr)
  );
  gap:12px;
  margin-bottom:20px
}

.attendance-stat{
  border:1px solid var(--border);
  border-radius:10px;
  padding:14px 16px;
  background:#fafbff
}

.attendance-label{
  display:block;
  color:var(--muted);
  font-size:13px;
  margin-bottom:6px
}

.attendance-number{
  display:block;
  font-size:26px;
  font-weight:700
}

.attendance-number.present{
  color:#16a34a
}

.attendance-number.absent{
  color:#dc2626
}

.attendance-number.half{
  color:#d97706
}

.attendance-number.leave{
  color:#7c3aed
}

.attendance-number.percentage{
  color:#4f46e5
}

.attendance-table-wrap{
  overflow-x:auto
}

.attendance-table{
  width:100%;
  border-collapse:collapse
}

.attendance-table th,
.attendance-table td{
  text-align:left;
  padding:12px 10px;
  border-bottom:1px solid #f1f5f9;
  font-size:14px
}

.attendance-table th{
  color:var(--muted);
  font-size:12px;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:.03em;
  background:#fafbff
}

.attendance-table tbody tr:hover{
  background:#fafbff
}

.attendance-badge{
  display:inline-flex;
  align-items:center;
  padding:5px 10px;
  border-radius:99px;
  font-size:12px;
  font-weight:600;
  background:#f1f5f9;
  color:#475569;
  white-space:nowrap
}

.attendance-badge.present{
  background:#dcfce7;
  color:#166534
}

.attendance-badge.absent{
  background:#fee2e2;
  color:#991b1b
}

.attendance-badge.half-day{
  background:#fef3c7;
  color:#92400e
}

.attendance-badge.on-leave{
  background:#ede9fe;
  color:#6d28d9
}

.attendance-badge.not-marked{
  background:#f1f5f9;
  color:#64748b
}

/* -----------------------------
   TEAM TIMESHEETS
------------------------------ */

.timesheet-panel{
  margin-top:20px
}

.timesheet-panel .head{
  margin-bottom:18px
}

.timesheet-panel .head p{
  margin:5px 0 0
}

.timesheet-stats{
  display:grid;
  grid-template-columns:repeat(
    auto-fit,
    minmax(150px, 1fr)
  );
  gap:12px;
  margin-bottom:20px
}

.timesheet-stat{
  border:1px solid var(--border);
  border-radius:10px;
  padding:14px 16px;
  background:#fafbff
}

.timesheet-label{
  display:block;
  color:var(--muted);
  font-size:13px;
  margin-bottom:6px
}

.timesheet-number{
  display:block;
  font-size:26px;
  font-weight:700
}

.timesheet-table-wrap{
  overflow-x:auto
}

.timesheet-table{
  width:100%;
  border-collapse:collapse
}

.timesheet-table th,
.timesheet-table td{
  text-align:left;
  padding:12px 10px;
  border-bottom:1px solid #f1f5f9;
  font-size:14px
}

.timesheet-table th{
  color:var(--muted);
  font-size:12px;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:.03em;
  background:#fafbff
}

.timesheet-table tbody tr:hover{
  background:#fafbff
}

@media (max-width:700px){
  .attendance-stats,
  .timesheet-stats{
    grid-template-columns:repeat(2,1fr)
  }

  .attendance-table th:nth-child(2),
  .attendance-table td:nth-child(2){
    display:none
  }
}

/* TEAM DASHBOARD FULL WIDTH */

.team {
  width: 100%;
  max-width: none !important;
  margin: 0 !important;
  padding: 24px 28px;
  box-sizing: border-box;
}

.team .stats {
  width: 100%;
}

.team .panel {
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 700px) {
  .team {
    padding: 16px;
  }
}

</style>