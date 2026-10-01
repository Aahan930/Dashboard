<script setup>
import { ref, computed, onMounted } from 'vue'
import api, { errMsg, isHR } from '../api'

const email = localStorage.getItem('user')

const loading = ref(true)
const acting = ref('')
const error = ref('')

const leaveRequests = ref([])
const timesheets = ref([])
const cancellationRequests = ref([])
const canReviewCancellations = ref(false)


/* =========================
   LOAD LEAVE REQUESTS
========================= */

async function loadLeaveRequests() {
  const res = await api.get(
    '/api/resource/Leave Application',
    {
      params: {
        filters: JSON.stringify(
          isHR()
            ? [
                ['workflow_state', '=', 'Pending'],
                ['owner', '!=', email]
              ]
            : [
                ['leave_approver', '=', email],
                ['workflow_state', '=', 'Pending'],
                ['owner', '!=', email]
              ]
        ),
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
        order_by: 'creation desc',
        limit_page_length: 200
      }
    }
  )

  leaveRequests.value =
    res.data.data || []
}

/* =========================
   LOAD TIMESHEETS
========================= */

async function loadTimesheets() {
  const employeeRes = await api.get(
    '/api/resource/Employee',
    {
      params: {
        filters: JSON.stringify([
          ['leave_approver', '=', email],
          ['status', '=', 'Active']
        ]),
        fields: JSON.stringify([
          'name'
        ]),
        limit_page_length: 200
      }
    }
  )

  const employees =
    employeeRes.data.data || []

  if (!employees.length) {
    timesheets.value = []
    return
  }

  const employeeIds =
    employees.map(
      (employee) => employee.name
    )

  const res = await api.get(
    '/api/resource/Timesheet',
    {
      params: {
        filters: JSON.stringify([
          ['employee', 'in', employeeIds],
          ['workflow_state', '=', 'Pending']
        ]),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'start_date',
          'end_date',
          'total_hours',
          'status',
          'workflow_state'
        ]),
        order_by: 'creation desc',
        limit_page_length: 200
      }
    }
  )

  timesheets.value =
    res.data.data || []
}

/* =========================
   LOAD CANCELLATION REQUESTS
========================= */

async function loadCancellationRequests() {
  try {
    const res = await api.get(
      '/api/method/hr_portal_custom.api.leave_cancellation_request.pending_cancellation_requests'
    )

    cancellationRequests.value = res.data.message || []
    canReviewCancellations.value = true
  } catch (e) {
    if ([401, 403].includes(e.response?.status)) {
      cancellationRequests.value = []
      canReviewCancellations.value = false
      return
    }

    throw e
  }
}

/* =========================
   LOAD EVERYTHING
========================= */

async function load() {
  loading.value = true
  error.value = ''

  try {
    await Promise.all([
      loadLeaveRequests(),
      loadTimesheets(),
      loadCancellationRequests()
    ])
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load pending approvals'
    )
  } finally {
    loading.value = false
  }
}

/* =========================
   COUNTS
========================= */

const leaveCount = computed(
  () => leaveRequests.value.length
)

const timesheetCount = computed(
  () => timesheets.value.length
)

const totalCount = computed(
  () =>
    leaveCount.value +
    timesheetCount.value +
    cancellationRequests.value.length
)

/* =========================
   APPROVAL ACTION
========================= */

async function act(name, action) {
  const key = `${name}:${action}`

  acting.value = key
  error.value = ''

  try {
    let doc

    if (
      leaveRequests.value.some(
        (item) => item.name === name
      )
    ) {
      const res = await api.get(
        `/api/resource/Leave Application/${encodeURIComponent(name)}`
      )

      doc = res.data.data
    } else {
      const res = await api.get(
        `/api/resource/Timesheet/${encodeURIComponent(name)}`
      )

      doc = res.data.data
    }

    await api.post(
      '/api/method/frappe.model.workflow.apply_workflow',
      {
        doc: JSON.stringify(doc),
        action
      }
    )

    await load()
  } catch (e) {
    error.value = errMsg(
      e,
      `Could not ${action.toLowerCase()} request`
    )
  } finally {
    acting.value = ''
  }
}

