<script setup>
import { ref, onMounted } from 'vue'
import api, { errMsg } from '../../api'
import HRCorrectionRequests from './HRCorrectionRequests.vue'

const activeTab = ref('attendance')
const cancellations = ref([])
const loading = ref(false)
const acting = ref('')
const error = ref('')
const success = ref('')

async function loadCancellations() {
  loading.value = true
  error.value = ''

  try {
    const { data } = await api.get(
      '/api/method/hr_portal_custom.api.leave_cancellation_request.pending_cancellation_requests'
    )

    cancellations.value = data.message || []
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load leave cancellation requests'
    )
  } finally {
    loading.value = false
  }
}

async function reviewCancellation(request, action) {
  if (acting.value) return

  const confirmed = window.confirm(
    `${action} cancellation request for leave ${request.leave_application}?`
  )

  if (!confirmed) return

  acting.value = `${request.name}:${action}`
  error.value = ''
  success.value = ''

  try {
    await api.post(
      '/api/method/hr_portal_custom.api.leave_cancellation_request.review_cancellation',
      {
        request_name: request.name,
        action
      }
    )

    success.value = `Cancellation request ${action === 'Approve'
      ? 'approved'
      : 'rejected'}.`

    await loadCancellations()
  } catch (e) {
    error.value = errMsg(
      e,
      `Could not ${action.toLowerCase()} cancellation request`
    )
  } finally {
    acting.value = ''
  }
}

onMounted(loadCancellations)
</script>

<template>
  <main class="requests-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">HR WORKSPACE</p>
        <h1>Requests</h1>
        <p>Review attendance corrections and leave cancellations.</p>
      </div>
    </header>

    <nav class="tabs" aria-label="Request types">
      <button
        type="button"
        :class="{ active: activeTab === 'attendance' }"
        @click="activeTab = 'attendance'"
      >
        Attendance Correction
      </button>

      <button
        type="button"
        :class="{ active: activeTab === 'leave' }"
        @click="activeTab = 'leave'"
      >
        Leave Cancellation
        <span class="count">{{ cancellations.length }}</span>
      </button>
    </nav>

    <section v-show="activeTab === 'attendance'">
      <HRCorrectionRequests />
    </section>

    <section v-show="activeTab === 'leave'">
      <p v-if="error" class="alert error" role="alert">
        {{ error }}
      </p>

      <p v-if="success" class="alert success" role="status">
        {{ success }}
      </p>

      <div v-if="loading" class="empty">
        Loading cancellation requests...
      </div>

      <div v-else-if="!cancellations.length" class="empty">
        No pending leave cancellation requests.
      </div>

      <div v-else class="request-list">
        <article
          v-for="request in cancellations"
          :key="request.name"
          class="request-card"
        >
          <div class="card-header">
            <div>
              <h2>{{ request.employee }}</h2>
              <p class="request-id">{{ request.leave_application }}</p>
            </div>

            <span class="pending">Pending HR Review</span>
          </div>

          <div class="details">
            <div>
              <span>Leave Application</span>
              <strong>{{ request.leave_application }}</strong>
            </div>

            <div>
              <span>Submitted</span>
              <strong>
                {{ new Date(request.creation).toLocaleDateString(
                  'en-IN',
                  { day: 'numeric', month: 'short', year: 'numeric' }
                ) }}
              </strong>
            </div>
          </div>

          <div class="reason">
            <strong>Employee's reason</strong>
            <p>{{ request.reason }}</p>
          </div>

          <div class="request-footer">
            <span>Reference: {{ request.name }}</span>
          </div>

          <div class="actions">
            <button
              type="button"
              class="reject"
              :disabled="!!acting"
              @click="reviewCancellation(request, 'Reject')"
            >
              {{ acting === `${request.name}:Reject`
                ? 'Rejecting...'
                : 'Reject' }}
            </button>

            <button
              type="button"
              class="approve"
              :disabled="!!acting"
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
  </main>
</template>

<style scoped>
.requests-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
  color: #6366f1;
}

h1 {
  margin: 0 0 8px;
  font-size: 30px;
}

.page-header > div > p:last-child,
.request-id {
  color: #667085;
  font-size: 13px;
}

.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 26px;
}

.tabs button {
  padding: 13px 18px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font-weight: 600;
}

.tabs button.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.count {
  margin-left: 7px;
  padding: 3px 8px;
  border-radius: 20px;
  background: #eef2ff;
  color: #4338ca;
}

.request-list {
  display: grid;
  gap: 16px;
}

.request-card {
  padding: 22px;
  border: 1px solid #eef0f6;
  border-radius: 16px;
  background: white;
}

.card-header,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-header h2 {
  margin: 0 0 5px;
  font-size: 18px;
}

.pending {
  padding: 7px 11px;
  border-radius: 20px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
}

.details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 22px 0;
}

.details div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.details span {
  color: #667085;
  font-size: 12px;
}

.details strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.reason {
  padding: 16px;
  border-radius: 10px;
  background: #f8f9fc;
}

.reason p {
  margin: 8px 0 0;
}

.actions {
  justify-content: flex-end;
  margin-top: 20px;
}

.actions button {
  padding: 10px 18px;
  border: 0;
  border-radius: 9px;
  font-weight: 600;
  cursor: pointer;
}

.reject {
  background: #fff1f2;
  color: #be123c;
}

.approve {
  background: #4f46e5;
  color: white;
}

button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.empty {
  padding: 48px 20px;
  border-radius: 14px;
  background: white;
  text-align: center;
  color: #667085;
}

.alert {
  padding: 13px;
  border-radius: 9px;
  margin-bottom: 16px;
}

.error {
  background: #fff1f2;
  color: #be123c;
}

.success {
  background: #ecfdf5;
  color: #047857;
}

@media (max-width: 650px) {
  .tabs {
    flex-wrap: wrap;
  }

  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .details {
    grid-template-columns: 1fr;
  }
}
</style>

<style scoped>
.request-footer {
  margin-top: 16px;
  color: #98a2b3;
  font-size: 11px;
}
</style>
