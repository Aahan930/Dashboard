<script setup>
const props = defineProps({
  cards: { type: Array, required: true },
  selected: { type: String, default: null }
})
const emit = defineEmits(['select'])
</script>

<template>
  <section class="stats" aria-label="HR summary">
    <button v-for="card in props.cards" :key="card.id" type="button"
      class="stat" :class="[{ active: selected === card.id }, card.color]"
      @click="emit('select', card.id)">
      <span class="stat-top"><span>{{ card.label }}</span><span class="symbol">{{ card.icon }}</span></span>
      <strong>{{ card.value }}</strong>
      <small>{{ card.note }}</small>
    </button>
  </section>
</template>

<style scoped>
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:14px;margin-bottom:22px}
.stat{display:flex;flex-direction:column;gap:12px;text-align:left;background:var(--card,#fff);border:1px solid var(--border,#e5e6f0);border-radius:14px;padding:19px;box-shadow:var(--shadow,0 6px 18px #171b3410);cursor:pointer;color:var(--text,#181a33);transition:transform .15s,border-color .15s}
.stat:hover{transform:translateY(-2px);border-color:#b9b7ee}.stat.active{border:2px solid #4f46e5;padding:18px}
.stat-top{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;color:var(--muted,#666a85)}
.symbol{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#f0efff;color:#4f46e5;font-size:18px}
.stat strong{font-size:32px;line-height:1}.stat small{color:var(--muted,#666a85);font-size:11px}
.stat.green strong{color:#16a34a}.stat.amber strong{color:#d97706}.stat.blue strong{color:#4f46e5}.stat.red strong{color:#dc2626}.stat.indigo strong{color:#2563eb}
</style>
