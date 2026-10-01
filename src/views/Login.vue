
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api, { loadRoles } from '../api'
import logo from '../assets/nestorbird-logo.jpeg'

const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

async function login() {
  if (loading.value) return

  error.value = ''

  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }

  loading.value = true

  try {
    await api.post('/api/method/login', {
      usr: email.value.trim(),
      pwd: password.value
    })

    const { data } = await api.get(
      '/api/method/frappe.auth.get_logged_user'
    )

    localStorage.setItem('user', data.message)
    localStorage.removeItem('roles')

    try {
      await loadRoles()
    } catch (e) {
      console.warn('Unable to load roles:', e)
    }

    await router.push('/')
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'Unable to sign in. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <!-- LEFT BRAND PANEL -->
    <section class="brand-panel">
      <div class="brand-content">
        <div class="brand-heading">
          <img
            :src="logo"
            alt="NestorBird logo"
            class="brand-logo"
          />
          <span>NestorBird</span>
        </div>

        <div class="brand-message">
          <span class="eyebrow">NESTORBIRD HRMS</span>

          <h1>
            Your workplace.<br />
            <span>One connected experience.</span>
          </h1>

          <p>
            A simpler way to manage attendance, timesheets,
            leave and everything that keeps your workday moving.
          </p>

          <div class="feature-list">
            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>Seamless attendance management</span>
            </div>

            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>Leave and timesheet tracking</span>
            </div>

            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>One place for your entire team</span>
            </div>
          </div>
        </div>

        <div class="brand-footer">
          © {{ new Date().getFullYear() }} NestorBird.
          All rights reserved.
        </div>
      </div>

      <div class="decor decor-one"></div>
      <div class="decor decor-two"></div>
    </section>

    <!-- RIGHT LOGIN PANEL -->
    <section class="form-panel">
      <div class="login-card">
        <div class="mobile-brand">
          <img :src="logo" alt="NestorBird logo" />
          <span>NestorBird</span>
        </div>

        <div class="form-heading">
          <span class="welcome-label">EMPLOYEE PORTAL</span>
          <h2>Welcome back</h2>
          <p>Sign in to your NestorBird account.</p>
        </div>

        <form @submit.prevent="login">
          <!-- EMAIL -->
          <div class="field">
            <label for="login-email">Work email</label>

            <input
              id="login-email"
              v-model="email"
              type="text"
              autocomplete="username"
              placeholder="name@company.com"
              :disabled="loading"
              required
            />
          </div>

          <!-- PASSWORD -->
          <div class="field">
            <label for="login-password">Password</label>

            <div class="password-row">
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Enter your password"
                :disabled="loading"
                required
              />

              <button
                type="button"
                class="password-toggle"
                :disabled="loading"
                :aria-label="
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                "
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <!-- ERROR -->
          <div
            v-if="error"
            class="error-message"
            role="alert"
          >
            <span class="error-icon">!</span>
            <span>{{ error }}</span>
          </div>

          <!-- SUBMIT -->
          <button
            type="submit"
            class="submit-button"
            :disabled="loading"
          >
            <span v-if="loading" class="spinner"></span>

            <span>
              {{ loading ? 'Signing in...' : 'Sign in' }}
            </span>

            <span v-if="!loading" aria-hidden="true">→</span>
          </button>
        </form>

        <div class="form-footer">
          <span>Secure access to NestorBird HRMS</span>

          <span class="security-indicator">
            <span class="security-dot"></span>
            Employee workspace
          </span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.login-page {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: #f8faff;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

/* BRAND PANEL */

.brand-panel {
  position: relative;
  display: flex;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    #111b3c 0%,
    #182c5e 58%,
    #284b91 100%
  );
  color: #fff;
}

.brand-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  max-width: 760px;
  padding: 54px clamp(36px, 6vw, 100px);
}

.brand-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.8px;
}

.brand-logo {
  width: 65px;
  height: 65px;
  object-fit: contain;
  border-radius: 13px;
  background: #fff;
}

.brand-message {
  margin: 65px 0;
}

.eyebrow,
.welcome-label {
  display: inline-block;
  color: #8bd4ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
}

.brand-message h1 {
  margin: 22px 0;
  font-size: clamp(34px, 3.5vw, 57px);
  line-height: 1.14;
  font-weight: 760;
  letter-spacing: -1.8px;
}

.brand-message h1 span {
  color: #8dc7ff;
}

.brand-message > p {
  max-width: 460px;
  color: #c7d5ef;
  font-size: 16px;
  line-height: 1.9;
}

.feature-list {
  display: grid;
  gap: 21px;
  margin-top: 48px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #e4edff;
  font-size: 14px;
}

