<script setup>
import { ref, computed, onMounted } from 'vue'
import api, { errMsg } from '../api'

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
})

const selectedAttendance = ref('')
const requestType = ref('Correct')
const reason = ref('')
const requests = ref([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const historyError = ref('')
const success = ref('')
const historyFilter = ref('All')

const absentRecords = computed(() =>
  props.records.filter(record => record.status === 'Absent')
)

const selectedRecord = computed(() =>
  absentRecords.value.find(
    record => record.name === selectedAttendance.value
  )
)

const counts = computed(() => ({
  total: requests.value.length,
  pending: requests.value.filter(
    request => request.workflow_state === 'Pending'
  ).length,
  approved: requests.value.filter(
    request => request.workflow_state === 'Approved'
  ).length,
  rejected: requests.value.filter(
    request => request.workflow_state === 'Rejected'
  ).length
}))

const filteredRequests = computed(() =>
  historyFilter.value === 'All'
    ? requests.value
    : requests.value.filter(
        request => request.workflow_state === historyFilter.value
      )
)

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function statusClass(value) {
  if (value === 'Approved') return 'approved'
  if (value === 'Rejected') return 'rejected'
  if (value === 'Pending') return 'pending'
  return 'neutral'
}

async function loadRequests() {
  loading.value = true
  historyError.value = ''

  try {
    const { data } = await api.get(
      '/api/method/hr_portal_custom.api.attendance_correction.my_requests'
    )
    requests.value = data.message || []
  } catch (e) {
    historyError.value = errMsg(
      e,
      'Could not load correction requests'
    )
  } finally {
    loading.value = false
  }
}

async function submitRequest() {
  if (submitting.value) return

  error.value = ''
  success.value = ''

  if (!selectedAttendance.value || !reason.value.trim()) {
    error.value = 'Select an absent date and provide a reason.'
    return
  }

  submitting.value = true

  try {
    await api.post(
      '/api/method/hr_portal_custom.api.attendance_correction.create_request',
      {
        attendance: selectedAttendance.value,
        request_type: requestType.value,
        requested_status:
          requestType.value === 'Correct' ? 'Present' : null,
        reason: reason.value.trim()
      }
    )

    selectedAttendance.value = ''
    requestType.value = 'Correct'
    reason.value = ''
    success.value = 'Your request has been submitted for HR review.'

    await loadRequests()
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not submit correction request'
    )
  } finally {
    submitting.value = false
  }
}

onMounted(loadRequests)
</script>

<template>
  <div class="correction-workspace">
    <section class="overview-grid">
      <div class="overview-card">
        <div class="overview-top">
          <span>Eligible absent records</span>
          <span class="overview-icon blue">▤</span>
        </div>
        <strong>{{ absentRecords.length }}</strong>
        <small>Up to 100 recent submitted records</small>
      </div>

      <div class="overview-card">
        <div class="overview-top">
          <span>Total requests</span>
          <span class="overview-icon purple">▣</span>
        </div>
        <strong>{{ counts.total }}</strong>
        <small>Correction requests submitted</small>
      </div>

      <div class="overview-card">
        <div class="overview-top">
          <span>Pending review</span>
          <span class="overview-icon amber">◷</span>
        </div>
        <strong>{{ counts.pending }}</strong>
        <small>Awaiting HR decision</small>
      </div>

      <div class="overview-card">
        <div class="overview-top">
          <span>Approved</span>
          <span class="overview-icon green">✓</span>
        </div>
        <strong>{{ counts.approved }}</strong>
        <small>Requests approved by HR</small>
      </div>
    </section>

    <div class="workspace-grid">
      <section class="form-card">
        <div class="card-heading">
          <span class="section-eyebrow">NEW REQUEST</span>
          <h2>Request a correction</h2>
          <p>
            Select an eligible absence and explain the required change.
          </p>
        </div>

        <div class="process-note">
          <span class="process-icon">i</span>
          <p>
            Absences are recorded automatically after the configured
            missing-timesheet grace period. HR reviews correction
            requests after submission.
          </p>
        </div>

        <div
          v-if="!absentRecords.length"
          class="empty-eligible"
        >
          <div class="empty-symbol">✓</div>
          <h3>No eligible absence records</h3>
          <p>
            There are no submitted Absent records in your
            latest 100 records to select for correction.
          </p>
        </div>

        <form
          v-else
          class="correction-form"
          @submit.prevent="submitRequest"
        >
          <label class="form-field">
            <span>Absent date <em>*</em></span>

            <select
              v-model="selectedAttendance"
              required
              :disabled="submitting"
            >
              <option value="" disabled>
                Select an absent date
              </option>

              <option
                v-for="record in absentRecords"
                :key="record.name"
                :value="record.name"
              >
                {{ formatDate(record.attendance_date) }}
              </option>
            </select>
          </label>

          <div
            v-if="selectedRecord"
            class="selected-record"
          >
            <span>Selected attendance record</span>
            <strong>
              {{ formatDate(selectedRecord.attendance_date) }}
            </strong>
            <small>Current status: Absent</small>
          </div>

          <label class="form-field">
            <span>Request type <em>*</em></span>

            <select
              v-model="requestType"
              :disabled="submitting"
            >
              <option value="Correct">
                Correct to Present
              </option>
              <option value="Cancel">
                Cancel absence
              </option>
            </select>
          </label>

          <label class="form-field">
            <span>Reason <em>*</em></span>

            <textarea
              v-model="reason"
              rows="5"
              maxlength="1000"
              :disabled="submitting"
              placeholder="Explain why this attendance record should be corrected..."
              required
            ></textarea>

            <small class="field-hint">
              Provide enough detail for HR to review your request.
              {{ reason.length }}/1000
            </small>
          </label>

          <div
            v-if="error"
            class="feedback error"
            role="alert"
          >
            {{ error }}
          </div>

          <div
            v-if="success"
            class="feedback success"
            role="status"
          >
            {{ success }}
          </div>

          <div class="form-footer">
            <span>All requests require HR review.</span>

            <button
              type="submit"
              class="submit-button"
              :disabled="
                submitting ||
                !selectedAttendance ||
                !reason.trim()
              "
            >
              {{
                submitting
                  ? 'Submitting...'
                  : 'Submit request'
              }}
            </button>
          </div>
        </form>

        <div
          v-if="!absentRecords.length && success"
          class="feedback success"
          role="status"
        >
          {{ success }}
        </div>
      </section>

      <aside class="guidance-card">
        <div class="card-heading">
          <span class="section-eyebrow">HOW IT WORKS</span>
          <h2>Correction process</h2>
          <p>What happens after you submit a request.</p>
        </div>

        <div class="process-steps">
          <div class="process-step">
            <span class="step-number">1</span>
            <div>
              <strong>Select an absent record</strong>
              <p>Choose a submitted absence from your attendance history.</p>
            </div>
          </div>

          <div class="process-step">
            <span class="step-number">2</span>
            <div>
              <strong>Submit your explanation</strong>
              <p>Specify the requested change and provide a reason.</p>
            </div>
          </div>

          <div class="process-step">
            <span class="step-number">3</span>
            <div>
              <strong>HR reviews the request</strong>
              <p>Track the decision in your correction history below.</p>
            </div>
          </div>
        </div>

        <router-link to="/attendance" class="attendance-link">
          View attendance records →
        </router-link>
      </aside>
    </div>

    <section class="history-card">
      <div class="history-heading">
        <div>
          <h2>Correction history</h2>
          <p>Track requests submitted for HR review.</p>
        </div>

        <span class="history-count">
          {{ filteredRequests.length }} requests
        </span>
      </div>

      <div class="history-filters" aria-label="Filter correction requests">
        <button
          v-for="filter in ['All', 'Pending', 'Approved', 'Rejected']"
          :key="filter"
          type="button"
          :class="{ active: historyFilter === filter }"
          :aria-pressed="historyFilter === filter"
          @click="historyFilter = filter"
        >
          {{ filter }}
        </button>
      </div>

      <div
        v-if="historyError"
        class="feedback error"
        role="alert"
      >
        {{ historyError }}
        <button
          type="button"
          class="retry-button"
          @click="loadRequests"
        >
          Retry
        </button>
      </div>

      <div
        v-if="loading"
        class="history-empty"
        role="status"
      >
        Loading correction requests...
      </div>

      <div
        v-else-if="!filteredRequests.length"
        class="history-empty"
      >
        <div class="empty-symbol">▤</div>
        <h3>No requests found</h3>
        <p>
          {{
            historyFilter === 'All'
              ? 'Your correction requests will appear here after submission.'
              : `You have no ${historyFilter.toLowerCase()} correction requests.`
          }}
        </p>
      </div>

      <div v-else class="history-scroll">
        <table class="history-table">
          <thead>
            <tr>
              <th>Attendance date</th>
              <th>Request type</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="request in filteredRequests"
              :key="request.name"
            >
              <td>
                <strong>
                  {{ formatDate(request.attendance_date) }}
                </strong>
                <small>{{ request.name }}</small>
              </td>

              <td>
                {{
                  request.request_type === 'Correct'
                    ? 'Correct to Present'
                    : 'Cancel absence'
                }}
              </td>

              <td>
                <span
                  class="reason-text"
                  :title="request.reason"
                >
                  {{ request.reason || '—' }}
                </span>
              </td>

              <td>
                <span
                  :class="[
                    'status-badge',
                    statusClass(request.workflow_state)
                  ]"
                >
                  <span class="status-dot"></span>
                  {{ request.workflow_state || 'Unknown' }}
                </span>
              </td>

            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.correction-workspace {
  display: grid;
  gap: 24px;
}

