
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api, { errMsg, isManager } from '../api'

import TimesheetTabs from '../components/timesheets/TimesheetTabs.vue'
import TimesheetDeadline from '../components/timesheets/TimesheetDeadline.vue'
import TimesheetCreateForm from '../components/timesheets/TimesheetCreateForm.vue'
import TimesheetList from '../components/timesheets/TimesheetList.vue'
import TimesheetDetail from '../components/timesheets/TimesheetDetail.vue'

const employee = ref(null)
const deadlinePanel = ref(null)

const timesheets = ref([])
const teamTimesheets = ref([])
const teamMembers = ref([])

const loading = ref(true)
const teamLoading = ref(false)
const detailLoading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const approving = ref(false)
const rejecting = ref(false)

const error = ref('')

const showCreate = ref(false)
const selectedTimesheet = ref(null)
const editingTimesheet = ref(null)
const showEdit = ref(false)

const managerView = ref(false)
const activeView = ref('mine')

const newTimesheet = ref({
  start_date: new Date().toLocaleDateString('en-CA'),
  end_date: new Date().toLocaleDateString('en-CA'),
  activity_type: '',
  project: '',
  deliverables: '',
  description: '',
  hours: 0
})

const visibleTimesheets = computed(() =>
  activeView.value === 'mine'
    ? timesheets.value
    : teamTimesheets.value
)

const timesheetStats = computed(() => {
  const items = visibleTimesheets.value

  return {
    total: items.length,
    hours: items.reduce(
      (sum, item) => sum + Number(item.total_hours || 0),
      0
    ),
      draft: items.filter(
        item =>
          item.workflow_state === 'Draft' ||
          (!item.workflow_state && item.docstatus === 0)
      ).length,
    approved: items.filter(
      item => item.workflow_state === 'Approved' ||
        (item.docstatus === 1 && item.workflow_state !== 'Rejected')
    ).length
  }
})

const showOverview = computed(() =>
  !loading.value &&
  !teamLoading.value &&
  !showCreate.value &&
  !showEdit.value &&
  !selectedTimesheet.value
)

/* =========================
   Manager View
========================= */

function setupManagerView() {
  managerView.value = isManager()
}

/* =========================
   Reset When Switching Tabs
========================= */

watch(activeView, () => {
  selectedTimesheet.value = null
  editingTimesheet.value = null
  showEdit.value = false
  showCreate.value = false
  error.value = ''
})

/* =========================
   Load My Timesheets
========================= */

async function loadMyTimesheets() {
  if (!employee.value) return

  const res = await api.get(
    '/api/resource/Timesheet',
    {
      params: {
        filters: JSON.stringify([
          ['employee', '=', employee.value.name],
          ['docstatus', '!=', 2]
        ]),
        fields: JSON.stringify([
          'name',
          'employee',
          'employee_name',
          'company',
          'status',
          'workflow_state',
          'docstatus',
          'start_date',
          'end_date',
          'total_hours',
          'creation'
        ]),
        order_by: 'creation desc',
        limit_page_length: 100
      }
    }
  )

  timesheets.value = res.data.data
}

/* =========================
   Load Team Timesheets
========================= */

async function loadTeamTimesheets(email) {
  if (!managerView.value) return

  teamLoading.value = true

  try {
    const teamRes = await api.get(
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

    teamMembers.value = teamRes.data.data

    const employeeIds = teamMembers.value.map(
      member => member.name
    )

    if (!employeeIds.length) {
      teamTimesheets.value = []
      return
    }

    const timesheetRes = await api.get(
      '/api/resource/Timesheet',
      {
        params: {
          filters: JSON.stringify([
            ['employee', 'in', employeeIds],
            ['docstatus', '!=', 2]
          ]),
          fields: JSON.stringify([
            'name',
            'employee',
            'employee_name',
            'company',
            'status',
            'workflow_state',
            'docstatus',
            'start_date',
            'end_date',
            'total_hours',
            'creation'
          ]),
          order_by: 'creation desc',
          limit_page_length: 500
        }
      }
    )

    teamTimesheets.value = timesheetRes.data.data

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load team timesheets'
    )
  } finally {
    teamLoading.value = false
  }
}

