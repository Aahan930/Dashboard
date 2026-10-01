<script setup>
import { ref, onMounted } from 'vue'
import api, { errMsg } from '../api'
import AttendanceCorrection from '../components/AttendanceCorrection.vue'

const records = ref([])
const loading = ref(true)
const error = ref('')

async function loadAbsentRecords() {
  loading.value = true
  error.value = ''

  try {
    const email = localStorage.getItem('user')

    const employeeRes = await api.get('/api/resource/Employee', {
      params: {
        filters: JSON.stringify([['user_id', '=', email]]),
        fields: JSON.stringify(['name'])
      }
    })

    const employee = employeeRes.data.data?.[0]?.name

    if (!employee) {
      throw new Error('No employee record linked to your account')
    }

    const res = await api.get('/api/resource/Attendance', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee],
          ['status', '=', 'Absent'],
          ['docstatus', '=', 1]
        ]),
        fields: JSON.stringify([
          'name',
          'attendance_date',
          'status'
        ]),
        order_by: 'attendance_date desc',
        limit_page_length: 100
      }
    })

    records.value = res.data.data || []
  } catch (e) {
    error.value = e.response
      ? errMsg(e, 'Could not load absent records')
      : e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadAbsentRecords)
</script>

<template>
  <main class="correction-page">
    <div class="attendance-context">
      <span class="context-dot"></span>
      <span>ATTENDANCE</span>
      <span class="context-separator">/</span>
      <strong>Correction</strong>
    </div>

    <header class="correction-page-header">
      <div>
        <span class="eyebrow">EMPLOYEE SELF SERVICE</span>
        <h1>Attendance correction</h1>
        <p>
          Submit correction requests and track their HR review status.
        </p>
      </div>

      <router-link
        to="/attendance"
        class="back-link"
      >
        <span aria-hidden="true">←</span>
        Back to attendance
      </router-link>
    </header>

    <div v-if="loading" class="page-state" role="status">
      <div class="spinner"></div>
      <strong>Loading attendance records</strong>
      <p>Retrieving your submitted absence records.</p>
    </div>

    <div v-else-if="error" class="page-error" role="alert">
      <strong>Unable to load attendance records</strong>
      <p>{{ error }}</p>
      <button type="button" @click="loadAbsentRecords">
        Try again
      </button>
    </div>

    <AttendanceCorrection
      v-else
      :records="records"
    />
  </main>
</template>

<style scoped>
.correction-page {
  width: 100%;
  min-width: 0;
  padding: 32px clamp(20px, 3vw, 48px) 56px;
  color: #202d46;
}

.attendance-context {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  color: #7b88a0;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.attendance-context strong {
  color: #4f46e5;
  font-weight: 750;
}

.context-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4f46e5;
}

.context-separator {
  color: #c5ccda;
}

.correction-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.eyebrow {
  display: block;
  margin-bottom: 9px;
  color: #7b88a0;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.4px;
}

.correction-page-header h1 {
  margin: 0;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -1px;
}

.correction-page-header p {
  margin: 9px 0 0;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 11px 15px;
  border: 1px solid #d8ddf5;
  border-radius: 9px;
  background: #fff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.back-link:hover {
  background: #eef2ff;
}

.page-state,
.page-error {
  padding: 48px 24px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #fff;
  text-align: center;
}

.page-state strong,
.page-error strong {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
}

.page-state p,
.page-error p {
  color: #718096;
  font-size: 13px;
}

.page-error {
  border-color: #fecaca;
}

.page-error button {
  margin-top: 12px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: #4f46e5;
  color: white;
  cursor: pointer;
}

.spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 18px;
  border: 3px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 700px) {
  .correction-page {
    padding: 22px 16px 36px;
  }

  .correction-page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .correction-page-header h1 {
    font-size: 25px;
  }
}
</style>