/* =========================
   CANCELLATION REVIEW
========================= */

async function reviewCancellation(request, action) {
  const confirmed = window.confirm(
    `${action} cancellation of leave ${request.leave_application}?`
  )

  if (!confirmed) return

  acting.value = `${request.name}:${action}`
  error.value = ''

  try {
    await api.post(
      '/api/method/hr_portal_custom.api.leave_cancellation_request.review_cancellation',
      {
        request_name: request.name,
        action
      }
    )

    await load()
  } catch (e) {
    error.value = errMsg(
      e,
      `Could not ${action.toLowerCase()} cancellation`
    )
  } finally {
    acting.value = ''
  }
}

/* =========================
   INITIAL LOAD
========================= */

onMounted(load)
</script>

<template>
  <div class="approvals-page">

    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <div class="eyebrow">
          MANAGER WORKSPACE
        </div>

        <h1>
          Pending Approvals
        </h1>

        <p>
          Review leave requests and
          timesheets waiting for your decision.
        </p>
      </div>

      <button
        class="refresh-btn"
        :disabled="loading"
        @click="load"
      >
        <span v-if="loading">
          Loading...
        </span>

        <span v-else>
          ↻ Refresh
        </span>
      </button>
    </div>

    <!-- ERROR -->
    <div
      v-if="error"
      class="error-box"
    >
      <div class="error-icon">
        !
      </div>

      <div>
        <strong>
          Something went wrong
        </strong>

        <p>
          {{ error }}
        </p>
      </div>
    </div>

    <!-- LOADING -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <div class="spinner"></div>

      <p>
        Loading pending approvals...
      </p>
    </div>

    <template v-else>

      <!-- SUMMARY CARDS -->
      <section class="summary-grid">

        <div class="summary-card total-card">
          <div class="summary-icon purple">
            ⏳
          </div>

          <div class="summary-content">
            <span class="summary-label">
              Awaiting your action
            </span>

            <strong class="summary-number">
              {{ totalCount }}
            </strong>

            <span class="summary-description">
              requests waiting for review
            </span>
          </div>
        </div>

        <div class="summary-card leave-card">
          <div class="summary-icon blue">
            📅
          </div>

          <div class="summary-content">
            <span class="summary-label">
              Leave requests
            </span>

            <strong class="summary-number">
              {{ leaveCount }}
            </strong>

            <span class="summary-description">
              waiting for approval
            </span>
          </div>
        </div>

        <div class="summary-card timesheet-card">
          <div class="summary-icon green">
            🕘
          </div>

          <div class="summary-content">
            <span class="summary-label">
              Timesheets
            </span>

            <strong class="summary-number">
              {{ timesheetCount }}
            </strong>

            <span class="summary-description">
              waiting for approval
            </span>
          </div>
        </div>

      </section>


      <div class="approvals-layout">
        <main class="approvals-main">
      <!-- EMPTY STATE -->
      <section
        v-if="!totalCount"
        class="empty-card"
      >
        <div class="empty-icon">
          ✓
        </div>

        <h2>
          No pending approvals
        </h2>

        <p>
          You're all caught up. There are
          no requests waiting for your decision.
        </p>

        <button
          class="empty-refresh"
          @click="load"
        >
          Refresh approvals
        </button>
      </section>

      <!-- LEAVE REQUESTS -->
      <section
        v-if="leaveRequests.length"
        class="approval-section"
      >
        <div class="section-header">
          <div>
            <h2>
              Leave Requests
            </h2>

            <p>
              Leave applications submitted
              by your team.
            </p>
          </div>

          <span class="section-count">
            {{ leaveCount }}
          </span>
        </div>

        <div class="request-list">

          <article
            v-for="request in leaveRequests"
            :key="request.name"
            class="request-card"
          >

            <div class="request-main">

              <div class="employee-avatar">
                {{
                  request.employee_name
                    ?.charAt(0)
                    ?.toUpperCase() || '?'
                }}
              </div>

              <div class="request-info">

                <div class="request-title-row">
                  <h3>
                    {{ request.employee_name }}
                  </h3>

                  <span class="type-badge leave">
                    Leave
                  </span>
                </div>

                <p class="request-id">
                  {{ request.name }}
                </p>

                <div class="request-details">

                  <div class="detail-item">
                    <span class="detail-label">
                      Leave Type
                    </span>

                    <strong>
                      {{ request.leave_type }}
                    </strong>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label">
                      Duration
                    </span>

                    <strong>
                      {{ request.from_date }}
                      →
                      {{ request.to_date }}
                    </strong>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label">
                      Days
                    </span>

                    <strong>
                      {{ request.total_leave_days }}
                    </strong>
                  </div>

                </div>

              </div>

            </div>

            <div class="request-actions">

              <span class="pending-badge">
                Pending
              </span>

              <button
                class="reject-btn"
                :disabled="
                  acting ===
                  `${request.name}:Reject`
                "
                @click="
                  act(
                    request.name,
                    'Reject'
                  )
                "
              >
                {{
                  acting ===
                  `${request.name}:Reject`
                    ? 'Rejecting...'
                    : 'Reject'
                }}
              </button>

              <button
                class="approve-btn"
                :disabled="
                  acting ===
                  `${request.name}:Approve`
                "
                @click="
                  act(
                    request.name,
                    'Approve'
                  )
                "
              >
                {{
                  acting ===
                  `${request.name}:Approve`
                    ? 'Approving...'
                    : 'Approve'
                }}
              </button>

            </div>

          </article>

        </div>
      </section>

      <!-- LEAVE CANCELLATIONS -->
      <section
        v-if="canReviewCancellations && cancellationRequests.length"
        class="approval-section"
      >
        <div class="section-header">
          <div>
            <h2>Leave Cancellation Requests</h2>
            <p>Approved leave that employees want to cancel.</p>
          </div>

          <span class="section-count">
            {{ cancellationRequests.length }}
          </span>
        </div>

        <div class="request-list">
          <article
            v-for="request in cancellationRequests"
            :key="request.name"
            class="request-card"
          >
            <div class="request-main">
              <div class="request-info">
                <div class="request-title-row">
                  <h3>{{ request.employee }}</h3>
                  <span class="type-badge leave">
                    Leave Cancellation
                  </span>
                </div>

                <p class="request-id">
                  {{ request.leave_application }}
                </p>

                <div class="request-details">
                  <div class="detail-item">
                    <span class="detail-label">Reason</span>
                    <strong>{{ request.reason }}</strong>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label">Requested</span>
                    <strong>{{ request.creation }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="request-actions">
              <span class="pending-badge">Pending</span>

              <button
                class="reject-btn"
                :disabled="Boolean(acting)"
                @click="reviewCancellation(request, 'Reject')"
              >
                {{ acting === `${request.name}:Reject`
                  ? 'Rejecting...'
                  : 'Reject' }}
              </button>

              <button
                class="approve-btn"
                :disabled="Boolean(acting)"
                @click="reviewCancellation(request, 'Approve')"
              >
                {{ acting === `${request.name}:Approve`
                  ? 'Approving...'
                  : 'Approve' }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- TIMESHEETS -->
      <section
        v-if="timesheets.length"
        class="approval-section"
      >

        <div class="section-header">
          <div>
            <h2>
              Timesheets
            </h2>

            <p>
              Work-hour records submitted
              by your team.
            </p>
          </div>

          <span class="section-count">
            {{ timesheetCount }}
          </span>
        </div>

        <div class="request-list">

          <article
            v-for="timesheet in timesheets"
            :key="timesheet.name"
            class="request-card"
          >

            <div class="request-main">

              <div class="employee-avatar timesheet-avatar">
                {{
                  timesheet.employee_name
                    ?.charAt(0)
                    ?.toUpperCase() || '?'
                }}
              </div>

              <div class="request-info">

                <div class="request-title-row">
                  <h3>
                    {{ timesheet.employee_name }}
                  </h3>

                  <span class="type-badge timesheet">
                    Timesheet
                  </span>
                </div>

                <p class="request-id">
                  {{ timesheet.name }}
                </p>

                <div class="request-details">

                  <div class="detail-item">
                    <span class="detail-label">
                      Start Date
                    </span>

                    <strong>
                      {{ timesheet.start_date }}
                    </strong>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label">
                      End Date
                    </span>

                    <strong>
                      {{ timesheet.end_date }}
                    </strong>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label">
                      Total Hours
                    </span>

                    <strong>
                      {{
                        Number(
                          timesheet.total_hours || 0
                        ).toFixed(2)
                      }}
                      hrs
                    </strong>
                  </div>

                </div>

              </div>

            </div>

            <div class="request-actions">

              <span class="pending-badge">
                Pending
              </span>

              <button
                class="reject-btn"
                :disabled="
                  acting ===
                  `${timesheet.name}:Reject`
                "
                @click="
                  act(
                    timesheet.name,
                    'Reject'
                  )
                "
              >
                {{
                  acting ===
                  `${timesheet.name}:Reject`
                    ? 'Rejecting...'
                    : 'Reject'
                }}
              </button>

              <button
                class="approve-btn"
                :disabled="
                  acting ===
                  `${timesheet.name}:Approve`
                "
                @click="
                  act(
                    timesheet.name,
                    'Approve'
                  )
                "
              >
                {{
                  acting ===
                  `${timesheet.name}:Approve`
                    ? 'Approving...'
                    : 'Approve'
                }}
              </button>

            </div>

          </article>

        </div>

      </section>
        </main>

        <aside class="approvals-sidebar">
          <section class="overview-card">
            <div class="overview-heading">
              <span class="overview-eyebrow">YOUR WORKSPACE</span>
              <h2>Review overview</h2>
              <p>Your team's requests at a glance.</p>
            </div>

            <div class="overview-stat">
              <span>Awaiting your decision</span>
              <strong>{{ totalCount }}</strong>
            </div>

            <div class="overview-breakdown">
              <div>
                <span>Leave requests</span>
                <strong>{{ leaveCount }}</strong>
              </div>
              <div>
                <span>Timesheets</span>
                <strong>{{ timesheetCount }}</strong>
              </div>
            </div>

            <div
              v-if="totalCount"
              class="overview-notice"
            >
              <strong>Requests need attention</strong>
              <p>
                Review the pending requests in the
                main panel.
              </p>
            </div>

            <div
              v-else
              class="overview-success"
            >
              <span class="overview-check">✓</span>
              <strong>All caught up</strong>
              <p>
                You have no pending requests
                at the moment.
              </p>
            </div>
          </section>
        </aside>
      </div>

    </template>

  </div>
</template>

<style scoped>

.approvals-page {
  width: 100%;
}

/* =========================
   HEADER
========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.eyebrow {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  margin-bottom: 7px;
}

.page-header h1 {
  margin: 0 0 7px;
  font-size: 30px;
  line-height: 1.15;
  color: var(--text);
}

.page-header p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.refresh-btn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  padding: 10px 15px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.refresh-btn:hover {
  border-color: #c7c9dc;
  background: #fafaff;
}

.refresh-btn:disabled {
  opacity: .6;
  cursor: default;
}

/* =========================
   ERROR
========================= */

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 22px;
  border: 1px solid #fecaca;
  background: #fff7f7;
  color: #991b1b;
  border-radius: 10px;
}

.error-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fee2e2;
  font-weight: 800;
}

