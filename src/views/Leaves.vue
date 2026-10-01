<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api, { errMsg } from '../api'
import LeaveStats from '../components/LeaveStats.vue'
import LeaveTabs from '../components/LeaveTabs.vue'
import LeaveTable from '../components/LeaveTable.vue'

const router = useRouter()
const route = useRoute()

const activeTab = ref('apply')
const leaves = ref([])
const leaveTab = ref('All')
const leaveSearch = ref('')

function applyRouteState() {
  if (route.query.tab === 'actions') {
    activeTab.value = 'actions'
    return
  }

  if (route.query.tab === 'my-leaves') {
    activeTab.value = 'my-leaves'

    if (route.query.status === 'Pending') {
      leaveTab.value = 'Pending'
    } else {
      leaveTab.value = 'All'
    }

    return
  }

  activeTab.value = 'apply'
  leaveTab.value = 'All'
}
const leavesError = ref('')

watch(
  () => route.query,
  () => applyRouteState(),
  { immediate: true }
)

const employee = ref(null)
const balances = ref({})
const leaveChoice = ref('')
const halfDaySession = ref('')

const form = ref({
  leave_type: '',
  from_date: '',
  to_date: '',
  description: '',
})
function label(leave) {
  return leave.workflow_state || leave.status
}

function isFutureLeave(leave) {
  const now = new Date()

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')

  return String(leave.from_date || '').slice(0, 10) > today
}


const filteredLeaves = computed(() => {
  const query = leaveSearch.value.trim().toLowerCase()

  return leaves.value.filter((leave) => {
    const status = label(leave)
    const matchesStatus =
      leaveTab.value === 'All' ||
      (leaveTab.value === 'Pending' &&
        ['Pending', 'Open'].includes(status)) ||
      status === leaveTab.value

    const searchable = [
      leave.name,
      leave.leave_type,
      leave.description,
      leave.from_date,
      leave.to_date,
      label(leave)
    ].filter(Boolean).join(' ').toLowerCase()

    return matchesStatus &&
      (!query || searchable.includes(query))
  })
})

const actionDateInput = ref('')
const actionDateSearch = ref('')

const actionableLeaves = computed(() =>
  leaves.value.filter(leave => {
    const status = label(leave)

    if (status === 'Pending' || status === 'Open') {
      return true
    }

    if (status === 'Approved' && isFutureLeave(leave)) {
      return true
    }

    return false
  })
)

const filteredActionableLeaves = computed(() => {
  const searchDate = actionDateSearch.value

  if (!searchDate) {
    return actionableLeaves.value
  }

  return actionableLeaves.value.filter(leave => {
    const from = String(leave.from_date || '').slice(0, 10)
    const to = String(leave.to_date || '').slice(0, 10)

    return searchDate >= from && searchDate <= to
  })
})

function searchActionDate() {
  actionDateSearch.value = actionDateInput.value
}

function clearActionDateSearch() {
  actionDateInput.value = ''
  actionDateSearch.value = ''
}

const leaveCounts = computed(() => ({
  total: leaves.value.length,

  approved: leaves.value.filter(
    (leave) => label(leave) === 'Approved'
  ).length,

  pending: leaves.value.filter(
    (leave) => ['Pending', 'Open'].includes(label(leave))
  ).length,

  rejected: leaves.value.filter(
    (leave) => label(leave) === 'Rejected'
  ).length
}))

const error = ref('')
const success = ref('')
const loading = ref(false)

const today = new Date().toLocaleDateString('en-CA')

const days = computed(() => {
  if (leaveChoice.value === 'Half Day') {
    return form.value.from_date ? 0.5 : 0
  }

  const { from_date, to_date } = form.value
  if (!from_date || !to_date) return 0

  const diff =
    (new Date(to_date) - new Date(from_date)) / 86400000

  return diff >= 0 ? diff + 1 : 0
})

const selectedBalanceType = computed(() =>
  leaveChoice.value === 'Half Day'
    ? 'Casual Leave'
    : leaveChoice.value
)

const selectedBalance = computed(() =>
  balances.value[selectedBalanceType.value] || null
)

const remaining = computed(() =>
  selectedBalance.value?.remaining_leaves ?? 0
)

const overBalance = computed(() =>
  days.value > remaining.value
)
function balancePercentage(balance) {
  if (!balance.total_leaves) return 0

  return Math.min(
    100,
    Math.round(
      (balance.leaves_taken / balance.total_leaves) * 100
    )
  )
}

watch(leaveChoice, value => {
  form.value.leave_type =
    value === 'Half Day'
      ? 'Casual Leave'
      : value

  if (value !== 'Half Day') {
    halfDaySession.value = ''
  }
})

async function loadBalances() {
  const res = await api.get(
    '/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details',
    {
      params: {
        employee: employee.value.name,
        date: today,
      },
    }
  )

  balances.value = res.data.message.leave_allocation || {}

  if (!leaveChoice.value) {
    const types = Object.keys(balances.value)

    leaveChoice.value = types.includes('Casual Leave')
      ? 'Casual Leave'
      : (types[0] || '')
  }

  form.value.leave_type =
    leaveChoice.value === 'Half Day'
      ? 'Casual Leave'
      : leaveChoice.value
}

onMounted(async () => {
  try {
    const email = localStorage.getItem('user')

    const emp = await api.get('/api/resource/Employee', {
      params: {
        filters: JSON.stringify([
          ['user_id', '=', email],
        ]),
        fields: JSON.stringify([
          'name',
          'company',
          'leave_approver',
        ]),
      },
    })

    employee.value = emp.data.data[0]

    if (!employee.value) {
      error.value = 'No employee record linked'
      return
    }

    await loadBalances()
    await loadLeaves()
    await loadCancellationRequests()
  } catch (e) {
    if (
      e.response?.status === 401 ||
      e.response?.status === 403
    ) {
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      error.value = errMsg(e, 'Could not load form data')
    }
  }
})

async function submit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    if (!leaveChoice.value) {
      throw new Error('Please select a leave type')
    }

    const isHalfDay = leaveChoice.value === 'Half Day'
    const leaveType = isHalfDay
      ? 'Casual Leave'
      : leaveChoice.value

    if (!balances.value[leaveType]) {
      throw new Error(`${leaveType} is not allocated to this employee`)
    }

    if (
      days.value >
      (balances.value[leaveType]?.remaining_leaves ?? 0)
    ) {
      throw new Error(
        'The requested leave exceeds your available balance'
      )
    }

    const awaitPayload = {
      employee: employee.value.name,
      company: employee.value.company,
      leave_approver: employee.value.leave_approver,
      leave_type: leaveType,
      from_date: form.value.from_date,
      to_date: isHalfDay
        ? form.value.from_date
        : form.value.to_date,
      half_day: isHalfDay ? 1 : 0,
      half_day_date: isHalfDay
        ? form.value.from_date
        : null,
      custom_half_day_session: isHalfDay
        ? halfDaySession.value
        : null,
      description: form.value.description,
    }

    await api.post('/api/resource/Leave Application', awaitPayload)

    success.value =
      'Leave application submitted. Status: Pending'

    form.value.from_date = ''
    form.value.to_date = ''
    form.value.description = ''
    halfDaySession.value = ''

    await loadBalances()
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not submit leave application'
    )
  } finally {
    loading.value = false
  }
}
const actionDialog = ref({
  open: false,
  type: '',
  leave: null,
  reason: ''
})
const actionBusy = ref(false)

function openWithdraw(leave) {
  leavesError.value = ''
  actionDialog.value = {
    open: true,
    type: 'withdraw',
    leave,
    reason: ''
  }
}

function openCancellation(leave) {
  leavesError.value = ''
  actionDialog.value = {
    open: true,
    type: 'cancel',
    leave,
    reason: ''
  }
}

function closeActionDialog() {
  if (actionBusy.value) return
  actionDialog.value.open = false
}

async function confirmAction() {
  if (actionBusy.value || !actionDialog.value.leave) return

  const { type, leave, reason } = actionDialog.value

  if (type === 'cancel' &&
      (reason.trim().length < 10 || reason.trim().length > 1000)) {
    leavesError.value =
      'Please enter a reason between 10 and 1000 characters.'
    return
  }

  actionBusy.value = true
  leavesError.value = ''
  success.value = ''

  try {
    if (type === 'withdraw') {
      await api.post(
        '/api/method/hr_portal_custom.api.leave_cancellation.withdraw_leave',
        { leave_application: leave.name }
      )

      await Promise.all([loadLeaves(), loadBalances()])
      success.value = 'Leave application withdrawn successfully.'
    } else {
      await api.post(
        '/api/method/hr_portal_custom.api.leave_cancellation_request.request_cancellation',
        {
          leave_application: leave.name,
          reason: reason.trim()
        }
      )

      await loadCancellationRequests()
      success.value = 'Cancellation request submitted to HR.'
    }

    actionDialog.value.open = false
  } catch (e) {
    leavesError.value = errMsg(
      e,
      type === 'withdraw'
        ? 'Could not withdraw leave application'
        : 'Could not submit cancellation request'
    )
  } finally {
    actionBusy.value = false
  }
}

const cancellationRequests = ref([])

const pendingCancellations = computed(() =>
  cancellationRequests.value
    .filter((request) => request.status === 'Pending')
    .map((request) => request.leave_application)
)

async function loadCancellationRequests() {
  const res = await api.get(
    '/api/method/hr_portal_custom.api.leave_cancellation_request.my_cancellation_requests'
  )
  cancellationRequests.value = res.data.message || []
}

async function loadLeaves() {
  try {
    const res = await api.get('/api/resource/Leave Application', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee.value.name],
          ['docstatus', '!=', 2]
        ]),

        fields: JSON.stringify([
          'name',
          'leave_type',
          'from_date',
          'to_date',
          'total_leave_days',
          'status',
          'workflow_state',
          'description',
          'creation'
        ]),

        order_by: 'creation desc',
        limit_page_length: 100
      }
    })

    leaves.value = res.data.data
  } catch (e) {
    leavesError.value = errMsg(
      e,
      'Could not load leave applications'
    )
  }
}
</script>