/* =========================
   Create Timesheet
========================= */

async function createTimesheet(entries) {
  error.value = ''

  if (!entries || !entries.length) {
    error.value = 'Please add at least one work entry'
    return
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    if (!entry.activity_type) {
      error.value =
        `Please select Activity Type for Work Entry ${i + 1}`
      return
    }

    if (!entry.hours || entry.hours <= 0) {
      error.value =
        `Please enter valid hours for Work Entry ${i + 1}`
      return
    }

    if (!entry.hours || entry.hours <= 0) {
      error.value =
        `Please enter valid hours for Work Entry ${i + 1}`
      return
    }
  }

  saving.value = true

  try {
    const payload = {
      employee: employee.value.name,
      company: employee.value.company,
      start_date: newTimesheet.value.start_date,
      end_date: newTimesheet.value.end_date,
      time_logs: entries.map(entry => ({
        activity_type: entry.activity_type,
        project: entry.project || null,
        deliverables: entry.deliverables || null,
        description: entry.description || null,
        hours: Number(entry.hours)
      }))
    }

    await api.post(
      '/api/resource/Timesheet',
      payload
    )

    showCreate.value = false

    const resetDate = new Date().toLocaleDateString('en-CA')

    newTimesheet.value = {
      start_date: resetDate,
      end_date: resetDate,
      activity_type: '',
      project: '',
      deliverables: '',
      description: '',
      hours: 0
    }

    await loadMyTimesheets()
    await deadlinePanel.value?.refresh()

    if (managerView.value) {
      await loadTeamTimesheets(
        localStorage.getItem('user')
      )
    }

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not create timesheet'
    )
  } finally {
    saving.value = false
  }
}

/* =========================
   Open Timesheet Details
========================= */

async function openTimesheet(name) {
  error.value = ''
  detailLoading.value = true

  try {
    const res = await api.get(
      `/api/resource/Timesheet/${encodeURIComponent(name)}`
    )

    const timesheet = res.data.data

    if (activeView.value === 'mine') {
      if (timesheet.employee !== employee.value?.name) {
        error.value = 'This is not your timesheet'
        return
      }
    } else {
      const belongsToTeam = teamMembers.value.some(
        member => member.name === timesheet.employee
      )

      if (!managerView.value || !belongsToTeam) {
        error.value = 'This timesheet is not assigned to your team'
        return
      }
    }

    selectedTimesheet.value = timesheet

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load timesheet details'
    )
  } finally {
    detailLoading.value = false
  }
}

/* =========================
   Close Timesheet Details
========================= */

function closeTimesheet() {
  selectedTimesheet.value = null
  error.value = ''
}

/* =========================
   Submit Timesheet
========================= */

async function submitTimesheet(name) {
  error.value = ''

  if (
    activeView.value !== 'mine' ||
    selectedTimesheet.value?.employee !== employee.value?.name
  ) {
    error.value = 'You can only submit your own timesheet'
    return
  }

  if (submitting.value) return

  submitting.value = true

  try {
    const res = await api.get(
      `/api/resource/Timesheet/${encodeURIComponent(name)}`
    )

    const timesheet = res.data.data

    if (
      timesheet.employee !== employee.value.name ||
      timesheet.workflow_state !== 'Draft' ||
      timesheet.docstatus !== 0
    ) {
      error.value =
        'Only your own Draft timesheets can be submitted'
      return
    }

    const action = 'Submit'

    await api.post(
      '/api/method/frappe.model.workflow.apply_workflow',
      {
        doc: JSON.stringify(timesheet),
        action
      }
    )

    await loadMyTimesheets()
    await deadlinePanel.value?.refresh()

    if (managerView.value) {
      await loadTeamTimesheets(
        localStorage.getItem('user')
      )
    }

    await openTimesheet(name)

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not submit timesheet'
    )
  } finally {
    submitting.value = false
  }
}

