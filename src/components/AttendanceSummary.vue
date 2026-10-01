<script setup>
defineProps({
  present: {
    type: Number,
    default: 0
  },
  absent: {
    type: Number,
    default: 0
  },
  halfDay: {
    type: Number,
    default: 0
  },
  leave: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
})

function percentage(value, total) {
  if (!total) return '0%'
  return `${(value / total) * 100}%`
}
</script>

<template>
  <section class="summary-panel panel">

    <div class="panel-header">
      <div>
        <h2>Attendance Summary</h2>

        <span class="panel-subtitle">
          Overview for the selected period
        </span>
      </div>
    </div>

    <div class="summary-grid">

      <div class="summary-item">
        <div class="summary-top">
          <span>Present</span>
          <strong>{{ present }}</strong>
        </div>

        <div class="progress">
          <div
            class="progress-fill green-fill"
            :style="{ width: percentage(present, total) }"
          ></div>
        </div>
      </div>

      <div class="summary-item">
        <div class="summary-top">
          <span>Absent</span>
          <strong>{{ absent }}</strong>
        </div>

        <div class="progress">
          <div
            class="progress-fill red-fill"
            :style="{ width: percentage(absent, total) }"
          ></div>
        </div>
      </div>

      <div class="summary-item">
        <div class="summary-top">
          <span>Half Day</span>
          <strong>{{ halfDay }}</strong>
        </div>

        <div class="progress">
          <div
            class="progress-fill amber-fill"
            :style="{ width: percentage(halfDay, total) }"
          ></div>
        </div>
      </div>

      <div class="summary-item">
        <div class="summary-top">
          <span>On Leave</span>
          <strong>{{ leave }}</strong>
        </div>

        <div class="progress">
          <div
            class="progress-fill purple-fill"
            :style="{ width: percentage(leave, total) }"
          ></div>
        </div>
      </div>

    </div>

  </section>
</template>

<style scoped>
.panel {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 17px;
  padding: 22px;
  box-sizing: border-box;
}

.summary-panel {
  margin-bottom: 30px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: #111827;
}

.panel-subtitle {
  display: block;
  margin-top: 4px;
  color: #98a2b3;
  font-size: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 25px;
}

.summary-item {
  min-width: 0;
}

.summary-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 9px;
  color: #667085;
  font-size: 13px;
}

.summary-top strong {
  color: #111827;
}

.progress {
  height: 7px;
  background: #eef0f6;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 10px;
}

.green-fill {
  background: #22c55e;
}

.red-fill {
  background: #ef4444;
}

.amber-fill {
  background: #f59e0b;
}

.purple-fill {
  background: #7c3aed;
}

@media (max-width: 700px) {
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .panel {
    padding: 16px;
  }
}
</style>