<template>
  <div class="leaves-page">

    <!-- PAGE HEADER -->
    <header class="enterprise-page-header">
      <div
        :class="[
          'page-heading',
          { 'page-heading-action': activeTab === 'actions' }
        ]"
      >
        <button
          v-if="activeTab === 'actions'"
          type="button"
          class="leave-action-back"
          aria-label="Back to Leaves"
          title="Back to Leaves"
          @click="router.push('/leaves')"
        >
          ←
        </button>

        <div class="page-heading-copy">
          <span class="page-eyebrow">EMPLOYEE SELF SERVICE</span>

          <h1>
            {{
              activeTab === 'actions'
                ? 'Withdraw / Cancel Leave'
                : 'Leave management'
            }}
          </h1>

          <p v-if="activeTab === 'actions'">
            Manage leave requests that can still be withdrawn or cancelled.
          </p>

          <p v-else>
            View your leave history, manage requests and
            track available leave.
          </p>
        </div>
      </div>

      <button
        v-if="activeTab === 'apply'"
        type="button"
        class="secondary-page-action"
        @click="router.push({
          path: '/leaves',
          query: { tab: 'actions' }
        })"
      >
        Withdraw / Cancel Leave
      </button>

      <button
        v-else-if="activeTab !== 'actions'"
        type="button"
        class="primary-page-action"
        @click="activeTab = 'apply'"
      >
        <span aria-hidden="true">+</span>
        Apply for leave
      </button>
    </header>

    <!-- TOP TABS -->
    <nav
      v-if="activeTab !== 'actions'"
      class="leave-tabs"
    >
      <button
        :class="{ active: activeTab === 'apply' }"
        @click="activeTab = 'apply'"
      >
        Apply Leave
      </button>

      <button
        :class="{ active: activeTab === 'my-leaves' }"
        @click="activeTab = 'my-leaves'"
      >
        My Leaves
      </button>

      <button
        :class="{ active: activeTab === 'balance' }"
        @click="activeTab = 'balance'"
      >
        Leave Balance
      </button>
    </nav>

    <!-- APPLY LEAVE -->
    <section v-if="activeTab === 'apply'" class="leave-content">
      <div class="layout">

        <form
          class="panel form-panel apply-form-card"
          @submit.prevent="submit"
        >
          <!-- FORM HERO -->
          <div class="apply-form-header">
            <div class="apply-form-heading">
              <div class="apply-form-icon">
                <span>✦</span>
              </div>

              <div>
                <span class="leave-form-eyebrow">
                  LEAVE REQUEST
                </span>

                <h2>Plan your time off</h2>

                <p>
                  Complete the details below and send your leave
                  request to your approver.
                </p>
              </div>
            </div>

            <span class="draft-chip">
              Draft request
            </span>
          </div>

          <div class="apply-form-body">

            <!-- SECTION 01 -->
            <section class="apply-form-section">
              <div class="apply-section-heading">
                <span class="apply-section-number">01</span>

                <div>
                  <strong>Request details</strong>
                  <p>
                    Select the leave type and the dates you need.
                  </p>
                </div>
              </div>

              <div class="apply-fields">

                <!-- Leave type -->
                <div class="field field-full">
                  <label for="leave-type">
                    Leave type
                  </label>

                  <div class="select-shell">
                    <select
                      id="leave-type"
                      v-model="leaveChoice"
                      required
                    >
                      <option disabled value="">
                        Select a leave type
                      </option>

                      <option
                        v-if="balances['Casual Leave']"
                        value="Half Day"
                      >
                        Half Day (Casual Leave)
                      </option>

                      <option
                        v-for="(value, type) in balances"
                        :key="type"
                        :value="type"
                        :disabled="
                          Number(value.remaining_leaves || 0) <= 0
                        "
                      >
                        {{ type }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- Dates -->
                <div class="field">
                  <label for="from-date">
                    {{ leaveChoice === 'Half Day' ? 'Date' : 'From date' }}
                  </label>

                  <div class="date-input-shell">
                    <input
                      id="from-date"
                      v-model="form.from_date"
                      type="date"
                      :min="today"
                      required
                    />
                  </div>
                </div>

                <div
                  v-if="
                    leaveChoice &&
                    leaveChoice !== 'Half Day'
                  "
                  class="field"
                >
                  <label for="to-date">
                    To date
                  </label>

                  <div class="date-input-shell">
                    <input
                      id="to-date"
                      v-model="form.to_date"
                      type="date"
                      :min="form.from_date || today"
                      required
                    />
                  </div>
                </div>

                <!-- Half day -->
                <div
                  v-if="leaveChoice === 'Half Day'"
                  class="field field-full"
                >
                  <label for="half-day-session">
                    Half-day session
                  </label>

                  <div class="session-options">
                    <label class="session-option">
                      <input
                        v-model="halfDaySession"
                        type="radio"
                        value="First Half"
                      />

                      <span>
                        <strong>First half</strong>
                        <small>Morning</small>
                      </span>
                    </label>

                    <label class="session-option">
                      <input
                        v-model="halfDaySession"
                        type="radio"
                        value="Second Half"
                      />

                      <span>
                        <strong>Second half</strong>
                        <small>Afternoon</small>
                      </span>
                    </label>
                  </div>
                </div>

              </div>
            </section>

            <!-- SECTION 02 -->
            <section class="apply-form-section reason-section">
              <div class="apply-section-heading">
                <span class="apply-section-number">02</span>

                <div>
                  <strong>Reason for leave</strong>
                  <p>
                    Give your approver enough context to review
                    the request.
                  </p>
                </div>
              </div>

              <div class="field field-full">
                <label for="leave-reason">
                  Reason
                </label>

                <textarea
                  id="leave-reason"
                  v-model="form.description"
                  rows="5"
                  placeholder="Briefly explain why you need this leave..."
                ></textarea>

                <div class="field-hint">
                  A clear and concise reason is recommended.
                </div>
              </div>
            </section>


            <!-- VALIDATION -->
            <p
              v-if="days && overBalance"
              class="warn"
            >
              Your request exceeds your available balance.
            </p>

            <p
              v-if="error"
              class="err"
            >
              {{ error }}
            </p>

            <p
              v-if="success"
              class="ok"
            >
              {{ success }}
            </p>

          </div>

          <!-- FOOTER -->
          <div class="apply-form-footer">
            <div class="footer-message">
              <span class="footer-check">✓</span>

              <div>
                <strong>Ready when you are</strong>
                <p>
                  Your request will be sent to your configured
                  leave approver.
                </p>
              </div>
            </div>

            <button
              type="submit"
              :disabled="
                loading ||
                !days ||
                overBalance ||
                !leaveChoice ||
                !selectedBalance ||
                (leaveChoice === 'Half Day' && !halfDaySession) ||
                (leaveChoice !== 'Half Day' && !form.to_date)
              "
            >
              <span>
                {{ loading ? 'Submitting...' : 'Submit leave request' }}
              </span>

              <span class="submit-arrow">→</span>
            </button>
          </div>
        </form>

        <!-- EMPLOYEE REQUEST SUMMARY -->
        <aside class="apply-summary-panel">

          <div class="apply-summary-top">
            <div>
              <span class="apply-summary-eyebrow">
                REQUEST SUMMARY
              </span>
              <h3>Your leave request</h3>
              <p>
                Review the details before sending your request.
              </p>
            </div>

            <span
              :class="[
                'apply-summary-status',
                {
                  ready:
                    days &&
                    leaveChoice &&
                    selectedBalance &&
                    !overBalance &&
                    (
                      leaveChoice === 'Half Day'
                        ? !!halfDaySession
                        : !!form.to_date
                    )
                }
              ]"
            >
              {{
                overBalance
                  ? 'Balance exceeded'
                  : days &&
                    leaveChoice &&
                    selectedBalance &&
                    (
                      leaveChoice === 'Half Day'
                        ? !!halfDaySession
                        : !!form.to_date
                    )
                  ? 'Ready'
                  : 'Incomplete'
              }}
            </span>
          </div>

          <div class="apply-summary-list">

            <div class="apply-summary-row">
              <span>Leave type</span>
              <strong>
                {{ leaveChoice || 'Not selected' }}
              </strong>
            </div>

            <div class="apply-summary-row">
              <span>From</span>
              <strong>
                {{ form.from_date || 'Not selected' }}
              </strong>
            </div>

            <div class="apply-summary-row">
              <span>To</span>
              <strong>
                {{
                  leaveChoice === 'Half Day'
                    ? (form.from_date || 'Not selected')
                    : (form.to_date || 'Not selected')
                }}
              </strong>
            </div>

            <div class="apply-summary-row">
              <span>Duration</span>
              <strong>
                {{
                  days
                    ? `${days} ${days === 1 ? 'day' : 'days'}`
                    : 'Not selected'
                }}
              </strong>
            </div>

          </div>

          <div class="apply-summary-divider"></div>

          <div class="apply-approver-card">
            <span class="apply-summary-eyebrow">
              APPROVAL
            </span>

            <div class="apply-approver-icon">✓</div>

            <div>
              <strong>Leave approver</strong>
              <p>
                Your request will be routed to your configured
                leave approver.
              </p>
            </div>
          </div>

          <div class="apply-summary-note">
            <span>i</span>

            <p>
              You can review and change these details before
              submitting the request.
            </p>
          </div>

        </aside>

      </div>
    </section>

    <!-- MY LEAVES -->
    <section
      v-else-if="activeTab === 'my-leaves'"
      class="leave-content enterprise-leave-content"
    >
      <div class="enterprise-stats">
        <div class="enterprise-stat">
          <div class="stat-top">
            <span>Total requests</span>
            <span class="stat-icon total-icon">▤</span>
          </div>
          <strong>{{ leaveCounts.total }}</strong>
          <small>All leave applications</small>
        </div>

        <div class="enterprise-stat">
          <div class="stat-top">
            <span>Approved</span>
            <span class="stat-icon approved-icon">✓</span>
          </div>
          <strong>{{ leaveCounts.approved }}</strong>
          <small>Approved applications</small>
        </div>

        <div class="enterprise-stat">
          <div class="stat-top">
            <span>Pending</span>
            <span class="stat-icon pending-icon">◷</span>
          </div>
          <strong>{{ leaveCounts.pending }}</strong>
          <small>Awaiting a decision</small>
        </div>

        <div class="enterprise-stat">
          <div class="stat-top">
            <span>Rejected</span>
            <span class="stat-icon rejected-icon">×</span>
          </div>
          <strong>{{ leaveCounts.rejected }}</strong>
          <small>Rejected applications</small>
        </div>
      </div>

      <div
        v-if="leavesError"
        class="enterprise-alert"
        role="alert"
      >
        {{ leavesError }}
      </div>

      <div
        v-if="success"
        class="enterprise-success"
        role="status"
      >
        {{ success }}
      </div>

      <div class="enterprise-register">
        <div class="register-heading">
          <div>
            <h2>Leave history</h2>
            <p>
              Review your applications and track their status.
            </p>
          </div>
          <span class="record-count">
            {{ filteredLeaves.length }} of
            {{ leaves.length }} requests
          </span>
        </div>

        <div class="register-toolbar">
          <div class="status-filter">
            <LeaveTabs v-model="leaveTab" />
          </div>

          <label class="enterprise-search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              v-model="leaveSearch"
              type="search"
              placeholder="Search leave requests..."
              aria-label="Search leave requests"
            />
          </label>
        </div>

        <LeaveTable
          :leaves="filteredLeaves"
          :pending-cancellations="pendingCancellations"
          @withdraw="openWithdraw"
          @request-cancellation="openCancellation"
        />
      </div>
    </section>

    <!-- WITHDRAW / CANCEL LEAVE -->
    <section
      v-else-if="activeTab === 'actions'"
      class="leave-content leave-actions-page"
    >
      <div class="leave-actions-card">
        <div class="leave-actions-heading">
          <div>
            <span class="page-eyebrow">ACTION CENTER</span>
            <h2>Leaves available for action</h2>
            <p>
              Pending leaves can be withdrawn.
              Approved future leaves can be sent to HR
              for cancellation.
            </p>
          </div>

          <span class="leave-actions-count">
            {{ filteredActionableLeaves.length }}
            {{ filteredActionableLeaves.length === 1 ? 'leave' : 'leaves' }}
          </span>
        </div>

        <div class="leave-action-search">
          <label>
            <span>Search by date</span>
            <input
              v-model="actionDateInput"
              type="date"
              aria-label="Search leave by date"
            />
          </label>

          <button
            type="button"
            class="leave-action-search-btn"
            @click="searchActionDate"
          >
            Search
          </button>

          <button
            type="button"
            class="leave-action-clear-btn"
            @click="clearActionDateSearch"
          >
            Show All Leaves
          </button>
        </div>

        <div
          v-if="!filteredActionableLeaves.length"
          class="leave-actions-empty"
        >
          <strong>
            {{
              actionDateSearch
                ? 'No actionable leaves found for this date'
                : 'No leaves available for action'
            }}
          </strong>

          <p>
            {{
              actionDateSearch
                ? 'Try another date.'
                : 'You have no pending or future approved leaves that can currently be changed.'
            }}
          </p>
        </div>

        <LeaveTable
          v-else
          :leaves="filteredActionableLeaves"
          :pending-cancellations="pendingCancellations"
          @withdraw="withdrawLeave"
          @request-cancellation="requestCancellation"
        />
      </div>
    </section>

    <!-- LEAVE BALANCE -->
    <section
  v-else
  class="leave-content"