.feature-icon {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border: 1px solid #6884bc;
  border-radius: 9px;
  color: #a6eddd;
  background: #ffffff12;
  font-weight: 800;
}

.brand-footer {
  color: #a9b9da;
  font-size: 12px;
}

.decor {
  position: absolute;
  border: 1px solid #ffffff13;
  border-radius: 50%;
  pointer-events: none;
}

.decor-one {
  right: -170px;
  bottom: -250px;
  width: 550px;
  height: 550px;
  background: #ffffff05;
}

.decor-two {
  top: 14%;
  right: -200px;
  width: 360px;
  height: 360px;
}

/* LOGIN FORM */

.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 55px 28px;
}

.login-card {
  width: 100%;
  max-width: 420px;
}

.mobile-brand {
  display: none;
}

.form-heading {
  margin-bottom: 38px;
}

.welcome-label {
  color: #506bd2;
}

.form-heading h2 {
  margin: 13px 0 9px;
  color: #172443;
  font-size: 36px;
  font-weight: 760;
  letter-spacing: -1.2px;
}

.form-heading p {
  margin: 0;
  color: #78859b;
  font-size: 14px;
}

/* INPUTS */

.field {
  margin-bottom: 24px;
}

.field label {
  display: block;
  margin-bottom: 10px;
  color: #273653;
  font-size: 13px;
  font-weight: 700;
}

.field > input,
.password-row > input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 51px;
  padding: 0 16px;
  border: 1px solid #dce3ef;
  border-radius: 10px;
  outline: none;
  background: #fff;
  color: #18253d;
  font-family: inherit;
  font-size: 14px;
  line-height: normal;
  appearance: none;
  -webkit-appearance: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.field input::placeholder {
  color: #a4aec0;
}

.field input:focus {
  border-color: #5272e5;
  box-shadow: 0 0 0 4px #5272e515;
}

.field input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* PASSWORD FIX:
   Input and toggle occupy separate columns.
   The button cannot overlap the input.
*/

.password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 68px;
  align-items: stretch;
  gap: 9px;
  width: 100%;
}

.password-row > input {
  position: static;
  grid-column: 1;
  width: 100%;
  min-width: 0;
  margin: 0;
}

.login-page .password-row > button.password-toggle {
  position: static;
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  height: 51px;
  min-height: 51px;
  margin: 0;
  padding: 0;
  transform: none;
  border: 1px solid #dce3ef;
  border-radius: 10px;
  outline: none;
  background: #fff;
  background-image: none;
  box-shadow: none;
  color: #3158c8;
  font-family: inherit;
  font-size: 12px;
  font-weight: 750;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.login-page .password-row > button.password-toggle:hover:not(:disabled) {
  transform: none;
  border-color: #b8c8ed;
  background: #eef2ff;
  box-shadow: none;
}

.login-page .password-row > button.password-toggle:focus-visible {
  outline: 2px solid #5272e5;
  outline-offset: 2px;
}

/* ERROR AND SUBMIT */

.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 13px;
  border: 1px solid #fecdd3;
  border-radius: 9px;
  background: #fff1f2;
  color: #be123c;
  font-size: 13px;
  line-height: 1.5;
}

.error-icon {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #be123c;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.login-page .submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  margin: 30px 0 0;
  padding: 0 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(
    100deg,
    #3158c8,
    #5278e5
  );
  box-shadow: 0 8px 18px #3158c82a;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 750;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.login-page .submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px #3158c83b;
}

.login-page .submit-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 17px;
  height: 17px;
  border: 2px solid #ffffff65;
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* FOOTER */

.form-footer {
  display: grid;
  gap: 14px;
  margin-top: 42px;
  padding-top: 25px;
  border-top: 1px solid #e7ebf3;
  color: #8a96a9;
  font-size: 12px;
  text-align: center;
}

.security-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #62718b;
}

.security-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16a34a;
}

/* RESPONSIVE */

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    display: none;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 55px;
    color: #172443;
    font-size: 24px;
    font-weight: 750;
  }

  .mobile-brand img {
    width: 58px;
    height: 58px;
    object-fit: contain;
    border-radius: 11px;
  }

  .form-panel {
    min-height: 100dvh;
    padding: 35px 24px;
  }
}

@media (max-width: 480px) {
  .form-heading h2 {
    font-size: 30px;
  }

  .mobile-brand {
    margin-bottom: 45px;
  }

  .password-row {
    grid-template-columns: minmax(0, 1fr) 62px;
    gap: 7px;
  }

  .login-page .password-row > button.password-toggle {
    width: 62px;
    min-width: 62px;
    max-width: 62px;
  }
}
</style>