<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { errMsg } from '../api'

const router = useRouter()

const employee = ref(null)
const loading = ref(true)
const error = ref('')

const initials = computed(() =>
  (employee.value?.employee_name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
)

function display(value) {
  return value || 'Not specified'
}

function formatDate(value) {
  if (!value) return 'Not specified'

  const parts = String(value).slice(0, 10).split('-')

  if (parts.length !== 3) return value

  const [year, month, day] = parts.map(Number)
  const date = new Date(year, month - 1, day)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

async function loadProfile() {
  loading.value = true
  error.value = ''

  try {
    const email = localStorage.getItem('user')

    const { data } = await api.get('/api/resource/Employee', {
      params: {
        filters: JSON.stringify([
          ['user_id', '=', email]
        ]),
        fields: JSON.stringify([
          'name',
          'employee_name',
          'department',
          'designation',
          'company',
          'leave_approver',
          'date_of_joining',
          'status'
        ])
      }
    })

    employee.value = data.data?.[0] || null

    if (!employee.value) {
      error.value = 'No employee record is linked to this account.'
    }
  } catch (e) {
    if (
      e.response?.status === 401 ||
      e.response?.status === 403
    ) {
      localStorage.removeItem('user')
      localStorage.removeItem('roles')
      await router.push('/login')
      return
    }

    error.value = errMsg(e, 'Could not load your profile.')
  } finally {
    loading.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <main class="profile-page">
    <header class="page-header">
      <div>
        <span class="eyebrow">EMPLOYEE SELF SERVICE</span>
        <h1>My profile</h1>
        <p>
          View your personal employment information and
          organizational details.
        </p>
      </div>

      <span class="read-only-label">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        Employee record
      </span>
    </header>

    <div v-if="loading" class="page-state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <strong>Loading your profile</strong>
      <p>Retrieving your employee information.</p>
    </div>

    <div v-else-if="error" class="page-state error" role="alert">
      <strong>Unable to display your profile</strong>
      <p>{{ error }}</p>

      <button type="button" @click="loadProfile">
        Try again
      </button>
    </div>

    <template v-else-if="employee">
      <section class="profile-hero">
        <div class="hero-content">
          <div class="avatar">
            {{ initials }}
          </div>

          <div class="hero-identity">
            <span class="hero-eyebrow">EMPLOYEE PROFILE</span>

            <h2>
              {{ display(employee.employee_name) }}
            </h2>

            <p>
              {{ display(employee.designation) }}
              <span class="separator">·</span>
              {{ display(employee.department) }}
            </p>

            <div class="employee-reference">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                />
                <circle cx="9" cy="10" r="2" />
                <path d="M5.5 17c.5-2 2-3 3.5-3s3 1 3.5 3M15 9h4M15 13h4" />
              </svg>

              {{ employee.name }}
            </div>
          </div>
        </div>

        <div class="hero-decoration" aria-hidden="true"></div>
      </section>

      <div class="profile-grid">
        <section class="detail-card">
          <div class="card-heading">
            <span class="card-icon purple">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="7"
                  width="18"
                  height="14"
                  rx="2"
                />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
              </svg>
            </span>

            <div>
              <h3>Employment details</h3>
              <p>Your role and organizational information.</p>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-row">
              <span>Employee ID</span>
              <strong class="monospace">
                {{ employee.name }}
              </strong>
            </div>

            <div class="detail-row">
              <span>Company</span>
              <strong>
                {{ display(employee.company) }}
              </strong>
            </div>

            <div class="detail-row">
              <span>Department</span>
              <strong>
                {{ display(employee.department) }}
              </strong>
            </div>

            <div class="detail-row">
              <span>Designation</span>
              <strong>
                {{ display(employee.designation) }}
              </strong>
            </div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-heading">
            <span class="card-icon blue">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="17"
                  rx="2"
                />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </span>

            <div>
              <h3>Work information</h3>
              <p>Important employment dates and contacts.</p>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-row">
              <span>Date of joining</span>
              <strong>
                {{ formatDate(employee.date_of_joining) }}
              </strong>
            </div>

            <div class="detail-row">
              <span>Leave approver</span>
              <strong class="email-value">
                {{ display(employee.leave_approver) }}
              </strong>
            </div>

            <div class="detail-row">
              <span>Employment status</span>

              <span
                class="detail-status"
                :class="{
                  inactive: employee.status !== 'Active'
                }"
              >
                <span class="status-dot"></span>
                {{ display(employee.status) }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div class="profile-note">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 11v6M12 7h.01" />
        </svg>

        <p>
          This information comes from your organization's employee
          records. Contact HR if any employment details need to be
          updated.
        </p>
      </div>
    </template>
  </main>
</template>

<style scoped>
.profile-page {
  width: 100%;
  min-width: 0;
  padding: 32px clamp(20px, 3vw, 48px) 56px;
  box-sizing: border-box;
  color: #24324b;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.eyebrow {
  display: block;
  margin-bottom: 9px;
  color: #7887a0;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.3px;
}

.page-header h1 {
  margin: 0;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -.8px;
}

.page-header p {
  margin: 9px 0 0;
  color: #7b899f;
  font-size: 13px;
  line-height: 1.6;
}

.read-only-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border: 1px solid #dce3f0;
  border-radius: 9px;
  background: #fff;
  color: #66758e;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.read-only-label svg {
  width: 15px;
  height: 15px;
}

.profile-hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  padding: 35px;
  border-radius: 15px;
  background: linear-gradient(
    115deg,
    #1c2941 0%,
    #26385c 68%,
    #354675 100%
  );
  color: #fff;
  box-shadow: 0 8px 24px rgba(25, 39, 67, .08);
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 23px;
  min-width: 0;
}

.avatar {
  display: grid;
  width: 83px;
  height: 83px;
  flex-shrink: 0;
  place-items: center;
  border: 3px solid rgba(255, 255, 255, .28);
  border-radius: 19px;
  background: #6265e9;
  color: #fff;
  font-size: 28px;
  font-weight: 750;
  letter-spacing: -.5px;
}

.hero-identity {
  min-width: 0;
}

.hero-eyebrow {
  color: #b2c1dc;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.4px;
}

.hero-identity h2 {
  margin: 8px 0 7px;
  color: #fff;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -.6px;
  overflow-wrap: anywhere;
}

.hero-identity p {
  margin: 0;
  color: #c4d0e4;
  font-size: 13px;
  line-height: 1.6;
}

.separator {
  margin: 0 5px;
  color: #8899b8;
}

.employee-reference {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 8px 11px;
  border: 1px solid rgba(255, 255, 255, .15);
  border-radius: 7px;
  background: rgba(255, 255, 255, .08);
  color: #e0e8f7;
  font-size: 11px;
  font-weight: 650;
}

.employee-reference svg {
  width: 15px;
  height: 15px;
}

.hero-status,
.detail-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

.hero-status {
  position: relative;
  z-index: 1;
  padding: 9px 12px;
  background: rgba(35, 185, 123, .18);
  color: #a8f3cd;
}

.status-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
}

.hero-status.inactive {
  background: rgba(255, 255, 255, .13);
  color: #e2e8f0;
}

.hero-decoration {
  position: absolute;
  right: -60px;
  bottom: -170px;
  width: 360px;
  height: 360px;
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: 50%;
  box-shadow:
    0 0 0 55px rgba(255, 255, 255, .025),
    0 0 0 110px rgba(255, 255, 255, .018);
  pointer-events: none;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 20px;
  margin-top: 22px;
}

.detail-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e3e9f2;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.card-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 24px;
  border-bottom: 1px solid #edf1f7;
}