>
  <div v-if="!Object.keys(balances).length" class="empty-balance">
    No leave allocated.
  </div>

  <div v-else class="balance-grid">

    <div
      v-for="(balance, type) in balances"
      :key="type"
      class="balance-card"
    >

      <div class="balance-top">
        <span class="balance-type">
          {{ type }}
        </span>

        <span class="balance-available">
          {{ balance.remaining_leaves }}
          <small>
            /{{ balance.total_leaves }} left
          </small>
        </span>
      </div>

      <div class="progress">
        <div
          :style="{
            width: balancePercentage(balance) + '%'
          }"
        ></div>
      </div>

      <div class="balance-row">
        <span>Used</span>
        <b>{{ balance.leaves_taken }}</b>
      </div>

      <div class="balance-row">
        <span>Pending approval</span>
        <b>{{ balance.leaves_pending_approval }}</b>
      </div>

    </div>

  </div>
</section>

    <!-- LEAVE ACTION DIALOG -->
    <div
      v-if="actionDialog.open"
      class="leave-dialog-backdrop"
      @click.self="closeActionDialog"
    >
      <section
        class="leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
      >
        <div class="leave-dialog-header">
          <div class="leave-dialog-icon">
            {{ actionDialog.type === 'withdraw' ? '↶' : '✎' }}
          </div>

          <button
            type="button"
            class="leave-dialog-close"
            aria-label="Close dialog"
            :disabled="actionBusy"
            @click="closeActionDialog"
          >
            ×
          </button>
        </div>

        <h2 id="leave-dialog-title">
          {{
            actionDialog.type === 'withdraw'
              ? 'Withdraw leave request?'
              : 'Request leave cancellation'
          }}
        </h2>

        <p class="leave-dialog-description">
          {{
            actionDialog.type === 'withdraw'
              ? 'This will withdraw your pending leave application.'
              : 'Your request will be sent to HR for review.'
          }}
        </p>

        <div class="leave-dialog-details">
          <strong>{{ actionDialog.leave?.leave_type }}</strong>
          <span>
            {{ actionDialog.leave?.from_date }}
            to {{ actionDialog.leave?.to_date }}
          </span>
        </div>

        <label
          v-if="actionDialog.type === 'cancel'"
          class="leave-dialog-field"
        >
          <span>Reason for cancellation</span>
          <textarea
            v-model="actionDialog.reason"
            rows="4"
            maxlength="1000"
            placeholder="Explain why you need to cancel this leave..."
          ></textarea>

          <small>
            {{ actionDialog.reason.trim().length }}/1000 characters
            · Minimum 10
          </small>
        </label>

        <p
          v-if="leavesError"
          class="leave-dialog-error"
          role="alert"
        >
          {{ leavesError }}
        </p>

        <div class="leave-dialog-actions">
          <button
            type="button"
            class="leave-dialog-secondary"
            :disabled="actionBusy"
            @click="closeActionDialog"
          >
            Cancel
          </button>

          <button
            type="button"
            class="leave-dialog-primary"
            :disabled="actionBusy"
            @click="confirmAction"
          >
            {{
              actionBusy
                ? 'Processing...'
                : actionDialog.type === 'withdraw'
                  ? 'Withdraw leave'
                  : 'Submit cancellation'
            }}
          </button>
        </div>
      </section>
    </div>

  </div>
</template>

<style scoped>
.leaves-page {
  width: 100%;
  min-width: 0;
  padding: 28px 32px 48px;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 22px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
  color: #172344;
}

.page-header p {
  margin: 7px 0 0;
  color: #69758d;
  font-size: 14px;
}

.leave-tabs {
  display: flex;
  width: fit-content;
  max-width: 100%;
  gap: 5px;
  margin-bottom: 24px;
  padding: 5px;
  border: 1px solid #e5e9f3;
  border-radius: 12px;
  background: white;
}

.leave-tabs button {
  border: 0;
  background: transparent;
  padding: 10px 18px;
  border-radius: 8px;
  color: #69758d;
  font-weight: 650;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.leave-tabs button:hover {
  background: #f3f2ff;
  color: #5145cd;
}

.leave-tabs button.active {
  background: #5145cd;
  color: white;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(310px, 1fr);
  gap: 24px;
  align-items: start;
  width: 100%;
  justify-content: stretch;
}

.panel {
  min-width: 0;
  box-sizing: border-box;
  background: white;
  border: 1px solid #e4e9f3;
  border-radius: 16px;
  box-shadow: 0 4px 18px rgba(22, 37, 76, .045);
}

.form-panel {
  padding: 30px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 24px;
  border-bottom: 1px solid #edf0f6;
}

.heading-icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #efedff;
  color: #5145cd;
  font-size: 24px;
}

.form-panel h2 {
  margin: 0;
  font-size: 21px;
  color: #172344;
}

.subtitle {
  margin: 6px 0 0;
  color: #69758d;
  font-size: 13px;
}

.form-fields {
  display: grid;
  gap: 21px;
  margin-top: 25px;
}

.field {
  min-width: 0;
}

.field label {
  display: block;
  margin-bottom: 9px;
  font-size: 13px;
  font-weight: 650;
  color: #33415c;
}

.field select,
.field input,
.field textarea {
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #dbe2ee;
  border-radius: 10px;
  padding: 12px 13px;
  font: inherit;
  font-size: 14px;
  background: #fff;
  color: #172344;
}

.field select:focus,
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: #6b60db;
  box-shadow: 0 0 0 3px #efedff;
}

.field textarea {
  resize: vertical;
  min-height: 112px;
}

.date-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  border-top: 1px solid #edf0f6;
  padding-top: 23px;
  margin-top: 26px;
}

.footer-note {
  color: #8994a9;
  font-size: 12px;
  margin: 0;
  max-width: 230px;
}

.form-footer button {
  border: 0;
  border-radius: 10px;
  background: #5145cd;
  color: white;
  font-weight: 700;
  font-size: 13px;
  padding: 13px 20px;
  cursor: pointer;
}

.form-footer button:hover:not(:disabled) {
  background: #4135ba;
}

.form-footer button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.right-column {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.balance-panel,
.summary-panel {
  padding: 26px;
}

.side-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.1px;
  color: #7b86a0;
  margin-bottom: 18px;
}

.balance-item {
  padding: 16px;
  border: 1px solid #edf0f6;
  border-radius: 12px;
  margin-top: 12px;
}

.balance-item.selected {
  background: #faf9ff;
  border-color: #d9d3ff;
}

.balance-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.balance-item-name {
  font-size: 14px;
  font-weight: 700;
  color: #253352;
}

.selected-tag {
  font-size: 10px;
  font-weight: 750;
  padding: 5px 8px;
  color: #5145cd;
  background: #eae7ff;
  border-radius: 20px;
}