/* =========================
   Manager Approval / Rejection
========================= */

async function reviewTimesheet(name, action) {
  error.value = ''

  if (
    !managerView.value ||
    activeView.value !== 'team'
  ) {
    error.value = 'Manager review is not available'
    return
  }

  if (approving.value || rejecting.value) return

  const busy = action === 'Approve'
    ? approving
    : rejecting

  busy.value = true

  try {
    const res = await api.get(
      `/api/resource/Timesheet/${encodeURIComponent(name)}`
    )

    const timesheet = res.data.data

    if (
      timesheet.workflow_state !== 'Pending' ||
      timesheet.docstatus !== 0
    ) {
      error.value = 'This timesheet is not pending approval'
      return
    }

    const belongsToTeam = teamMembers.value.some(
      member => member.name === timesheet.employee
    )

    if (!belongsToTeam) {
      error.value =
        'This employee is not assigned to your team'
      return
    }

    // Frappe also validates the workflow action and user role.
    await api.post(
      '/api/method/frappe.model.workflow.apply_workflow',
      {
        doc: JSON.stringify(timesheet),
        action
      }
    )

    await Promise.all([
      loadMyTimesheets(),
      loadTeamTimesheets(
        localStorage.getItem('user')
      )
    ])

    await openTimesheet(name)

  } catch (e) {
    error.value = errMsg(
      e,
      `Could not ${action.toLowerCase()} timesheet`
    )
  } finally {
    busy.value = false
  }
}

function approveTimesheet(name) {
  return reviewTimesheet(name, 'Approve')
}

function rejectTimesheet(name) {
  return reviewTimesheet(name, 'Reject')
}

/* =========================
   Edit Timesheet
========================= */

async function editTimesheet(name) {
  error.value = ''

  if (activeView.value !== 'mine') {
    error.value = 'You can only edit your own timesheet'
    return
  }

  detailLoading.value = true

  try {
    const res = await api.get(
      `/api/resource/Timesheet/${encodeURIComponent(name)}`
    )

    const timesheet = res.data.data

    if (
      timesheet.employee !== employee.value?.name ||
      timesheet.workflow_state !== 'Draft' ||
      timesheet.docstatus !== 0
    ) {
      error.value =
        'Only your own Draft timesheets can be edited'
      return
    }

    editingTimesheet.value = timesheet

    newTimesheet.value = {
      ...newTimesheet.value,
      start_date:
        timesheet.start_date ||
        new Date().toLocaleDateString('en-CA'),
      end_date:
        timesheet.end_date ||
        timesheet.start_date ||
        new Date().toLocaleDateString('en-CA')
    }

    selectedTimesheet.value = null
    showEdit.value = true

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load timesheet for editing'
    )
  } finally {
    detailLoading.value = false
  }
}

/* =========================
   Update Timesheet
========================= */

async function updateTimesheet(entries) {
  error.value = ''

  if (
    !editingTimesheet.value ||
    editingTimesheet.value.employee !== employee.value?.name ||
    activeView.value !== 'mine' ||
    !entries ||
    !entries.length
  ) {
    error.value =
      'Please provide work entries for your own timesheet'
    return
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    if (!entry.activity_type) {
      error.value =
        `Please select Activity Type for Work Entry ${i + 1}`
      return
    }

    if (!entry.hours || entry.hours <= 0) {
      error.value =
        `Please enter valid hours for Work Entry ${i + 1}`
      return
    }
  }

  saving.value = true

  const timesheetName = editingTimesheet.value.name

  try {
    const currentRes = await api.get(
      `/api/resource/Timesheet/${encodeURIComponent(timesheetName)}`
    )

    const current = currentRes.data.data

    if (
      current.employee !== employee.value.name ||
      current.workflow_state !== 'Draft' ||
      current.docstatus !== 0
    ) {
      error.value =
        'This timesheet can no longer be edited'
      return
    }

    const payload = {
      start_date: newTimesheet.value.start_date,
      end_date: newTimesheet.value.end_date,
      time_logs: entries.map(entry => ({
        ...(entry.name ? { name: entry.name } : {}),
        activity_type: entry.activity_type,
        project: entry.project || null,
        deliverables: entry.deliverables || null,
        description: entry.description || null,
        hours: Number(entry.hours)
      }))
    }

    await api.put(
      `/api/resource/Timesheet/${encodeURIComponent(timesheetName)}`,
      payload
    )

    showEdit.value = false
    editingTimesheet.value = null

    await loadMyTimesheets()

    if (managerView.value) {
      await loadTeamTimesheets(
        localStorage.getItem('user')
      )
    }

    await openTimesheet(timesheetName)

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not update timesheet'
    )
  } finally {
    saving.value = false
  }
}