.error-box strong {
  display: block;
  font-size: 13px;
  margin-bottom: 3px;
}

.error-box p {
  margin: 0;
  font-size: 13px;
}

/* =========================
   LOADING
========================= */

.loading-state {
  min-height: 260px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  box-shadow: var(--shadow);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
  margin-bottom: 12px;
}

.loading-state p {
  margin: 0;
  font-size: 13px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================
   SUMMARY CARDS
========================= */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
  gap: 16px;
  margin-bottom: 28px;
}

.summary-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 13px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: var(--shadow);
}

.summary-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 20px;
}

.summary-icon.purple {
  background: #eeedfb;
}

.summary-icon.blue {
  background: #eaf2ff;
}

.summary-icon.green {
  background: #eaf8ef;
}

.summary-content {
  min-width: 0;
}

.summary-label {
  display: block;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 4px;
}

.summary-number {
  display: block;
  font-size: 30px;
  line-height: 1;
  color: var(--text);
  margin-bottom: 5px;
}

.summary-description {
  display: block;
  color: var(--faint);
  font-size: 11px;
}

/* =========================
   EMPTY STATE
========================= */

.empty-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  min-height: 330px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 40px;
}

.empty-icon {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #dcfce7;
  color: #15803d;
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 18px;
}

.empty-card h2 {
  margin: 0 0 8px;
  font-size: 19px;
}