.balance-value {
  margin: 14px 0;
  font-size: 30px;
  font-weight: 800;
  color: #172344;
}

.balance-value span {
  font-size: 12px;
  font-weight: 500;
  color: #7b86a0;
}

.balance-track {
  height: 7px;
  background: #e9ecf5;
  border-radius: 10px;
  overflow: hidden;
}

.balance-track div {
  height: 100%;
  background: #6b60db;
  border-radius: 10px;
}

.balance-caption {
  margin-top: 9px;
  font-size: 12px;
  color: #8994a9;
}

.summary-panel h3 {
  margin: 0;
  color: #172344;
  font-size: 17px;
}

.summary-subtitle {
  margin: 6px 0 22px;
  color: #8994a9;
  font-size: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #edf0f6;
  font-size: 13px;
}

.summary-row span,
.summary-total span {
  color: #7b86a0;
}

.summary-row strong {
  color: #253352;
  text-align: right;
}

.summary-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: 18px;
  padding: 16px;
  border-radius: 10px;
  background: #f3f2ff;
  font-size: 13px;
}

.summary-total strong {
  font-size: 23px;
  color: #5145cd;
}

.summary-total strong.negative {
  color: #dc2626;
}

.summary-footnote {
  margin: 17px 0 0;
  color: #8994a9;
  font-size: 11px;
  line-height: 1.55;
}

.warn {
  margin-top: 16px;
  padding: 12px;
  border-radius: 9px;
  background: #fff7ed;
  color: #92400e;
  font-size: 13px;
}

.err {
  margin-top: 12px;
  color: #dc2626;
  font-size: 13px;
}

.ok {
  margin-top: 12px;
  color: #16a34a;
  font-size: 13px;
}

.empty {
  color: #8994a9;
  font-size: 13px;
}

/* Existing My Leaves and Leave Balance components */

.my-leaves-toolbar {
  margin-bottom: 14px;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.balance-card {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 16px;
  padding: 22px 24px;
  box-shadow: 0 4px 14px rgba(16, 24, 40, .04);
}

.balance-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.balance-type {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.balance-available {
  font-size: 22px;
  font-weight: 600;
  color: #5b21f3;
}

.balance-available small {
  font-size: 13px;
  font-weight: 400;
  color: #667085;
}

.progress {
  height: 8px;
  background: #f0edff;
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress > div {
  height: 100%;
  background: #5b21f3;
  border-radius: 99px;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #667085;
  padding: 6px 0;
}

.balance-row b {
  color: #111827;
}

.empty-balance {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 14px;
  padding: 30px;
  color: #667085;
  font-size: 14px;
}

@media (max-width: 1050px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .right-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .leaves-page {
    padding: 18px 16px 32px;
  }

  .form-panel,
  .balance-panel,
  .summary-panel {
    padding: 20px;
  }

  .date-fields,
  .right-column {
    grid-template-columns: 1fr;
  }

  .leave-tabs {
    width: 100%;
  }

  .leave-tabs button {
    flex: 1;
    padding: 10px 5px;
    font-size: 12px;
  }
}

/* =========================
   Leaves UI refinement
   ========================= */

.leave-tabs {
  box-shadow: 0 2px 8px rgba(25, 39, 67, .025);
}

.leave-tabs button {
  transition:
    background .16s ease,
    color .16s ease,
    box-shadow .16s ease;
}

.leave-tabs button.active {
  box-shadow: 0 3px 8px rgba(79, 70, 229, .14);
}

.panel {
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
  transition:
    border-color .18s ease,
    box-shadow .18s ease;
}

.form-panel {
  border-color: #dfe5ef;
}

.form-panel:hover,
.balance-panel:hover,
.summary-panel:hover {
  border-color: #d9e0eb;
  box-shadow: 0 6px 18px rgba(25, 39, 67, .045);
}

.heading-icon {
  width: 42px;
  height: 42px;
  flex-basis: 42px;
  border-radius: 10px;
}

.field select,
.field input,
.field textarea {
  transition:
    border-color .16s ease,
    box-shadow .16s ease,
    background .16s ease;
}

.field select:hover:not(:disabled),
.field input:hover:not(:disabled),
.field textarea:hover:not(:disabled) {
  border-color: #cbd5e1;
}

.field select:disabled,
.field input:disabled,
.field textarea:disabled {
  background: #f8fafc;
  cursor: not-allowed;
}

.form-footer button {
  min-height: 42px;
  transition:
    background .16s ease,
    transform .16s ease,
    box-shadow .16s ease;
}

.form-footer button:hover:not(:disabled) {
  box-shadow: 0 5px 14px rgba(79, 70, 229, .16);
  transform: translateY(-1px);
}

.form-footer button:active:not(:disabled) {
  transform: translateY(0);
}

.balance-item {
  transition:
    border-color .16s ease,
    background .16s ease,
    transform .16s ease;
}

.balance-item:hover {
  border-color: #dce2ed;
  background: #fbfcfe;
  transform: translateY(-1px);
}

.balance-item.selected {
  border-color: #d8d3ff;
  background: #faf9ff;
}

.balance-track {
  height: 7px;
  background: #edf0f5;
}

.balance-track div {
  transition: width .3s ease;
}

.summary-total {
  border: 1px solid #e5e2ff;
  background: #f7f6ff;
}

.enterprise-stat {
  transition:
    border-color .18s ease,
    box-shadow .18s ease,
    transform .18s ease;
}

.enterprise-stat:hover {
  border-color: #d9e0eb;
  box-shadow: 0 6px 18px rgba(25, 39, 67, .05);
  transform: translateY(-1px);
}

.enterprise-register {
  padding: 24px 26px;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.enterprise-register .register-heading {
  margin-bottom: 18px;
}

.enterprise-register .register-toolbar {
  padding-bottom: 15px;
  border-bottom: 1px solid #edf1f7;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.balance-card {
  padding: 21px;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
  transition:
    border-color .18s ease,
    box-shadow .18s ease,
    transform .18s ease;
}

.balance-card:hover {
  border-color: #d9e0eb;
  box-shadow: 0 6px 18px rgba(25, 39, 67, .05);
  transform: translateY(-1px);
}

.balance-top {
  align-items: center;
}

.balance-type {
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.balance-available {
  color: #26334b;
  font-size: 22px;
  font-weight: 750;
}

.balance-available small {
  color: #8b97a9;
  font-size: 11px;
  font-weight: 500;
}

.progress {
  height: 7px;
  margin: 17px 0;
  border-radius: 999px;
  background: #edf0f5;
  overflow: hidden;
}

.progress div {
  height: 100%;
  border-radius: inherit;
  background: #4f46e5;
  transition: width .3s ease;
}

.balance-row {
  color: #7b86a0;
  font-size: 12px;
}

.balance-row b {
  color: #344054;
  font-weight: 700;
}

.empty-balance {
  padding: 48px 24px;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: #fff;
  color: #8b97a9;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .balance-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .leave-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .leave-tabs button {
    flex: 1 0 auto;
    padding: 9px 13px;
  }

  .form-panel,
  .balance-panel,
  .summary-panel {
    padding: 20px;
  }

  .date-fields {
    grid-template-columns: 1fr;
  }

  .balance-grid {
    gap: 10px;
  }

  .balance-card {
    padding: 18px;
  }

  .enterprise-register {
    padding: 19px;
  }
}


.leave-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, .48);
}

.leave-dialog {
  width: min(460px, 100%);
  padding: 24px;
  border: 1px solid #e5eaf2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
}

.leave-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.leave-dialog-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #f3f0ff;
  color: #5145cd;
  font-size: 19px;
}

.leave-dialog-close {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 22px;
  cursor: pointer;
}

.leave-dialog h2 {
  margin: 20px 0 8px;
  color: #172344;
  font-size: 21px;
}

.leave-dialog-description {
  margin: 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}

.leave-dialog-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid #eef1f6;
  border-radius: 10px;
  background: #f8fafc;
}

.leave-dialog-details strong {
  color: #172344;
  font-size: 13px;
}

.leave-dialog-details span {
  color: #667085;
  font-size: 12px;
}

.leave-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 18px;
}

.leave-dialog-field span {
  color: #344054;
  font-size: 12px;
  font-weight: 700;
}

.leave-dialog-field textarea {
  width: 100%;
  resize: vertical;
  padding: 11px 12px;
  box-sizing: border-box;
}

.leave-dialog-field small {
  color: #98a2b3;
  font-size: 11px;
}

.leave-dialog-error {
  margin: 14px 0 0;
  color: #b42318;
  font-size: 12px;
}

.leave-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.leave-dialog-secondary,
.leave-dialog-primary {
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.leave-dialog-secondary {
  border: 1px solid #dbe2ee;
  background: #fff;
  color: #52617e;
}

.leave-dialog-primary {
  border: 0;
  background: #5145cd;
  color: #fff;
}

.leave-dialog-secondary:disabled,
.leave-dialog-primary:disabled {
  opacity: .6;
  cursor: not-allowed;
}

</style>
<style scoped>
/* Final layout overrides */
@media (min-width: 1051px) {
  .leaves-page .layout {
    display: grid !important;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) !important;
    gap: 24px !important;
    justify-content: stretch !important;
    align-items: start;
  }

  .leaves-page .layout > .form-panel {
    width: 100% !important;
    max-width: none !important;
    min-width: 0;
    margin: 0 !important;
    justify-self: stretch;
  }

  .leaves-page .layout > .right-column {
    width: 100% !important;
    max-width: none !important;
    min-width: 0;
    margin: 0 !important;
    justify-self: stretch;
  }
}

/* Enterprise Leaves — refined page layout */

.leaves-page {
  padding: 32px clamp(20px, 3vw, 48px) 56px;
}

.enterprise-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.page-eyebrow {
  display: block;
  margin-bottom: 9px;
  color: #7b88a0;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.4px;
}

.enterprise-page-header h1 {
  margin: 0;
  color: #202d46;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -1px;
}

.enterprise-page-header p {
  margin: 9px 0 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}


