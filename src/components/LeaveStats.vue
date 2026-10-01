<script setup>
defineProps({
  total: {
    type: Number,
    default: 0
  },
  approved: {
    type: Number,
    default: 0
  },
  pending: {
    type: Number,
    default: 0
  },
  rejected: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <div class="stats-row">

    <div class="stat-card">
      <div class="icon blue">📅</div>
      <div class="lbl">Total requests</div>
      <div class="num">{{ total }}</div>
    </div>

    <div class="stat-card">
      <div class="icon green">✅</div>
      <div class="lbl">Approved</div>
      <div class="num">{{ approved }}</div>
    </div>

    <div class="stat-card">
      <div class="icon amber">⏳</div>
      <div class="lbl">Pending</div>
      <div class="num">{{ pending }}</div>
    </div>

    <div class="stat-card">
      <div class="icon red">✖️</div>
      <div class="lbl">Rejected</div>
      <div class="num">{{ rejected }}</div>
    </div>

  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 14px;
  padding: 16px;
}

.icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.icon.blue {
  background: #e8efff;
}

.icon.green {
  background: #e7f8ef;
}

.icon.amber {
  background: #fff4df;
}

.icon.red {
  background: #ffe8ea;
}

.lbl {
  color: #667085;
  font-size: 12px;
  margin-bottom: 4px;
}

.num {
  color: #111827;
  font-size: 22px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>