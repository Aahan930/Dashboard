
<script setup>
import { ref, onMounted } from 'vue'
import api, { errMsg } from '../../api'

const requests = ref([])
const remarks = ref({})
const loading = ref(true)
const acting = ref('')
const error = ref('')
const success = ref('')

async function loadRequests() {
  loading.value = true
  error.value = ''

  try {
    const { data } = await api.get(
      '/api/method/hr_portal_custom.api.attendance_correction.pending_requests'
    )
    requests.value = data.message || []
  } catch (e) {
    error.value = errMsg(e, 'Could not load correction requests')
  } finally {
    loading.value = false
  }
}

async function review(request, action) {
  const key = `${request.name}:${action}`
  acting.value = key
  error.value = ''
  success.value = ''

  try {
    await api.post(
      '/api/method/hr_portal_custom.api.attendance_correction.review_request',
      {
        request_id: request.name,
        action,
        hr_remarks: remarks.value[request.name] || ''
      }
    )

    success.value =
      `Request ${action === 'Approve' ? 'approved' : 'rejected'} successfully.`

    await loadRequests()
  } catch (e) {
    error.value = errMsg(e, `Could not ${action.toLowerCase()} request`)
  } finally {
    acting.value = ''
  }
}

onMounted(loadRequests)
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <h1>HR Correction Requests</h1>
        <p>Review employee attendance correction requests.</p>
      </div>
      <button class="refresh" :disabled="loading" @click="loadRequests">
        Refresh
      </button>
    </header>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="success" class="alert success">{{ success }}</p>

    <div v-if="loading" class="empty">Loading requests...</div>
    <div v-else-if="!requests.length" class="empty">
      No pending attendance correction requests.
    </div>

    <div v-else class="request-list">
      <article v-for="request in requests" :key="request.name" class="card">
        <div class="card-header">
          <div>
            <h2>{{ request.employee }}</h2>
            <small>{{ request.name }}</small>
          </div>
          <span class="pending">Pending HR Review</span>
        </div>

        <div class="details">
          <div>
            <span>Attendance Date</span>
            <strong>{{ request.attendance_date }}</strong>
          </div>
          <div>
            <span>Request</span>
            <strong>
              {{ request.request_type === 'Correct'
                ? `Correct to ${request.requested_status}`
                : 'Cancel absence' }}
            </strong>
          </div>
        </div>

        <div class="reason">
          <strong>Employee's Reason</strong>
          <p>{{ request.reason }}</p>
        </div>

        <label>
          HR Remarks
          <textarea
            v-model="remarks[request.name]"
            rows="3"
            placeholder="Enter your remarks"
          />
        </label>

        <div class="actions">
          <button
            class="reject"
            :disabled="!!acting"
            @click="review(request, 'Reject')"
          >
            {{ acting === `${request.name}:Reject` ? 'Rejecting...' : 'Reject' }}
          </button>
          <button
            class="approve"
            :disabled="!!acting"
            @click="review(request, 'Approve')"
          >
            {{ acting === `${request.name}:Approve` ? 'Approving...' : 'Approve' }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; }
.header, .card-header, .actions {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.header { margin-bottom: 24px; }
h1 { margin: 0 0 6px; font-size: 28px; }
.header p, small { color: #667085; }
.refresh { padding: 10px 16px; background: white; border: 1px solid #e1e4ec; border-radius: 9px; cursor: pointer; }
.request-list { display: grid; gap: 16px; }
.card { background: white; border: 1px solid #eef0f6; border-radius: 16px; padding: 22px; }
.card h2 { margin: 0 0 4px; font-size: 17px; }
.pending { background: #fff7ed; color: #c2410c; padding: 7px 11px; border-radius: 20px; font-size: 12px; }
.details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 22px 0; }
.details div, label { display: flex; flex-direction: column; gap: 7px; }
.details span, label { color: #667085; font-size: 13px; }
.details strong { color: #111827; font-size: 14px; }
.reason { padding: 16px; background: #f8f9fc; border-radius: 10px; margin-bottom: 20px; }
.reason p { margin: 8px 0 0; font-size: 14px; }
textarea { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #e1e4ec; border-radius: 9px; font: inherit; }
.actions { justify-content: flex-end; margin-top: 20px; }
.actions button { padding: 11px 20px; border: 0; border-radius: 9px; font-weight: 600; cursor: pointer; }
.reject { background: #fff1f2; color: #be123c; }
.approve { background: #5b21f3; color: white; }
button:disabled { opacity: .5; cursor: not-allowed; }
.empty { text-align: center; padding: 50px 20px; background: white; border-radius: 14px; color: #667085; }
.alert { padding: 13px; border-radius: 9px; margin-bottom: 16px; }
.error { background: #fff1f2; color: #be123c; }
.success { background: #ecfdf5; color: #047857; }
@media (max-width: 650px) {
  .header, .card-header { align-items: flex-start; flex-direction: column; }
  .details { grid-template-columns: 1fr; }
}

/* HIDE MANUAL REFRESH CONTROLS */
.refresh-btn { display: none !important; }
.empty-refresh { display: none !important; }
.today-refresh { display: none !important; }
.refresh-button { display: none !important; }
.refresh { display: none !important; }
.deadline-refresh-button { display: none !important; }
</style>