.page-heading-action {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.page-heading-copy {
  min-width: 0;
}

.leave-action-back {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  margin-top: 2px;
  padding: 0;
  border: 1px solid #d9dee8;
  border-radius: 9px;
  background: #ffffff;
  color: #202d46;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.leave-action-back:hover {
  background: #f8fafc;
  border-color: #cbd3df;
}

.primary-page-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 42px;
  padding: 11px 17px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.primary-page-action:hover {
  background: #4338ca;
}

.primary-page-action span {
  font-size: 20px;
  font-weight: 400;
  line-height: 12px;
}

.enterprise-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
  margin: 24px 0;
}

.enterprise-stat {
  min-width: 0;
  padding: 20px 22px;
  border: 1px solid #e5eaf2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(23, 35, 59, .025);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #728097;
  font-size: 12px;
  font-weight: 600;
}

.stat-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  font-size: 17px;
  font-weight: 700;
}

.total-icon {
  background: #edf2ff;
  color: #5369b9;
}

.approved-icon {
  background: #e9f8ef;
  color: #198754;
}

.pending-icon {
  background: #fff4e5;
  color: #b7791f;
}

.rejected-icon {
  background: #fff0f1;
  color: #cf4959;
}

.enterprise-stat > strong {
  display: block;
  margin-top: 10px;
  color: #202d46;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -.8px;
}

.enterprise-stat > small {
  display: block;
  margin-top: 5px;
  color: #98a3b5;
  font-size: 11px;
}

.enterprise-register {
  margin-top: 27px;
}

.register-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 19px;
}

.register-heading h2 {
  margin: 0;
  color: #26334b;
  font-size: 18px;
  font-weight: 750;
}

.register-heading p {
  margin: 6px 0 0;
  color: #8b97a9;
  font-size: 12px;
}

.record-count {
  color: #8793a7;
  font-size: 12px;
  white-space: nowrap;
}

.register-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 17px;
}

.status-filter {
  min-width: 0;
}

.enterprise-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 275px;
  max-width: 100%;
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  background: #fff;
  color: #98a3b5;
}

.enterprise-search:focus-within {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px #eef2ff;
}

.enterprise-search svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.enterprise-search input {
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #26334b;
  font-size: 12px;
}

.enterprise-search input:focus {
  border: 0;
  outline: 0;
  box-shadow: none;
}

.enterprise-alert,
.enterprise-success {
  margin: 16px 0;
  padding: 13px 16px;
  border-radius: 9px;
  font-size: 12px;
}

.enterprise-alert {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.enterprise-success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

@media (max-width: 1100px) {
  .enterprise-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .leaves-page {
    padding: 22px 16px 36px;
  }

  .enterprise-page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .enterprise-page-header h1 {
    font-size: 25px;
  }

  .enterprise-stats {
    gap: 10px;
  }

  .enterprise-stat {
    padding: 15px;
  }

  .register-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .register-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .enterprise-search {
    width: 100%;
  }
}

@media (max-width: 390px) {
  .enterprise-stats {
    grid-template-columns: 1fr;
  }
}


/* Final Leaves polish */

.enterprise-register {
  overflow: hidden;
  padding: 24px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(23,35,59,.035);
}

.enterprise-register .leave-register {
  box-shadow: none;
}

.enterprise-register .register-heading {
  margin-bottom: 23px;
}

.enterprise-register .register-toolbar {
  margin-bottom: 20px;
}

.enterprise-stats {
  gap: 13px;
}

.enterprise-stat {
  padding: 18px 20px;
}

.enterprise-stat > strong {
  font-size: 27px;
}

.leave-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15,23,42,.58);
  backdrop-filter: blur(3px);
}

.leave-dialog {
  width: min(100%, 460px);
  padding: 27px;
  border: 1px solid #e5eaf2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15,23,42,.22);
}

.leave-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 17px;
}

.leave-dialog-icon {
  display: grid;
  width: 43px;
  height: 43px;
  place-items: center;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 23px;
}

.leave-dialog-close {
  padding: 0;
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  color: #8b97a9;
  font-size: 24px;
}

.leave-dialog-close:hover {
  background: #f1f5f9;
}

.leave-dialog h2 {
  margin: 0;
  color: #202d46;
  font-size: 21px;
  font-weight: 750;
}

.leave-dialog-description {
  margin: 9px 0 20px;
  color: #718096;
  font-size: 13px;
  line-height: 1.6;
}

.leave-dialog-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid #e5eaf2;
  border-radius: 10px;
  background: #f8fafc;
}

.leave-dialog-details strong {
  color: #26334b;
  font-size: 13px;
}

.leave-dialog-details span {
  color: #718096;
  font-size: 12px;
}

.leave-dialog-field {
  display: grid;
  gap: 9px;
  margin-top: 20px;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
}

.leave-dialog-field textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #dce3ed;
  border-radius: 9px;
  resize: vertical;
  font-size: 13px;
  font-weight: 400;
}

.leave-dialog-field small {
  color: #98a3b5;
  font-size: 11px;
  font-weight: 400;
}

.leave-dialog-error {
  margin-top: 15px;
  color: #b91c1c;
  font-size: 12px;
}

.leave-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 26px;
}

.leave-dialog-secondary,
.leave-dialog-primary {
  min-height: 39px;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.leave-dialog-secondary {
  border: 1px solid #dce3ed;
  background: #fff;
  color: #475569;
}

.leave-dialog-secondary:hover {
  background: #f8fafc;
}

.leave-dialog-primary {
  background: #4f46e5;
  color: #fff;
}

.leave-dialog-primary:hover {
  background: #4338ca;
}

@media (max-width: 700px) {
  .enterprise-register {
    padding: 17px;
  }

  .leave-dialog {
    padding: 22px;
  }
}

.leave-balance-hint {
  margin: 7px 2px 0;
  font-size: 12px;
  font-weight: 600;
  color: #7b86a0;
}

.secondary-page-action {
  border: 1px solid #dc2626;
  background: #fff;
  color: #b91c1c;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.secondary-page-action:hover {
  background: #fef2f2;
  border-color: #b91c1c;
}


.leave-actions-card {
  background: #ffffff;
  border: 1px solid #e7eaf0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.leave-actions-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.leave-actions-heading h2 {
  margin: 4px 0 6px;
  color: #202d46;
  font-size: 20px;
  font-weight: 750;
}

.leave-actions-heading p {
  margin: 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

.leave-actions-count {
  flex-shrink: 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
}

.leave-actions-empty {
  padding: 48px 24px;
  text-align: center;
  border: 1px dashed #d9dee8;
  border-radius: 12px;
  color: #667085;
}

.leave-actions-empty strong {
  display: block;
  margin-bottom: 6px;
  color: #344054;
}

.leave-actions-empty p {
  margin: 0;
  font-size: 13px;
}


.leave-action-search {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 20px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e7eaf0;
  border-radius: 12px;
}

.leave-action-search label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leave-action-search label span {
  color: #667085;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
}

.leave-action-search input {
  height: 38px;
  min-width: 170px;
  padding: 0 11px;
  border: 1px solid #d9dee8;
  border-radius: 8px;
  background: #fff;
  color: #344054;
  font-size: 13px;
}

.leave-action-search-btn,
.leave-action-clear-btn {
  height: 38px;
  padding: 0 15px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.leave-action-search-btn {
  border: 1px solid #202d46;
  background: #202d46;
  color: #fff;
}

.leave-action-clear-btn {
  border: 1px solid #d9dee8;
  background: #fff;
  color: #667085;
}

</style>


<style scoped>
/* ============================================================
   FINAL EMPLOYEE LEAVE PAGE POLISH
   ============================================================ */

.leaves-page {
  width: 100%;
  min-width: 0;
  padding: 28px 32px 48px;
  box-sizing: border-box;
  color: #192842;
}

.leaves-page .enterprise-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.leaves-page .enterprise-page-header h1 {
  margin: 0;
  color: #192842;
  font-size: 29px;
  line-height: 1.15;
  font-weight: 750;
  letter-spacing: -1px;
}

.leaves-page .enterprise-page-header p {
  margin: 8px 0 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

/* Dashboard-style purple action */

.leaves-page .secondary-page-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid #d9d6ff;
  border-radius: 9px;
  background: #ffffff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.leaves-page .secondary-page-action:hover {
  background: #f7f5ff;
  border-color: #bdb7ff;
}

/* Dashboard-like tabs */

.leaves-page .leave-tabs {
  display: inline-flex;
  width: fit-content;
  gap: 3px;
  margin-bottom: 18px;
  padding: 4px;
  border: 1px solid #e3e7ef;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.leaves-page .leave-tabs button {
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #66748c;
  font-size: 11px;
  font-weight: 700;
}

.leaves-page .leave-tabs button.active {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(79, 70, 229, .18);
}

/* Main two-column workspace */

.leaves-page .layout {
  display: grid !important;
  grid-template-columns:
    minmax(0, 1.45fr)
    minmax(320px, .85fr) !important;
  gap: 18px !important;
  align-items: start;
  width: 100%;
}

/* Form card */

.leaves-page .layout > .form-panel {
  width: 100% !important;
  max-width: none !important;
  min-width: 0;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 2px 12px rgba(25, 39, 67, .035);
}

.leaves-page .form-panel .section-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 20px 24px;
  margin: 0;
  border-bottom: 1px solid #edf0f5;
}

.leaves-page .form-panel .heading-icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: #eeeaff;
  color: #5b4fe1;
  font-size: 17px;
}

.leaves-page .form-panel h2 {
  margin: 0;
  color: #202d46;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 750;
}

.leaves-page .form-panel .subtitle {
  margin: 4px 0 0;
  color: #7c899e;
  font-size: 12px;
}

.leaves-page .form-panel .form-fields {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 22px 24px 4px;
}

.leaves-page .form-panel .field label {
  display: block;
  margin-bottom: 7px;
  color: #46546c;
  font-size: 11px;
  font-weight: 700;
}

.leaves-page .form-panel .field input,
.leaves-page .form-panel .field select,
.leaves-page .form-panel .field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  background: #ffffff;
  color: #25334d;
  font-size: 12px;
}

.leaves-page .form-panel .field input,
.leaves-page .form-panel .field select {
  height: 44px;
  padding: 0 12px;
}

