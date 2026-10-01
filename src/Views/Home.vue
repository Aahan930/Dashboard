<script setup>
import { useRouter } from 'vue-router'
import api from '../api'

const router = useRouter()
const user = localStorage.getItem('user')

async function logout() {
  await api.get('/api/method/logout')
  localStorage.removeItem('user')
  router.push('/login')
}
</script>

<template>
  <div style="max-width: 600px; margin: 60px auto; font-family: sans-serif">
    <h2>Welcome, {{ user }}</h2>
    <nav style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap">
      <router-link to="/profile">My Profile</router-link>
      <router-link to="/balance">Leave Balance</router-link>
      <router-link to="/apply">Apply for Leave</router-link>
      <router-link to="/my-leaves">My Leaves</router-link>
      <router-link to="/approvals">Approvals</router-link>
    </nav>
    <button @click="logout">Logout</button>
  </div>
</template>