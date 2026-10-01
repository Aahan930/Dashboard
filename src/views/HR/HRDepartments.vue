<script setup>
const props = defineProps({ departments:{type:Array,required:true}, total:{type:Number,required:true} })
</script>
<template>
  <section class="panel"><div class="head"><h3>Department headcount</h3><span>{{ total }} employees</span></div>
    <p v-if="!departments.length" class="muted">No department data available.</p>
    <div v-for="dept in departments" :key="dept.name" class="dept"><div class="labels"><strong>{{ dept.name }}</strong><span>{{ dept.n }} · {{ total ? Math.round(dept.n / total * 100) : 0 }}%</span></div><div class="track"><div :style="{width: total ? (dept.n / total * 100)+'%' : '0%'}"/></div></div>
  </section>
</template>
<style scoped>
.panel{background:var(--card,#fff);border:1px solid var(--border,#e5e6f0);border-radius:14px;padding:22px;box-shadow:var(--shadow,0 6px 18px #171b3410)}.head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:22px}.head h3{font-size:17px;margin:0}.head span,.muted{font-size:12px;color:var(--muted,#666a85)}.dept{margin-bottom:20px}.labels{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:9px}.labels span{color:var(--muted,#666a85)}.track{height:9px;background:#edeef5;border-radius:20px;overflow:hidden}.track>div{height:100%;background:linear-gradient(90deg,#818cf8,#4f46e5);border-radius:20px}
</style>