.leaves-page .form-panel .field textarea {
  min-height: 110px;
  padding: 12px;
  resize: vertical;
  line-height: 1.55;
}

.leaves-page .form-panel .field input:focus,
.leaves-page .form-panel .field select:focus,
.leaves-page .form-panel .field textarea:focus {
  outline: none;
  border-color: #8f87ef;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, .08);
}

.leaves-page .form-panel .date-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.leaves-page .form-panel .leave-balance-hint {
  margin: 6px 0 0;
  color: #7c899e;
  font-size: 10px;
}

.leaves-page .form-panel .form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 22px;
  padding: 18px 24px 21px;
  border-top: 1px solid #edf0f5;
  background: #fbfcfe;
}

.leaves-page .form-panel .footer-note {
  max-width: 430px;
  margin: 0;
  color: #7c899e;
  font-size: 11px;
  line-height: 1.5;
}

.leaves-page .form-panel .form-footer button {
  min-height: 40px;
  padding: 0 17px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 3px 9px rgba(79, 70, 229, .16);
}

.leaves-page .form-panel .form-footer button:hover:not(:disabled) {
  background: #4338ca;
}

/* Right column */

.leaves-page .layout > .right-column {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  width: 100% !important;
  max-width: none !important;
  min-width: 0;
  margin: 0 !important;
}

/* Right-side cards */

.leaves-page .balance-panel,
.leaves-page .leave-help-panel {
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 2px 12px rgba(25, 39, 67, .035);
}

.leaves-page .side-eyebrow {
  display: block;
  margin-bottom: 12px;
  color: #5e6e8d;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 1.15px;
}

/* Balance */

.leaves-page .balance-item {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid #edf0f6;
  border-radius: 12px;
  background: #fafbfe;
}

.leaves-page .balance-item.selected {
  border-color: #d9d6ff;
  background: #f8f7ff;
}

.leaves-page .balance-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.leaves-page .balance-item-name {
  color: #283650;
  font-size: 12px;
  font-weight: 750;
}

.leaves-page .selected-tag {
  padding: 4px 7px;
  border-radius: 999px;
  background: #eeeaff;
  color: #5546df;
  font-size: 9px;
  font-weight: 750;
}

.leaves-page .balance-value {
  margin-top: 11px;
  color: #1f2c45;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: -.5px;
}

.leaves-page .balance-value span {
  margin-left: 5px;
  color: #7c899e;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
}

.leaves-page .balance-track {
  height: 7px;
  margin-top: 11px;
  overflow: hidden;
  border-radius: 999px;
  background: #eceef5;
}

.leaves-page .balance-track > div {
  height: 100%;
  border-radius: inherit;
  background: #5b4fe1;
}

.leaves-page .balance-caption {
  margin-top: 8px;
  color: #7c899e;
  font-size: 10px;
}

.leaves-page .side-empty {
  padding: 18px;
  border: 1px dashed #dfe4ee;
  border-radius: 10px;
  color: #7c899e;
  font-size: 11px;
  text-align: center;
}

/* Help panel */

.leaves-page .leave-help-panel h3 {
  margin: 0;
  color: #202d46;
  font-size: 16px;
  font-weight: 750;
}

.leaves-page .leave-help-intro {
  margin: 6px 0 16px;
  color: #7c899e;
  font-size: 11px;
  line-height: 1.55;
}

.leaves-page .leave-help-list {
  display: grid;
  gap: 13px;
}

.leaves-page .leave-help-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.leaves-page .leave-help-item > span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: #eeeaff;
  color: #5546df;
  font-size: 10px;
  font-weight: 750;
}

.leaves-page .leave-help-item strong {
  display: block;
  color: #344054;
  font-size: 11px;
  font-weight: 750;
}

.leaves-page .leave-help-item p {
  margin: 3px 0 0;
  color: #8490a4;
  font-size: 10px;
  line-height: 1.45;
}

/* Responsive */

@media (max-width: 900px) {
  .leaves-page .layout {
    grid-template-columns: 1fr !important;
  }

  .leaves-page .layout > .right-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .leaves-page {
    padding: 22px 16px 36px;
  }

  .leaves-page .enterprise-page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .leaves-page .secondary-page-action {
    width: 100%;
  }

  .leaves-page .form-panel .date-fields {
    grid-template-columns: 1fr;
  }

  .leaves-page .form-panel .form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .leaves-page .form-panel .form-footer button {
    width: 100%;
  }

  .leaves-page .layout > .right-column {
    grid-template-columns: 1fr;
  }
}
</style>


<style scoped>
/* ============================================================
   APPLY LEAVE — FINAL EMPLOYEE UI
   ============================================================ */

.leaves-page {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 28px 32px 48px;
  color: #192842;
}

/* Page header */

.leaves-page .enterprise-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.leaves-page .enterprise-page-header h1 {
  margin: 0;
  color: #192842;
  font-size: 29px;
  line-height: 1.15;
  font-weight: 750;
  letter-spacing: -1px;
}

.leaves-page .enterprise-page-header p {
  margin: 8px 0 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

.leaves-page .secondary-page-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid #d7d2ff;
  border-radius: 9px;
  background: #ffffff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: .16s ease;
}

.leaves-page .secondary-page-action:hover {
  background: #f7f5ff;
  border-color: #bdb7ff;
}

/* Tabs */

.leaves-page .leave-tabs {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  width: fit-content;
  margin-bottom: 18px;
  padding: 4px;
  border: 1px solid #e3e7ef;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.leaves-page .leave-tabs button {
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #66748c;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.leaves-page .leave-tabs button:hover {
  background: #f7f5ff;
  color: #4f46e5;
}

.leaves-page .leave-tabs button.active {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(79, 70, 229, .18);
}

/* Apply Leave workspace */

.leaves-page .leave-content {
  width: 100%;
}

.leaves-page .leave-content > .layout {
  display: block !important;
  width: 100%;
  margin: 0;
}

/* Main card */

.leaves-page .leave-content > .layout > .form-panel {
  width: min(100%, 1180px) !important;
  max-width: 1180px !important;
  margin: 0 auto !important;
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid #e5eaf2;
  border-radius: 15px;
  background: #ffffff;
  box-shadow:
    0 2px 12px rgba(25, 39, 67, .035),
    0 10px 28px rgba(25, 39, 67, .025);
}

/* Form header */

.leaves-page .form-panel .section-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 22px 26px;
  margin: 0;
  border-bottom: 1px solid #edf0f5;
  background: #ffffff;
}

.leaves-page .form-panel .heading-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: #eeeaff;
  color: #5b4fe1;
  font-size: 17px;
}

.leaves-page .leave-form-eyebrow {
  display: block;
  margin-bottom: 3px;
  color: #7b88a0;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.leaves-page .form-panel h2 {
  margin: 0;
  color: #202d46;
  font-size: 19px;
  line-height: 1.25;
  font-weight: 750;
  letter-spacing: -.25px;
}

.leaves-page .form-panel .subtitle {
  margin: 5px 0 0;
  color: #7c899e;
  font-size: 12px;
  line-height: 1.5;
}

/* Fields */

.leaves-page .form-panel .form-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 18px;
  margin: 0;
  padding: 25px 26px 4px;
}

.leaves-page .form-panel .form-fields > .field:first-child {
  grid-column: 1 / -1;
}

.leaves-page .form-panel .form-fields > .field:last-child {
  grid-column: 1 / -1;
}

.leaves-page .form-panel .field {
  min-width: 0;
}

.leaves-page .form-panel .field label {
  display: block;
  margin-bottom: 7px;
  color: #46546c;
  font-size: 11px;
  font-weight: 700;
}

.leaves-page .form-panel .field select,
.leaves-page .form-panel .field input,
.leaves-page .form-panel .field textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  background: #ffffff;
  color: #25334d;
  font-size: 12px;
  transition:
    border-color .16s ease,
    box-shadow .16s ease,
    background .16s ease;
}

.leaves-page .form-panel .field select,
.leaves-page .form-panel .field input {
  height: 44px;
  padding: 0 12px;
}

.leaves-page .form-panel .field textarea {
  min-height: 120px;
  padding: 12px;
  resize: vertical;
  line-height: 1.55;
}

.leaves-page .form-panel .field select:focus,
.leaves-page .form-panel .field input:focus,
.leaves-page .form-panel .field textarea:focus {
  outline: none;
  border-color: #8d85eb;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, .08);
}

.leaves-page .form-panel .field select:hover,
.leaves-page .form-panel .field input:hover,
.leaves-page .form-panel .field textarea:hover {
  border-color: #cbd3e0;
}

/* Dates */

.leaves-page .form-panel .date-fields {
  display: contents;
}

.leaves-page .form-panel .date-fields > .field {
  min-width: 0;
}

/* Half-day helper */

.leaves-page .form-panel > p:not(.err):not(.ok):not(.warn) {
  margin: 0 26px;
  color: #7c899e;
  font-size: 11px;
}

/* Validation / status messages */

.leaves-page .form-panel .warn,
.leaves-page .form-panel .err,
.leaves-page .form-panel .ok {
  margin: 17px 26px 0;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.5;
}

.leaves-page .form-panel .warn {
  background: #fff8eb;
  border: 1px solid #f5dfb0;
  color: #a16207;
}

.leaves-page .form-panel .err {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #dc2626;
}

.leaves-page .form-panel .ok {
  background: #effaf5;
  border: 1px solid #ccebdd;
  color: #16875b;
}

/* Footer */

.leaves-page .form-panel .form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 24px;
  padding: 18px 26px 21px;
  border-top: 1px solid #edf0f5;
  background: #fbfcfe;
}

.leaves-page .form-panel .footer-note {
  max-width: 460px;
  margin: 0;
  color: #7c899e;
  font-size: 11px;
  line-height: 1.5;
}

.leaves-page .form-panel .form-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 3px 9px rgba(79, 70, 229, .16);
  transition:
    background .16s ease,
    transform .16s ease,
    box-shadow .16s ease;
}

.leaves-page .form-panel .form-footer button:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(79, 70, 229, .2);
}

.leaves-page .form-panel .form-footer button:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Desktop breathing room */