.card-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 11px;
}

.card-icon svg {
  width: 20px;
  height: 20px;
}

.purple {
  background: #eeecff;
  color: #5b50d6;
}

.blue {
  background: #eaf1ff;
  color: #3973da;
}

.card-heading h3 {
  margin: 0;
  color: #26334b;
  font-size: 16px;
  font-weight: 750;
}

.card-heading p {
  margin: 6px 0 0;
  color: #8b98ac;
  font-size: 12px;
}

.detail-list {
  padding: 4px 24px;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 64px;
  padding: 13px 0;
  border-bottom: 1px solid #edf1f7;
}

.detail-row:last-child {
  border-bottom: 0;
}

.detail-row > span:first-child {
  color: #7b899f;
  font-size: 12px;
}

.detail-row strong {
  color: #26334b;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.monospace {
  font-variant-numeric: tabular-nums;
}

.email-value {
  overflow-wrap: anywhere;
}

.detail-status {
  padding: 7px 10px;
  background: #eaf8f0;
  color: #158451;
}

.detail-status.inactive {
  background: #f0f2f5;
  color: #667085;
}

.profile-note {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 22px;
  padding: 16px 18px;
  border: 1px solid #dfe6f7;
  border-radius: 10px;
  background: #f8faff;
}

.profile-note svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: #6575c7;
}

.profile-note p {
  margin: 0;
  color: #65748d;
  font-size: 12px;
  line-height: 1.65;
}

.page-state {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  border: 1px solid #e3e9f2;
  border-radius: 13px;
  background: #fff;
  text-align: center;
}

.page-state strong {
  margin-top: 14px;
  font-size: 15px;
}

.page-state p {
  color: #8190a6;
  font-size: 12px;
}

.page-state.error {
  border-color: #fecaca;
}

.page-state button {
  margin-top: 10px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e7e9ff;
  border-top-color: #554dd2;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .profile-page {
    padding: 22px 16px 36px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header h1 {
    font-size: 25px;
  }

  .profile-hero {
    flex-direction: column;
    padding: 25px 20px;
  }

  .hero-content {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
  }

  .hero-identity h2 {
    font-size: 22px;
  }

  .card-heading {
    padding: 20px;
  }

  .detail-list {
    padding: 4px 20px;
  }

  .detail-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }

  .detail-row strong {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