/* =========================
   Overview
   ========================= */

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.overview-card,
.form-card,
.guidance-card,
.history-card {
  min-width: 0;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.overview-card {
  padding: 19px 20px;
  transition:
    border-color .18s ease,
    box-shadow .18s ease,
    transform .18s ease;
}

.overview-card:hover {
  border-color: #d8deea;
  box-shadow: 0 6px 18px rgba(25, 39, 67, .055);
  transform: translateY(-1px);
}

.overview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #65748c;
  font-size: 12px;
  font-weight: 650;
}

.overview-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  font-size: 17px;
  font-weight: 700;
}

.blue {
  background: #e7efff;
  color: #366ee8;
}

.purple {
  background: #eeeaff;
  color: #5546df;
}

.amber {
  background: #fff4e5;
  color: #b7791f;
}

.green {
  background: #e6f8ef;
  color: #139c67;
}

.overview-card > strong {
  display: block;
  margin: 10px 0 5px;
  color: #202d46;
  font-size: 27px;
  font-weight: 750;
  line-height: 1;
}

.overview-card > small {
  color: #8b98ae;
  font-size: 11px;
}

/* =========================
   Main workspace
   ========================= */

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, .8fr);
  align-items: start;
  gap: 20px;
}

.form-card,
.guidance-card {
  padding: 26px;
}