@media (min-width: 1100px) {
  .leaves-page .leave-content > .layout > .form-panel {
    min-height: 480px;
  }
}

/* Tablet */

@media (max-width: 800px) {
  .leaves-page {
    padding: 24px 20px 40px;
  }

  .leaves-page .form-panel .form-fields {
    grid-template-columns: 1fr;
  }

  .leaves-page .form-panel .form-fields > .field:first-child,
  .leaves-page .form-panel .form-fields > .field:last-child {
    grid-column: auto;
  }
}

/* Mobile */

@media (max-width: 600px) {
  .leaves-page {
    padding: 20px 16px 32px;
  }

  .leaves-page .enterprise-page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .leaves-page .secondary-page-action {
    width: 100%;
  }

  .leaves-page .leave-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .leaves-page .leave-tabs button {
    flex: 1 0 auto;
  }

  .leaves-page .form-panel .section-heading,
  .leaves-page .form-panel .form-fields,
  .leaves-page .form-panel .form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }

  .leaves-page .form-panel .form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .leaves-page .form-panel .form-footer button {
    width: 100%;
  }
}
</style>


<style scoped>
/* ============================================================
   APPLY LEAVE — PRODUCT-QUALITY EMPLOYEE UI
   ============================================================ */

.leaves-page .apply-form-card {
  width: min(100%, 1180px) !important;
  max-width: 1180px !important;
  margin: 0 auto !important;
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid #e4e8f1;
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 2px 8px rgba(25, 39, 67, .025),
    0 16px 40px rgba(25, 39, 67, .045);
}

/* ------------------------------------------------------------
   HERO
   ------------------------------------------------------------ */

.leaves-page .apply-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 25px 28px;
  border-bottom: 1px solid #ebeef5;
  background:
    linear-gradient(
      135deg,
      #fbfaff 0%,
      #f7f6ff 55%,
      #ffffff 100%
    );
}

.leaves-page .apply-form-heading {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}

.leaves-page .apply-form-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #ded9ff;
  border-radius: 13px;
  background: #efedff;
  color: #5548db;
  box-shadow:
    0 4px 10px rgba(79, 70, 229, .08);
}

.leaves-page .apply-form-icon span {
  font-size: 20px;
  line-height: 1;
}

.leaves-page .leave-form-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #6f6a9b;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.35px;
}

.leaves-page .apply-form-header h2 {
  margin: 0;
  color: #1d2942;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 780;
  letter-spacing: -.45px;
}

.leaves-page .apply-form-header p {
  max-width: 620px;
  margin: 5px 0 0;
  color: #7b879f;
  font-size: 12px;
  line-height: 1.55;
}

.leaves-page .draft-chip {
  flex-shrink: 0;
  padding: 7px 10px;
  border: 1px solid #ddd9ff;
  border-radius: 999px;
  background: #ffffff;
  color: #655bd1;
  font-size: 10px;
  font-weight: 750;
}

/* ------------------------------------------------------------
   BODY
   ------------------------------------------------------------ */

.leaves-page .apply-form-body {
  padding: 27px 28px 25px;
}

.leaves-page .apply-form-section {
  padding: 0;
}

.leaves-page .apply-form-section + .apply-form-section {
  margin-top: 30px;
  padding-top: 28px;
  border-top: 1px solid #edf0f5;
}

.leaves-page .apply-section-heading {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 18px;
}

.leaves-page .apply-section-number {
  display: grid;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
  background: #eeeaff;
  color: #5548db;
  font-size: 9px;
  font-weight: 800;
}

.leaves-page .apply-section-heading strong {
  display: block;
  color: #25324c;
  font-size: 13px;
  font-weight: 750;
}

.leaves-page .apply-section-heading p {
  margin: 3px 0 0;
  color: #8a95a9;
  font-size: 10px;
  line-height: 1.5;
}

/* ------------------------------------------------------------
   FIELDS
   ------------------------------------------------------------ */

.leaves-page .apply-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.leaves-page .apply-fields .field-full {
  grid-column: 1 / -1;
}

.leaves-page .apply-fields .field {
  min-width: 0;
}

.leaves-page .apply-fields .field label,
.leaves-page .reason-section .field label {
  display: block;
  margin-bottom: 7px;
  color: #43516b;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .05px;
}

.leaves-page .apply-fields select,
.leaves-page .apply-fields input,
.leaves-page .reason-section textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dce2ec;
  border-radius: 11px;
  background: #ffffff;
  color: #26344e;
  font-size: 12px;
  transition:
    border-color .16s ease,
    box-shadow .16s ease,
    background .16s ease;
}

.leaves-page .apply-fields select,
.leaves-page .apply-fields input {
  height: 46px;
  padding: 0 13px;
}

.leaves-page .apply-fields select:hover,
.leaves-page .apply-fields input:hover,
.leaves-page .reason-section textarea:hover {
  border-color: #c6cfdd;
}

.leaves-page .apply-fields select:focus,
.leaves-page .apply-fields input:focus,
.leaves-page .reason-section textarea:focus {
  outline: none;
  border-color: #867deb;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, .07);
}

.leaves-page .reason-section textarea {
  min-height: 125px;
  padding: 13px;
  resize: vertical;
  line-height: 1.6;
}

.leaves-page .reason-section textarea::placeholder {
  color: #a2abbb;
}

.leaves-page .field-hint {
  margin-top: 6px;
  color: #9aa4b4;
  font-size: 9px;
}

/* ------------------------------------------------------------
   HALF-DAY OPTIONS
   ------------------------------------------------------------ */

.leaves-page .session-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.leaves-page .session-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 0 13px;
  border: 1px solid #dfe4ed;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
  transition:
    border-color .16s ease,
    background .16s ease,
    box-shadow .16s ease;
}

.leaves-page .session-option:hover {
  border-color: #c8c2fb;
  background: #faf9ff;
}

.leaves-page .session-option input {
  width: 15px;
  height: 15px;
  accent-color: #5548db;
}

.leaves-page .session-option span {
  display: grid;
  gap: 2px;
}

.leaves-page .session-option strong {
  color: #33415c;
  font-size: 11px;
  font-weight: 750;
}

.leaves-page .session-option small {
  color: #8c97aa;
  font-size: 9px;
}

/* ------------------------------------------------------------
   SUMMARY
   ------------------------------------------------------------ */

.leaves-page .request-summary {
  margin-top: 27px;
  padding: 17px;
  border: 1px solid #e5e1ff;
  border-radius: 13px;
  background: #faf9ff;
}

.leaves-page .request-summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.leaves-page .summary-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #756ca8;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.15px;
}

.leaves-page .request-summary-heading strong {
  color: #2f3b56;
  font-size: 12px;
  font-weight: 750;
}

.leaves-page .summary-status {
  padding: 6px 9px;
  border: 1px solid #e5e1ea;
  border-radius: 999px;
  background: #ffffff;
  color: #8a93a4;
  font-size: 9px;
  font-weight: 750;
  white-space: nowrap;
}

.leaves-page .summary-status.ready {
  border-color: #cfe7dc;
  background: #f2fbf6;
  color: #16875b;
}

.leaves-page .summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.leaves-page .summary-item {
  padding: 12px;
  border: 1px solid #ebe8f7;
  border-radius: 10px;
  background: #ffffff;
}

.leaves-page .summary-item span {
  display: block;
  margin-bottom: 5px;
  color: #929baa;
  font-size: 9px;
}

.leaves-page .summary-item strong {
  color: #2f3b56;
  font-size: 11px;
  font-weight: 750;
}

/* ------------------------------------------------------------
   MESSAGES
   ------------------------------------------------------------ */

.leaves-page .apply-form-body > .warn,
.leaves-page .apply-form-body > .err,
.leaves-page .apply-form-body > .ok {
  margin: 15px 0 0;
  padding: 11px 13px;
  border-radius: 10px;
  font-size: 10px;
  line-height: 1.5;
}

.leaves-page .apply-form-body > .warn {
  border: 1px solid #f2dfb3;
  background: #fff9ee;
  color: #a16207;
}

.leaves-page .apply-form-body > .err {
  border: 1px solid #fecdd3;
  background: #fff2f4;
  color: #dc2626;
}

.leaves-page .apply-form-body > .ok {
  border: 1px solid #cde9db;
  background: #f1fbf5;
  color: #16875b;
}

/* ------------------------------------------------------------
   FOOTER
   ------------------------------------------------------------ */

.leaves-page .apply-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 28px;
  border-top: 1px solid #ebeff5;
  background: #fbfcfe;
}

.leaves-page .footer-message {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.leaves-page .footer-check {
  display: grid;
  width: 31px;
  height: 31px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: #eaf7f0;
  color: #16875b;
  font-size: 14px;
  font-weight: 800;
}

.leaves-page .footer-message strong {
  display: block;
  color: #34415a;
  font-size: 10px;
  font-weight: 750;
}

.leaves-page .footer-message p {
  margin: 2px 0 0;
  color: #8a95a9;
  font-size: 9px;
  line-height: 1.4;
}

.leaves-page .apply-form-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 190px;
  min-height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: #5146d8;
  color: #ffffff;
  font-size: 10px;
  font-weight: 750;
  box-shadow: 0 5px 12px rgba(79, 70, 229, .15);
  cursor: pointer;
  transition:
    background .16s ease,
    transform .16s ease,
    box-shadow .16s ease;
}

.leaves-page .apply-form-footer button:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
  box-shadow: 0 7px 16px rgba(79, 70, 229, .2);
}