.empty-card p {
  max-width: 390px;
  margin: 0 0 20px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.empty-refresh {
  border: 0;
  background: var(--accent);
  color: white;
  padding: 9px 15px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.empty-refresh:hover {
  background: var(--accent-dark);
}

/* =========================
   SECTIONS
========================= */

.approval-section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 13px;
}

.section-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.section-header p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.section-count {
  min-width: 28px;
  height: 28px;
  padding: 0 9px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-dark);
  font-size: 12px;
  font-weight: 700;
}

/* =========================
   REQUEST CARDS
========================= */

.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 13px;
  padding: 18px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.request-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.employee-avatar {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: #eeedfb;
  color: var(--accent-dark);
  font-size: 15px;
  font-weight: 700;
}

.timesheet-avatar {
  background: #eaf8ef;
  color: #15803d;
}

.request-info {
  min-width: 0;
}

.request-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 2px;
}

.request-title-row h3 {
  margin: 0;
  font-size: 14px;
}

.request-id {
  margin: 0 0 13px;
  color: var(--faint);
  font-size: 11px;
}

.type-badge {
  padding: 3px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
}

.type-badge.leave {
  background: #eef2ff;
  color: #4338ca;
}

.type-badge.timesheet {
  background: #ecfdf5;
  color: #15803d;
}