.form-card {
  border-color: #dfe5ef;
}

.guidance-card {
  position: sticky;
  top: 20px;
}

.card-heading {
  margin-bottom: 23px;
}

.section-eyebrow {
  display: block;
  margin-bottom: 9px;
  color: #6366f1;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.card-heading h2,
.history-heading h2 {
  margin: 0;
  color: #26334b;
  font-size: 18px;
  font-weight: 750;
}

.card-heading p,
.history-heading p {
  margin: 7px 0 0;
  color: #8b97a9;
  font-size: 12px;
  line-height: 1.6;
}

/* =========================
   Information note
   ========================= */

.process-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 23px;
  padding: 14px;
  border: 1px solid #dce5ff;
  border-radius: 10px;
  background: #f7f9ff;
}

.process-icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #e4e9ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 800;
}

.process-note p {
  margin: 0;
  color: #52627e;
  font-size: 12px;
  line-height: 1.65;
}

/* =========================
   Correction form
   ========================= */

.correction-form,
.form-field {
  display: grid;
  gap: 10px;
}

.correction-form {
  gap: 21px;
}

.form-field > span {
  color: #344054;
  font-size: 12px;
  font-weight: 700;
}

.form-field em {
  color: #e04458;
  font-style: normal;
}

.form-field select,
.form-field textarea {
  width: 100%;
  padding: 12px 13px;
  border: 1px solid #dce3ed;
  border-radius: 9px;
  outline: none;
  background: #fff;
  color: #26334b;
  font: inherit;
  font-size: 13px;
  transition:
    border-color .16s ease,
    box-shadow .16s ease,
    background .16s ease;
}

.form-field select:hover:not(:disabled),
.form-field textarea:hover:not(:disabled) {
  border-color: #c9d2e0;
}

.form-field select:focus,
.form-field textarea:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px #eef2ff;
}

.form-field select:disabled,
.form-field textarea:disabled {
  background: #f8fafc;
  cursor: not-allowed;
}

.form-field textarea {
  min-height: 125px;
  resize: vertical;
  line-height: 1.6;
}

.field-hint {
  color: #98a3b5;
  font-size: 11px;
  line-height: 1.5;
}

/* =========================
   Selected attendance
   ========================= */

.selected-record {
  display: grid;
  gap: 5px;
  padding: 14px 15px;
  border: 1px solid #d7e2ff;
  border-radius: 9px;
  background: linear-gradient(180deg, #f8faff 0%, #f5f7ff 100%);
}

.selected-record span,
.selected-record small {
  color: #718096;
  font-size: 11px;
}

.selected-record strong {
  color: #26334b;
  font-size: 13px;
}

/* =========================
   Form footer
   ========================= */

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
  padding-top: 20px;
  border-top: 1px solid #edf1f7;
}

.form-footer > span {
  color: #8b97a9;
  font-size: 11px;
}

.submit-button {
  min-width: 132px;
  padding: 12px 19px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background .16s ease,
    transform .16s ease,
    box-shadow .16s ease;
}

