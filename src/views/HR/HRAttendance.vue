<script setup>
import { computed } from 'vue'
const props = defineProps({ employees: { type: Array, required: true }, records: { type: Array, required: true }, date: { type: String, required: true } })
const emit = defineEmits(['mark', 'open'])
const activeIds = computed(() => new Set(props.employees.map(e => e.name)))
const rows = computed(() => props.records.filter(a => activeIds.value.has(a.employee)))
const counts = computed(() => ({
  present: rows.value.filter(a => a.status === 'Present').length,
  half: rows.value.filter(a => a.status === 'Half Day').length,
  absent: rows.value.filter(a => a.status === 'Absent').length,
  leave: rows.value.filter(a => a.status === 'On Leave').length,
  unmarked: props.employees.length - new Set(rows.value.map(a => a.employee)).size
}))
const segments = computed(() => [
  { name:'Present', value:counts.value.present, color:'#16a34a' },
  { name:'Half Day', value:counts.value.half, color:'#f59e0b' },
  { name:'Absent', value:counts.value.absent, color:'#dc2626' },
  { name:'On Leave', value:counts.value.leave, color:'#6366f1' },
  { name:'Not Marked', value:counts.value.unmarked, color:'#cbd5e1' }
])
const unmarked = computed(() => props.employees.filter(e => !rows.value.some(a => a.employee === e.name)))
</script>

<template>
  <section class="panel">
    <div class="head"><div><h3>Today's attendance</h3><p>Attendance status for {{ date }}</p></div><button class="action" @click="emit('mark')">Mark attendance →</button></div>
    <div class="bar" role="img" :aria-label="'Attendance for ' + employees.length + ' employees'">
      <span v-for="segment in segments" :key="segment.name" :style="{width: employees.length ? (segment.value / employees.length * 100) + '%' : '0%', background: segment.color}" />
    </div>
    <div class="legend"><span v-for="segment in segments" :key="segment.name"><i :style="{background:segment.color}"/>{{ segment.name }} <b>{{ segment.value }}</b></span></div>
    <div class="list-head"><strong>Employees without a record</strong><span>{{ unmarked.length }}</span></div>
    <p v-if="!unmarked.length" class="muted">Everyone has an attendance record today.</p>
    <div v-else class="employee-list">
      <button v-for="employee in unmarked.slice(0,5)" :key="employee.name" class="employee" @click="emit('open',employee.name)">
        <span class="avatar">{{ employee.employee_name?.charAt(0) || '?' }}</span>
        <span><strong>{{ employee.employee_name }}</strong><small>{{ employee.department || 'No department' }}</small></span>
        <span class="arrow">↗</span>
      </button>
      <p v-if="unmarked.length>5" class="muted">And {{ unmarked.length-5 }} more. Select the Not Marked summary card to view everyone.</p>
    </div>
  </section>
</template>

<style scoped>
.panel{background:var(--card,#fff);border:1px solid var(--border,#e5e6f0);border-radius:14px;padding:22px;box-shadow:var(--shadow,0 6px 18px #171b3410);min-width:0}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.head h3{font-size:17px;margin:0 0 5px}.head p,.muted{font-size:12px;color:var(--muted,#666a85);margin:0}.action{background:#eeedfb;color:#4f46e5;border:0;border-radius:8px;padding:9px 12px;font-weight:650;cursor:pointer}
.bar{display:flex;height:12px;overflow:hidden;border-radius:20px;background:#f1f5f9;margin:22px 0 12px}.bar span{height:100%}.legend{display:flex;flex-wrap:wrap;gap:9px 14px;font-size:11px;color:var(--muted,#666a85);margin-bottom:20px}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:50%}
.list-head{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #edf0f6;padding-top:15px;margin-bottom:10px;font-size:13px}.list-head span{background:#fff7ed;color:#b45309;padding:4px 9px;border-radius:20px}
.employee-list{display:grid;gap:5px}.employee{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:0;border-radius:8px;padding:8px;cursor:pointer;color:inherit}.employee:hover{background:#f6f5ff}.employee>span:nth-child(2){display:flex;flex-direction:column;gap:3px;font-size:12px}.employee small{color:var(--muted,#666a85)}.avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#eeedfb;color:#4f46e5;font-weight:700}.arrow{margin-left:auto;color:#4f46e5}
</style>