/* =========================
   Initial Load
========================= */

onMounted(async () => {
  try {
    const email = localStorage.getItem('user')

    setupManagerView()

    const emp = await api.get(
      '/api/resource/Employee',
      {
        params: {
          filters: JSON.stringify([
            ['user_id', '=', email]
          ]),
          fields: JSON.stringify([
            'name',
            'employee_name',
            'company'
          ])
        }
      }
    )

    employee.value = emp.data.data[0]

    if (!employee.value) {
      error.value =
        'No employee record linked to this user'
      return
    }

    await loadMyTimesheets()

    if (managerView.value) {
      await loadTeamTimesheets(email)
    }

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load timesheets'
    )
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="timesheet-page">

    <header class="page-header">
      <div>
        <span class="page-eyebrow">EMPLOYEE SELF SERVICE</span>
        <h1>
          {{
            activeView === 'team'
              ? 'Team timesheets'
              : 'Timesheet management'
          }}
        </h1>
        <p>
          {{
            activeView === 'team'
              ? 'Review work hours and manage team approvals.'
              : 'Record work hours, save drafts and submit timesheets.'
          }}
        </p>
      </div>

      <button
        v-if="
          activeView === 'mine' &&
          !selectedTimesheet &&
          !showCreate &&
          !showEdit
        "
        type="button"
        class="create-btn"
        @click="
          selectedTimesheet = null;
          showEdit = false;
          editingTimesheet = null;
          showCreate = true
        "
      >
        <span aria-hidden="true">+</span>
        Create timesheet
      </button>
    </header>

    <section
      v-if="!showCreate && !showEdit"
      class="timesheet-welcome-banner"
    >
      <div class="timesheet-welcome-content">
        <span class="timesheet-welcome-label">YOUR WORKSPACE</span>

        <p>
          Create your daily timesheet, record your work and
          keep your submissions up to date.
        </p>
      </div>
    </section>

    <!-- Manager Tabs -->
    <TimesheetTabs
      v-if="managerView"
      v-model="activeView"
    />

    <section
      v-if="showOverview"
      class="timesheet-overview"
      aria-label="Timesheet overview"
    >
      <article class="timesheet-stat">
        <div class="stat-heading">
          <span>Total timesheets</span>
          <span class="stat-icon stat-blue">▤</span>
        </div>
        <strong>{{ timesheetStats.total }}</strong>
        <small>Recorded timesheets</small>
      </article>

      <article class="timesheet-stat">
        <div class="stat-heading">
          <span>Recorded hours</span>
          <span class="stat-icon stat-purple">◷</span>
        </div>
        <strong>{{ timesheetStats.hours.toFixed(1) }}</strong>
        <small>Hours across loaded timesheets</small>
      </article>

      <article class="timesheet-stat">
        <div class="stat-heading">
          <span>Draft</span>
          <span class="stat-icon stat-amber">◷</span>
        </div>
        <strong>{{ timesheetStats.draft }}</strong>
        <small>Timesheets requiring submission</small>
      </article>

      <article class="timesheet-stat">
        <div class="stat-heading">
          <span>Submitted</span>
          <span class="stat-icon stat-green">✓</span>
        </div>
        <strong>{{ timesheetStats.approved }}</strong>
        <small>Submitted timesheets</small>
      </article>
    </section>

    <TimesheetDeadline
      v-if="
        activeView === 'mine' &&
        employee &&
        !selectedTimesheet &&
        !showCreate &&
        !showEdit
      "
      ref="deadlinePanel"
    />

    <!-- Create Timesheet -->
    <TimesheetCreateForm
      v-if="showCreate && activeView === 'mine'"
      v-model:form="newTimesheet"
      :saving="saving"
      @submit="createTimesheet"
      @cancel="showCreate = false"
    />

    <!-- Edit Timesheet -->
    <TimesheetCreateForm
      v-if="
        showEdit &&
        editingTimesheet &&
        activeView === 'mine'
      "
      :form="newTimesheet"
      :saving="saving"
      mode="edit"
      :initial-entries="editingTimesheet.time_logs || []"
      @submit="updateTimesheet"
      @cancel="
        showEdit = false;
        editingTimesheet = null
      "
    />

    <!-- Loading -->
    <div
      v-if="loading || teamLoading"
      class="loading"
    >
      Loading timesheets...
    </div>

    <!-- Error -->
    <div v-if="error" class="err">
      {{ error }}
    </div>

    <!-- Timesheet Details -->
    <TimesheetDetail
      v-if="
        !loading &&
        !teamLoading &&
        selectedTimesheet
      "
      :timesheet="selectedTimesheet"
      :loading="detailLoading"
      :submitting="submitting"
      :is-manager="managerView"
      :is-manager-view="
        managerView && activeView === 'team'
      "
      :approving="approving"
      :rejecting="rejecting"
      @back="closeTimesheet"
      @edit="editTimesheet"
      @submit="submitTimesheet"
      @approve="approveTimesheet"
      @reject="rejectTimesheet"
    />

    <!-- Timesheet List -->
    <TimesheetList
      v-if="
        !loading &&
        !teamLoading &&
        !selectedTimesheet &&
        !showCreate &&
        !showEdit
      "
      :timesheets="
        activeView === 'mine'
          ? timesheets
          : teamTimesheets
      "
      :loading="false"
      :empty-message="
        activeView === 'mine'
          ? 'No timesheets found.'
          : 'No team timesheets found.'
      "
      @open="openTimesheet"
    />

  </div>
</template>

<style scoped>
.timesheet-page {
  width: 100%;
  min-width: 0;
  padding: 24px 28px 40px;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .timesheet-page {
    padding: 16px;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
}

.page-header p {
  margin: 0;
  color: var(--muted);
}

.create-btn {
  border: none;
  background: var(--accent);
  color: white;
  padding: 10px 16px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.create-btn:hover {
  background: var(--accent-dark);
}

.loading {
  padding: 30px;
  text-align: center;
  color: var(--muted);
}

.err {
  padding: 14px 16px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #dc2626;
  border-radius: 10px;
  margin-bottom: 20px;
}

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
  }
}

/* Enterprise timesheet page */
.timesheet-page {
  width: 100%;
  min-width: 0;
  padding: 32px clamp(20px, 3vw, 48px) 56px;
  box-sizing: border-box;
  color: #202d46;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.page-header h1 {
  margin: 0;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -1px;
}

.page-header p {
  margin-top: 9px;
  color: #7c899e;
  font-size: 13px;
  line-height: 1.6;
}

.create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 12px 18px;
  border: 0;
  border-radius: 9px;
  background: #4f46e5;
  color: white;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.create-btn:hover {
  background: #4338ca;
}

.timesheet-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
  margin: 24px 0;
}

.timesheet-stat {
  min-width: 0;
  padding: 19px 20px;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: white;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.stat-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #65748c;
  font-size: 12px;
  font-weight: 650;
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

.stat-blue {
  background: #e7efff;
  color: #366ee8;
}

.stat-purple {
  background: #eeeaff;
  color: #5546df;
}

.stat-amber {
  background: #fff4e5;
  color: #b7791f;
}

.stat-green {
  background: #e6f8ef;
  color: #139c67;
}

.timesheet-stat > strong {
  display: block;
  margin: 10px 0 5px;
  color: #202d46;
  font-size: 27px;
  font-weight: 750;
}

.timesheet-stat > small {
  color: #8b98ae;
  font-size: 11px;
}

.loading {
  padding: 40px 24px;
  border: 1px solid #e5eaf2;
  border-radius: 13px;
  background: white;
  text-align: center;
  color: #718096;
}

@media (max-width: 1100px) {
  .timesheet-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .timesheet-page {
    padding: 22px 16px 36px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header h1 {
    font-size: 25px;
  }

  .timesheet-overview {
    gap: 10px;
  }

  .timesheet-stat {
    padding: 16px;
  }
}



/* =========================================================
   TIMESHEET WORKSPACE BANNER
   Dashboard-matched appearance
   ========================================================= */

.timesheet-welcome-banner {
  position: relative;
  display: flex;
  align-items: center;

  min-height: 175px;
  margin-bottom: 20px;
  padding: 31px 34px;

  overflow: hidden;
  border-radius: 15px;

  background: linear-gradient(115deg, #1d293f, #2e4168);
  color: #fff;

  box-shadow: 0 9px 25px rgba(25, 39, 67, .08);
}

.timesheet-welcome-banner::after {
  content: '';

  position: absolute;
  width: 300px;
  height: 300px;
  right: -80px;
  top: -125px;

  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: 50%;

  box-shadow:
    0 0 0 45px rgba(255, 255, 255, .025),
    0 0 0 95px rgba(255, 255, 255, .025);

  pointer-events: none;
}

.timesheet-welcome-content {
  position: relative;
  z-index: 1;
  max-width: 650px;
}

.timesheet-welcome-label {
  display: block;
  margin-bottom: 8px;

  color: #bac9e5;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.timesheet-welcome-banner p {
  max-width: 560px;
  margin: 0;

  color: #d1daeb;
  font-size: 14px;
  line-height: 1.7;
}

@media (max-width: 700px) {
  .timesheet-welcome-banner {
    min-height: 150px;
    padding: 25px 22px;
  }
}

/* =========================================================
   TIMESHEET DASHBOARD HIERARCHY
   ========================================================= */

.timesheet-page .timesheet-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;

  margin: 0 0 20px;
}

.timesheet-page .timesheet-stat {
  display: flex;
  flex-direction: column;

  min-height: 172px;
  padding: 19px;

  border: 1px solid #dfe6f3;
  border-radius: 13px;

  background: #ffffff;

  box-shadow: 0 4px 13px rgba(26, 43, 76, .035);

  transition:
    border-color .2s ease,
    transform .2s ease;
}

.timesheet-page .timesheet-stat:hover {
  border-color: #c8d0ed;
  transform: translateY(-1px);
}

.timesheet-page .timesheet-stat .stat-heading {
  color: #64738d;
  font-size: 12px;
  font-weight: 600;
}

.timesheet-page .timesheet-stat > strong {
  display: block;
  margin: 16px 0 5px;

  color: #202d46;
  font-size: 29px;
  line-height: 1.05;
  font-weight: 750;
}

.timesheet-page .timesheet-stat > small {
  margin-top: auto;
  color: #8b98ae;
  font-size: 11px;
}

/* Keep reminders below the summary, visually secondary. */
.timesheet-page .timesheet-overview + .timesheet-deadline,
.timesheet-page .timesheet-overview + section {
  margin-top: 0;
}

@media (max-width: 1050px) {
  .timesheet-page .timesheet-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .timesheet-page .timesheet-overview {
    grid-template-columns: 1fr;
  }
}

</style>
