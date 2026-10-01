<script setup>
const props = defineProps({ pending: { type:Array,required:true }, upcoming:{type:Array,required:true}, busy:{type:String,default:''}, canAct:{type:Function,required:true} })
const emit = defineEmits(['open','act'])
</script>

<template>
  <section class="panel">
    <div class="head"><div><h3>Leave management</h3><p>Pending requests and approved upcoming leave</p></div><span class="count">{{ pending.length }} pending</span></div>
    <h4>Pending leave requests</h4>
    <p v-if="!pending.length" class="empty">No pending requests.</p>
    <div v-for="leave in pending.slice(0,5)" :key="leave.name" class="item">
      <div class="person"><button class="name" @click="emit('open',leave.employee)">{{ leave.employee_name }}</button><small>{{ leave.leave_type }} · {{ leave.from_date }} – {{ leave.to_date }}</small><small>Approver: {{ leave.leave_approver || 'none set' }}</small></div>
      <div v-if="canAct(leave)" class="actions"><button :disabled="!!busy" class="approve" @click="emit('act',leave,'Approve')">Approve</button><button :disabled="!!busy" class="reject" @click="emit('act',leave,'Reject')">Reject</button></div>
      <span v-else class="pill">Pending</span>
    </div>
    <p v-if="pending.length>5" class="muted">{{ pending.length-5 }} more pending requests. Select the Pending Leaves summary card for the full list.</p>
    <h4 class="upcoming-title">Approved leave · Next 7 days</h4>
    <p v-if="!upcoming.length" class="empty">No approved leave scheduled in the next 7 days.</p>
    <div v-for="leave in upcoming.slice(0,5)" :key="leave.name" class="item"><div class="person"><button class="name" @click="emit('open',leave.employee)">{{ leave.employee_name }}</button><small>{{ leave.leave_type }} · {{ leave.from_date }} – {{ leave.to_date }}</small></div><span class="approved">Approved</span></div>
  </section>
</template>

<style scoped>
.panel{background:var(--card,#fff);border:1px solid var(--border,#e5e6f0);border-radius:14px;padding:22px;box-shadow:var(--shadow,0 6px 18px #171b3410);min-width:0}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.head h3{font-size:17px;margin:0 0 5px}.head p,.muted{font-size:12px;color:var(--muted,#666a85);margin:0}.count,.pill{font-size:11px;border-radius:30px;background:#fff7ed;color:#b45309;padding:6px 9px;white-space:nowrap}
h4{font-size:12px;margin:23px 0 10px}.upcoming-title{border-top:1px solid #edf0f6;padding-top:18px}.empty{font-size:12px;color:var(--muted,#666a85);background:#f8f9fc;padding:13px;border-radius:9px}.item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f2f6}.person{display:flex;flex-direction:column;gap:5px;min-width:0}.name{background:none;border:0;padding:0;text-align:left;color:#4f46e5;font-weight:650;cursor:pointer}.person small{color:var(--muted,#666a85);font-size:11px}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{border:0;border-radius:7px;padding:7px 10px;cursor:pointer;font-size:11px;font-weight:700}.actions button:disabled{opacity:.5;cursor:wait}.approve{background:#4f46e5;color:white}.reject{background:#fee2e2;color:#b91c1c}.approved{background:#dcfce7;color:#15803d;font-size:11px;padding:5px 9px;border-radius:20px}
</style>
