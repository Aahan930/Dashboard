
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false
  },
  selectedDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['marked'])
const router = useRouter()
const today = new Date().toLocaleDateString('en-CA')

const activeDate = computed(() =>
  props.selectedDate || today
)

const employee = ref(null)
const attendance = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const success = ref('')
const approvedCorrection = ref(null)

function handleError(e, fallback) {
  if (e.response?.status === 401) {
    localStorage.removeItem('user')
    router.push('/login')
    return
  }

  error.value = errMsg(e, fallback)
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    const user = localStorage.getItem('user')

    const empRes = await api.get('/api/resource/Employee', {
      params: {
        filters: JSON.stringify([
          ['user_id', '=', user],
          ['status', '=', 'Active']
        ]),
        fields: JSON.stringify([
          'name',
          'employee_name',
          'department'
        ]),
        limit_page_length: 1
      }
    })

    employee.value = empRes.data.data?.[0] || null

    if (!employee.value) {
      error.value = 'No active employee record is linked to your account.'
      return
    }

    const attendanceRes = await api.get('/api/resource/Attendance', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee.value.name],
          ['attendance_date', '=', activeDate.value],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify([
          'name',
          'status',
          'attendance_date'
        ]),
        limit_page_length: 1
      }
    })

    attendance.value = attendanceRes.data.data?.[0] || null
    approvedCorrection.value = null

    try {
      const correctionRes = await api.get(
        '/api/method/hr_portal_custom.api.attendance_correction.my_requests'
      )

      const requests = correctionRes.data.message || []

      approvedCorrection.value =
        requests.find(request =>
          String(request.attendance_date) === activeDate.value &&
          request.workflow_state === 'Approved' &&
          request.request_type === 'Correct' &&
          request.requested_status === 'Present' &&
          request.attendance_status === 'Absent' &&
          Number(request.attendance_docstatus) === 1
        ) || null
    } catch {
      approvedCorrection.value = null
    }
  } catch (e) {
    handleError(e, 'Could not load your attendance.')
  } finally {
    loading.value = false
  }
}

const canMarkSelectedDate = computed(() =>
  Boolean(
    employee.value &&
    !loading.value &&
    (
      (
        attendance.value?.status === 'Absent' &&
        approvedCorrection.value
      ) ||
      (
        activeDate.value === today &&
        !attendance.value
      )
    )
  )
)

async function markPresent() {
  if (
    busy.value ||
    !employee.value ||
    !canMarkSelectedDate.value
  ) {
    return
  }

  busy.value = true
  error.value = ''
  success.value = ''

  try {
    let response

    if (approvedCorrection.value) {
      response = await api.post(
        '/api/method/hr_portal_custom.api.attendance_correction.mark_approved_correction',
        {
          request_id: approvedCorrection.value.name
        }
      )
    } else {
      response = await api.post(
        '/api/method/mark_self_attendance',
        {}
      )
    }

    const result = response.data.message

    if (!result?.success) {
      throw new Error('Attendance was not confirmed by the server.')
    }

    success.value =
      activeDate.value === today
        ? 'Your attendance has been marked successfully.'
        : `Attendance for ${activeDate.value} has been marked Present.`

    await load()
    emit('marked')
  } catch (e) {
    if (e.response) {
      handleError(e, 'Could not mark your attendance.')
    } else {
      error.value = e.message || 'Could not mark your attendance.'
    }

    // Check again in case the server saved attendance
    // but the response was interrupted.
    if (employee.value) {
      await loadAttendanceOnly()
    }
  } finally {
    busy.value = false
  }
}

async function loadAttendanceOnly() {
  try {
    const response = await api.get('/api/resource/Attendance', {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee.value.name],
          ['attendance_date', '=', activeDate.value],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify([
          'name',
          'status',
          'attendance_date'
        ]),
        limit_page_length: 1
      }
    })

    attendance.value = response.data.data?.[0] || null
  } catch {
    // Preserve the original submission error.
  }
}

watch(
  () => props.selectedDate,
  () => load()
)

onMounted(load)
</script>