.leaves-page .apply-form-footer button:disabled {
  opacity: .45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.leaves-page .submit-arrow {
  font-size: 15px;
  line-height: 1;
}

/* ------------------------------------------------------------
   RESPONSIVE
   ------------------------------------------------------------ */

@media (max-width: 800px) {
  .leaves-page .apply-form-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .leaves-page .apply-fields {
    grid-template-columns: 1fr;
  }

  .leaves-page .apply-fields .field-full {
    grid-column: auto;
  }

  .leaves-page .summary-grid {
    grid-template-columns: 1fr;
  }

  .leaves-page .apply-form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .leaves-page .apply-form-footer button {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .leaves-page .apply-form-body,
  .leaves-page .apply-form-header,
  .leaves-page .apply-form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }

  .leaves-page .session-options {
    grid-template-columns: 1fr;
  }

  .leaves-page .draft-chip {
    align-self: flex-start;
  }
}
</style>


<style scoped>
/* ============================================================
   LEAVES — PREMIUM EMPLOYEE APPLY EXPERIENCE
   ============================================================ */

.leaves-page .leave-content > .layout {
  display: grid !important;
  grid-template-columns:
    minmax(0, 1fr)
    minmax(285px, 330px) !important;
  gap: 20px !important;
  align-items: start;
  width: 100%;
}

/* ------------------------------------------------------------
   MAIN FORM
   ------------------------------------------------------------ */

.leaves-page .apply-form-card {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid #e4e8f0;
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 2px 8px rgba(20, 32, 56, .025),
    0 14px 34px rgba(20, 32, 56, .035);
}

/* Cleaner header */

.leaves-page .apply-form-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 25px 26px 23px;
  border-bottom: 1px solid #edf0f5;
  background:
    linear-gradient(
      135deg,
      #ffffff 0%,
      #faf9ff 100%
    );
}

.leaves-page .apply-form-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}

.leaves-page .apply-form-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #ddd8ff;
  border-radius: 12px;
  background: #f0eeff;
  color: #5648da;
  box-shadow: none;
}

.leaves-page .apply-form-icon span {
  font-size: 18px;
}

.leaves-page .leave-form-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #736ba5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.25px;
}

.leaves-page .apply-form-header h2 {
  margin: 0;
  color: #1d2941;
  font-size: 21px;
  font-weight: 760;
  letter-spacing: -.4px;
}

.leaves-page .apply-form-header p {
  margin: 5px 0 0;
  color: #7f8aa0;
  font-size: 11px;
  line-height: 1.5;
}

.leaves-page .draft-chip {
  display: none;
}

/* Body */

.leaves-page .apply-form-body {
  padding: 25px 26px 26px;
}

/* Remove "01 / 02" visual treatment */

.leaves-page .apply-section-number {
  display: none;
}

.leaves-page .apply-section-heading {
  margin-bottom: 15px;
}

.leaves-page .apply-section-heading strong {
  color: #27344d;
  font-size: 13px;
  font-weight: 750;
}

.leaves-page .apply-section-heading p {
  margin-top: 3px;
  color: #929bac;
  font-size: 10px;
}

.leaves-page .apply-form-section + .apply-form-section {
  margin-top: 25px;
  padding-top: 25px;
  border-top: 1px solid #edf0f4;
}

/* Fields */

.leaves-page .apply-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
}

.leaves-page .apply-fields .field-full {
  grid-column: 1 / -1;
}

.leaves-page .apply-fields .field label,
.leaves-page .reason-section .field label {
  display: block;
  margin-bottom: 7px;
  color: #48546b;
  font-size: 10px;
  font-weight: 750;
}

.leaves-page .apply-fields select,
.leaves-page .apply-fields input,
.leaves-page .reason-section textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe4ed;
  border-radius: 10px;
  background: #ffffff;
  color: #25334c;
  font-size: 11px;
}

.leaves-page .apply-fields select,
.leaves-page .apply-fields input {
  height: 43px;
  padding: 0 12px;
}

.leaves-page .reason-section textarea {
  min-height: 118px;
  padding: 12px;
  resize: vertical;
  line-height: 1.55;
}

.leaves-page .apply-fields select:focus,
.leaves-page .apply-fields input:focus,
.leaves-page .reason-section textarea:focus {
  outline: none;
  border-color: #8178e7;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, .065);
}

.leaves-page .apply-fields select:hover,
.leaves-page .apply-fields input:hover,
.leaves-page .reason-section textarea:hover {
  border-color: #cbd3df;
}

.leaves-page .field-hint {
  margin-top: 6px;
  color: #99a2b1;
  font-size: 9px;
}

/* Half-day */

.leaves-page .session-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.leaves-page .session-option {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 54px;
  padding: 0 12px;
  border: 1px solid #dfe4ec;
  border-radius: 10px;
  background: #ffffff;
}

.leaves-page .session-option:hover {
  border-color: #c8c1fa;
  background: #faf9ff;
}

.leaves-page .session-option input {
  width: 14px;
  height: 14px;
  accent-color: #5548da;
}

.leaves-page .session-option span {
  display: grid;
  gap: 2px;
}

.leaves-page .session-option strong {
  color: #35415a;
  font-size: 10px;
}

.leaves-page .session-option small {
  color: #929baa;
  font-size: 9px;
}

/* Messages */

.leaves-page .apply-form-body > .warn,
.leaves-page .apply-form-body > .err,
.leaves-page .apply-form-body > .ok {
  margin: 16px 0 0;
  padding: 10px 12px;
  border-radius: 9px;
  font-size: 10px;
}

.leaves-page .apply-form-body > .warn {
  border: 1px solid #f3dfb1;
  background: #fff9ee;
  color: #a16207;
}

.leaves-page .apply-form-body > .err {
  border: 1px solid #fecdd3;
  background: #fff2f4;
  color: #dc2626;
}

.leaves-page .apply-form-body > .ok {
  border: 1px solid #cde8da;
  background: #f0faf4;
  color: #16875b;
}

/* Footer */

.leaves-page .apply-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 17px 26px;
  border-top: 1px solid #edf0f5;
  background: #fbfcfe;
}

.leaves-page .footer-message {
  display: flex;
  align-items: center;
  gap: 9px;
}

.leaves-page .footer-check {
  display: grid;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
  background: #eaf7f0;
  color: #16875b;
  font-size: 13px;
  font-weight: 800;
}

.leaves-page .footer-message strong {
  display: block;
  color: #38445b;
  font-size: 10px;
}

.leaves-page .footer-message p {
  margin: 2px 0 0;
  color: #929baa;
  font-size: 9px;
}

.leaves-page .apply-form-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  min-width: 178px;
  height: 41px;
  padding: 0 15px;
  border: 0;
  border-radius: 9px;
  background: #5146d8;
  color: #ffffff;
  font-size: 10px;
  font-weight: 750;
  box-shadow: 0 5px 12px rgba(79, 70, 229, .15);
  cursor: pointer;
}

.leaves-page .apply-form-footer button:hover:not(:disabled) {
  background: #4338ca;
}

.leaves-page .apply-form-footer button:disabled {
  opacity: .45;
  cursor: not-allowed;
  box-shadow: none;
}

/* ------------------------------------------------------------
   RIGHT SUMMARY PANEL
   ------------------------------------------------------------ */

.leaves-page .apply-summary-panel {
  position: sticky;
  top: 22px;
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  border: 1px solid #e4e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow:
    0 2px 8px rgba(20, 32, 56, .025),
    0 12px 30px rgba(20, 32, 56, .03);
}

.leaves-page .apply-summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.leaves-page .apply-summary-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: #756ca6;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.15px;
}

.leaves-page .apply-summary-top h3 {
  margin: 0;
  color: #26344d;
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -.2px;
}

.leaves-page .apply-summary-top p {
  margin: 4px 0 0;
  color: #8a95a8;
  font-size: 9px;
  line-height: 1.45;
}

.leaves-page .apply-summary-status {
  flex-shrink: 0;
  padding: 6px 8px;
  border: 1px solid #e0e4eb;
  border-radius: 999px;
  background: #fafbfc;
  color: #8c95a5;
  font-size: 8px;
  font-weight: 750;
}

.leaves-page .apply-summary-status.ready {
  border-color: #cde6d8;
  background: #f0faf4;
  color: #16875b;
}

.leaves-page .apply-summary-list {
  display: grid;
  margin-top: 18px;
  border-top: 1px solid #edf0f4;
}

.leaves-page .apply-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 0;
  border-bottom: 1px solid #edf0f4;
}

.leaves-page .apply-summary-row span {
  color: #939cab;
  font-size: 9px;
}

.leaves-page .apply-summary-row strong {
  color: #33415a;
  font-size: 10px;
  font-weight: 750;
  text-align: right;
}

.leaves-page .apply-summary-divider {
  height: 1px;
  margin: 18px 0;
  background: #edf0f4;
}

.leaves-page .apply-approver-card {
  display: grid;
  grid-template-columns: 31px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 13px;
  border: 1px solid #e8e9f5;
  border-radius: 11px;
  background: #fafaff;
}

.leaves-page .apply-approver-icon {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 8px;
  background: #eeeaff;
  color: #5548da;
  font-size: 13px;
  font-weight: 800;
}

.leaves-page .apply-approver-card strong {
  display: block;
  color: #34415a;
  font-size: 10px;
}

.leaves-page .apply-approver-card p {
  margin: 3px 0 0;
  color: #9099a9;
  font-size: 9px;
  line-height: 1.45;
}

.leaves-page .apply-summary-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 13px;
}

.leaves-page .apply-summary-note > span {
  display: grid;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 6px;
  background: #f1f3f8;
  color: #718096;
  font-size: 9px;
  font-weight: 800;
}

.leaves-page .apply-summary-note p {
  margin: 1px 0 0;
  color: #8b95a5;
  font-size: 9px;
  line-height: 1.5;
}

/* ------------------------------------------------------------
   RESPONSIVE
   ------------------------------------------------------------ */

@media (max-width: 900px) {
  .leaves-page .leave-content > .layout {
    grid-template-columns: 1fr !important;
  }

  .leaves-page .apply-summary-panel {
    position: static;
  }
}

@media (max-width: 650px) {
  .leaves-page .apply-form-body {
    padding-left: 18px;
    padding-right: 18px;
  }

  .leaves-page .apply-form-header,
  .leaves-page .apply-form-footer {
    padding-left: 18px;
    padding-right: 18px;
  }

  .leaves-page .apply-fields {
    grid-template-columns: 1fr;
  }

  .leaves-page .apply-fields .field-full {
    grid-column: auto;
  }

  .leaves-page .session-options {
    grid-template-columns: 1fr;
  }

  .leaves-page .apply-form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .leaves-page .apply-form-footer button {
    width: 100%;
  }
}
</style>