.request-details {
  display: flex;
  flex-wrap: wrap;
  gap: 25px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-label {
  color: var(--faint);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.detail-item strong {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.request-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pending-badge {
  padding: 5px 9px;
  border-radius: 99px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 10px;
  font-weight: 700;
  margin-right: 4px;
}

.reject-btn,
.approve-btn {
  border: 0;
  padding: 9px 13px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.reject-btn {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

.reject-btn:hover {
  background: #ffe4e6;
}

.approve-btn {
  background: var(--accent);
  color: white;
}

.approve-btn:hover {
  background: var(--accent-dark);
}

.reject-btn:disabled,
.approve-btn:disabled {
  opacity: .55;
  cursor: default;
}

/* =========================
   RESPONSIVE
========================= */

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .request-card {
    flex-direction: column;
    align-items: stretch;
  }

  .request-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
  }

  .refresh-btn {
    width: 100%;
  }

  .request-main {
    flex-direction: column;
  }

  .request-details {
    gap: 14px;
  }

  .request-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .pending-badge {
    width: 100%;
  }

  .empty-card {
    min-height: 280px;
    padding: 25px;
  }
}

/* FULL-WIDTH APPROVAL DASHBOARD */

.approvals-page {
  width: 100%;
  max-width: none;
  min-width: 0;
}

.approvals-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}

.approvals-main {
  min-width: 0;
}

.approvals-sidebar {
  min-width: 0;
}

.overview-card {
  position: sticky;
  top: 24px;
  padding: 24px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.overview-eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
}

.overview-heading h2 {
  margin: 8px 0;
  font-size: 19px;
  color: var(--text);
}

.overview-heading p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.overview-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 26px;
  padding: 20px;
  border-radius: 12px;
  background: var(--accent-soft);
}

.overview-stat span {
  max-width: 130px;
  color: var(--accent-dark);
  font-size: 13px;
  font-weight: 600;
}

.overview-stat strong {
  color: var(--accent-dark);
  font-size: 34px;
}

.overview-breakdown {
  margin: 20px 0;
}

.overview-breakdown > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.overview-breakdown span {
  color: var(--muted);
  font-size: 13px;
}

.overview-breakdown strong {
  color: var(--text);
  font-size: 17px;
}

.overview-notice,
.overview-success {
  padding: 18px;
  border-radius: 12px;
}

.overview-notice {
  background: #fff8e8;
  border: 1px solid #fde6ae;
  color: #92400e;
}

.overview-success {
  background: #ecfdf3;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.overview-notice strong,
.overview-success strong {
  display: block;
  font-size: 13px;
}

.overview-notice p,
.overview-success p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

.overview-check {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: #dcfce7;
  font-size: 20px;
  font-weight: 700;
}

/* Make the empty state fill its column. */

.approvals-main .empty-card {
  min-height: 420px;
  margin: 0;
}

/* Allow request details to use the wider space. */

.approvals-main .request-card {
  min-height: 125px;
  padding: 22px;
}

.approvals-main .request-details {
  gap: 32px;
}

@media (max-width: 1150px) {
  .approvals-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .overview-card {
    position: static;
  }

  .approvals-sidebar {
    grid-row: 1;
  }
}

@media (max-width: 600px) {
  .approvals-layout {
    gap: 16px;
  }

  .overview-card {
    padding: 18px;
  }

  .approvals-main .request-card {
    padding: 16px;
  }
}


/* Full-width approvals layout */
.approvals-page {
  width: 100% !important;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.approvals-layout {
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 320px;
}

@media (max-width: 1050px) {
  .approvals-layout {
    grid-template-columns: 1fr;
  }
}


/* APPROVALS LAYOUT REFINEMENT */

/* Restore comfortable spacing around the entire page. */
.approvals-page {
  box-sizing: border-box;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 28px 32px 48px !important;
}

/* Main approval content and review overview. */
.approvals-layout {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 24px;
}

.approvals-main,
.approvals-sidebar {
  min-width: 0;
}

/* Give the empty state a balanced height. */
.approvals-main .empty-card {
  box-sizing: border-box;
  width: 100%;
  min-height: 300px !important;
  padding: 40px 24px !important;
  margin: 0 !important;
}

/* Keep the overview aligned with the main card. */
.approvals-sidebar .overview-card {
  box-sizing: border-box;
  width: 100%;
  padding: 24px;
}

/* Allow request cards to use the available width. */
.approvals-main .request-card {
  width: 100%;
  box-sizing: border-box;
}

/* Tablet layout. */
@media (max-width: 1100px) {
  .approvals-page {
    padding: 24px !important;
  }

  .approvals-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }

  .approvals-sidebar {
    grid-row: 2;
  }

  .approvals-sidebar .overview-card {
    position: static;
  }
}

/* Mobile layout. */
@media (max-width: 600px) {
  .approvals-page {
    padding: 16px !important;
  }

  .approvals-layout {
    gap: 16px;
  }

  .approvals-main .empty-card {
    min-height: 260px !important;
    padding: 32px 16px !important;
  }

  .approvals-sidebar .overview-card {
    padding: 18px;
  }
}

/* STRETCHED APPROVAL CARD */

/* Stretch the approval card to match the overview panel */
@media (min-width: 1101px) {
  .approvals-layout {
    align-items: stretch !important;
  }

  .approvals-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .approvals-main .empty-card {
    flex: 1;
    min-height: 450px !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
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