.submit-button:hover:not(:disabled) {
  background: #4338ca;
  box-shadow: 0 5px 14px rgba(79, 70, 229, .18);
  transform: translateY(-1px);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* =========================
   Feedback
   ========================= */

.feedback {
  padding: 13px 15px;
  border-radius: 9px;
  font-size: 12px;
  line-height: 1.6;
}

.error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

/* =========================
   Empty state
   ========================= */

.empty-eligible,
.history-empty {
  display: grid;
  justify-items: center;
  padding: 34px 20px;
  text-align: center;
}

.empty-symbol {
  display: grid;
  width: 38px;
  height: 38px;
  margin-bottom: 12px;
  place-items: center;
  border-radius: 50%;
  background: #eef2f7;
  color: #64748b;
  font-size: 15px;
  font-weight: 700;
}

.empty-eligible h3,
.history-empty h3 {
  margin: 0;
  color: #344054;
  font-size: 14px;
}

.empty-eligible p,
.history-empty p {
  max-width: 420px;
  margin: 7px 0 0;
  color: #8b97a9;
  font-size: 12px;
  line-height: 1.6;
}

/* =========================
   Guidance
   ========================= */

.process-steps {
  display: grid;
  gap: 0;
}

.process-step {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 12px;
  padding-bottom: 22px;
}

.process-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 30px;
  left: 14px;
  width: 1px;
  height: calc(100% - 20px);
  background: #e4e9f1;
}

.step-number {
  position: relative;
  z-index: 1;
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border: 1px solid #dbe2ef;
  border-radius: 50%;
  background: #fff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 750;
}

.process-step strong {
  display: block;
  margin-top: 3px;
  color: #344054;
  font-size: 12px;
  font-weight: 700;
}

.process-step p {
  margin: 6px 0 0;
  color: #8b97a9;
  font-size: 11px;
  line-height: 1.6;
}

.attendance-link {
  display: inline-flex;
  margin-top: 3px;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.attendance-link:hover {
  color: #4338ca;
  text-decoration: underline;
}

/* =========================
   History
   ========================= */

.history-card {
  overflow: hidden;
  padding: 24px 26px;
}

.history-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.history-count {
  flex-shrink: 0;
  padding: 6px 10px;
  border: 1px solid #e4e8ef;
  border-radius: 999px;
  background: #f8fafc;
  color: #66758d;
  font-size: 11px;
  font-weight: 700;
}

.history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 17px;
  padding-bottom: 15px;
  border-bottom: 1px solid #edf1f7;
}

.history-filters button {
  padding: 7px 11px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #7a879b;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.history-filters button:hover {
  background: #f6f8fb;
  color: #475569;
}

.history-filters button.active {
  border-color: #dce2ff;
  background: #eef2ff;
  color: #4f46e5;
}

.history-scroll {
  width: 100%;
  overflow-x: auto;
}

.history-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
}

.history-table th {
  padding: 0 14px 11px;
  border-bottom: 1px solid #e9edf3;
  color: #8995a8;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .4px;
  text-align: left;
  text-transform: uppercase;
}

.history-table td {
  padding: 15px 14px;
  border-bottom: 1px solid #f0f2f6;
  color: #526078;
  font-size: 12px;
  vertical-align: middle;
}

.history-table tbody tr:last-child td {
  border-bottom: 0;
}

.history-table tbody tr:hover {
  background: #fafbfc;
}

.history-table td strong {
  display: block;
  color: #344054;
  font-size: 12px;
}

.history-table td small {
  display: block;
  margin-top: 4px;
  color: #a0a9b8;
  font-size: 10px;
}

.reason-text {
  display: block;
  max-width: 360px;
  overflow: hidden;
  color: #66758d;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.approved {
  background: #eaf8f1;
  color: #138a5b;
}

.status-badge.rejected {
  background: #fef0f0;
  color: #c24141;
}

.status-badge.pending {
  background: #fff7e8;
  color: #a66b16;
}

.status-badge.neutral {
  background: #f1f3f6;
  color: #667085;
}

.retry-button {
  margin-left: 8px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.retry-button:hover {
  background: #eef2ff;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .guidance-card {
    position: static;
  }
}

@media (max-width: 700px) {
  .correction-workspace {
    gap: 16px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .form-card,
  .guidance-card,
  .history-card {
    padding: 19px;
  }

  .history-heading {
    flex-direction: column;
    gap: 10px;
  }

  .form-footer {
    align-items: stretch;
  }

  .form-footer > span {
    width: 100%;
  }

  .submit-button {
    width: 100%;
  }

  .process-note {
    padding: 12px;
  }
}
</style>