<template>
  <div class="mark-page" :class="{ embedded }">
    <section v-if="embedded" class="today-strip">
      <div class="today-info">
        <span class="today-label">
          {{
            activeDate === today
              ? "TODAY'S ATTENDANCE"
              : 'SELECTED ATTENDANCE'
          }}
        </span>

        <h2>{{ activeDate }}</h2>
        <p v-if="loading">Checking attendance...</p>
        <p v-else-if="attendance">
          Status:
          <strong>{{ attendance.status }}</strong>
        </p>
        <p v-else-if="employee">
          {{
            activeDate === today
              ? "You haven't marked attendance today."
              : 'No attendance record is available for this date.'
          }}
        </p>
        <p v-if="error" class="today-error">{{ error }}</p>
        <p v-if="success" class="today-success">{{ success }}</p>
      </div>

      <div class="today-actions">
        <span
          v-if="attendance"
          class="today-status"
          :class="attendance.status.replaceAll(' ', '-').toLowerCase()"
        >
          {{ attendance.status }}
        </span>

        <button
          v-if="canMarkSelectedDate"
          class="present-button"
          :disabled="busy"
          @click="markPresent"
        >
          {{ busy ? 'Marking...' : '✓ Mark Present' }}
        </button>

        <button
          class="today-refresh"
          :disabled="loading || busy"
          @click="load"
        >
          ↻ Refresh
        </button>
      </div>
    </section>

    <template v-else>

    <header v-if="!props.embedded" class="page-header">
      <div>
        <span class="eyebrow">EMPLOYEE WORKSPACE</span>
        <h1>Mark Attendance</h1>
        <p>Record your attendance for today.</p>
      </div>

      <button
        class="refresh-button"
        :disabled="loading || busy"
        @click="load"
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

    <div v-if="loading" class="panel loading">
      Loading your attendance...
    </div>

    <div v-else-if="employee" class="panel">
      <div class="employee-header">
        <div class="avatar">
          {{ employee.employee_name?.charAt(0) || 'E' }}
        </div>

        <div>
          <h2>{{ employee.employee_name }}</h2>
          <p>{{ employee.department || 'Employee' }}</p>
          <span class="employee-id">{{ employee.name }}</span>
        </div>
      </div>

      <div class="attendance-details">
        <div>
          <span class="field-label">Date</span>
          <strong>{{ today }}</strong>
        </div>

        <div>
          <span class="field-label">Attendance status</span>

          <span
            v-if="attendance"
            class="status"
            :class="attendance.status.replaceAll(' ', '-').toLowerCase()"
          >
            {{ attendance.status }}
          </span>

          <span v-else class="status not-marked">
            Not marked
          </span>
        </div>
      </div>

      <div v-if="attendance" class="completed">
        <span class="check">✓</span>
        <div>
          <strong>Attendance already recorded</strong>
          <p>Your attendance for today is {{ attendance.status }}.</p>
        </div>
      </div>

      <div v-else class="mark-action">
        <p>Click below to mark yourself Present for today.</p>

        <button
          class="present-button"
          :disabled="busy"
          @click="markPresent"
        >
          {{ busy ? 'Marking attendance...' : '✓ Mark Present' }}
        </button>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>

.mark-page.embedded {
  max-width: none;
  margin: 0 0 18px;
}

.today-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  padding: 19px 22px;
  background: #fff;
  border: 1px solid #e5e7f0;
  border-radius: 14px;
}

.today-label {
  display: block;
  margin-bottom: 7px;
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.today-info h2 {
  margin: 0;
  color: #182238;
  font-size: 20px;
}

.today-info p {
  margin: 7px 0 0;
  color: #667085;
  font-size: 13px;
}

.today-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.today-status {
  padding: 8px 14px;
  border-radius: 20px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 13px;
  font-weight: 700;
}

.today-status.present {
  background: #dcfce7;
  color: #166534;
}

.today-status.absent {
  background: #fee2e2;
  color: #991b1b;
}

.today-status.on-leave {
  background: #e0e7ff;
  color: #3730a3;
}

.today-refresh {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: white;
  color: #475467;
  cursor: pointer;
}

.today-error {
  color: #dc2626 !important;
}

.today-success {
  color: #15803d !important;
}

.mark-page {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.page-header h1 {
  margin: 8px 0;
  font-size: 28px;
  color: #181a33;
}

.page-header p,
.employee-header p {
  color: #666a85;
  font-size: 14px;
}

.refresh-button {
  padding: 10px 16px;
  border: 1px solid #e5e6f0;
  border-radius: 9px;
  background: white;
  color: #4f46e5;
  cursor: pointer;
}

.panel {
  padding: 28px;
  border: 1px solid #e5e6f0;
  border-radius: 16px;
  background: white;
  box-shadow: 0 1px 3px rgba(20, 22, 59, .05);
}

.loading {
  color: #666a85;
  text-align: center;
}

.employee-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e6f0;
}

.avatar {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: #eeedfb;
  color: #4f46e5;
  font-size: 22px;
  font-weight: 700;
}

.employee-header h2 {
  margin: 0;
  font-size: 19px;
}

.employee-header p {
  margin: 5px 0;
}

.employee-id {
  font-size: 12px;
  color: #9ea2be;
}

.attendance-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 28px 0;
}

.attendance-details > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.field-label {
  color: #666a85;
  font-size: 13px;
}

.status {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.status.present {
  color: #166534;
  background: #dcfce7;
}

.status.half-day {
  color: #92400e;
  background: #fef3c7;
}

.status.absent {
  color: #991b1b;
  background: #fee2e2;
}

.status.on-leave {
  color: #3730a3;
  background: #e0e7ff;
}

.status.not-marked {
  color: #92400e;
  background: #fef3c7;
}

.mark-action {
  padding-top: 24px;
  border-top: 1px solid #e5e6f0;
}

.mark-action p {
  margin: 0 0 18px;
  color: #666a85;
  font-size: 14px;
}

.present-button {
  padding: 13px 24px;
  border: none;
  border-radius: 10px;
  background: #4f46e5;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.present-button:hover {
  background: #372fb0;
}

button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.completed {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 12px;
  background: #f0fdf4;
  color: #166534;
}

.check {
  font-size: 26px;
}

.completed p {
  margin: 5px 0 0;
  font-size: 13px;
}

.notice {
  padding: 13px 16px;
  margin-bottom: 18px;
  border-radius: 10px;
}

.notice.error {
  background: #fff1f2;
  color: #dc2626;
}

.notice.success {
  background: #f0fdf4;
  color: #166534;
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .attendance-details {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 20px;
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